import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from '@iconify/react'
import {
  fetchAdsetPerformance, fetchAdPerformance, fetchHypotheses,
  deleteAdsetPerformance, updateAdsetPerformance,
  deleteAdPerformance, updateAdPerformance, deleteAdsByAdset
} from '../lib/supabase'
import CsvUpload from './CsvUpload'

const SORT_OPTS = ['기본', 'IPM 높은 순', 'IPM 낮은 순']
const RESOLUTIONS = ['1080x1920', '1920x1080', '1080x1080', '1080x1350']

/* ── 소재명에서 미디어/해상도 파싱 (DB 값 보완용) ── */
export function parseAdInfo(adName) {
  if (!adName) return { media: null, resolution: null }
  const parts = adName.split('_')

  // UA_VID / UA_IMG 우선, 없으면 전체 토큰에서 VID/IMG 탐색
  const uaIdx = parts.indexOf('UA')
  let mediaRaw = uaIdx !== -1 ? parts[uaIdx + 1] : null
  if (mediaRaw !== 'VID' && mediaRaw !== 'IMG') {
    mediaRaw = parts.find(p => p === 'VID' || p === 'IMG') || null
  }
  const media = mediaRaw === 'VID' ? '비디오' : mediaRaw === 'IMG' ? '이미지' : null

  const resolution = parts.find(p => RESOLUTIONS.includes(p))
    || parts.find(p => /^\d+[xX]\d+$/.test(p))
    || null

  return { media, resolution }
}

function toYM(d) { return d ? d.slice(0, 7) : null }
function ymLabel(ym) {
  if (!ym) return '날짜 없음'
  const [y, m] = ym.split('-')
  return `${y}년 ${parseInt(m)}월`
}


/* ── 미디어 뱃지 ── */
function MediaBadge({ media }) {
  if (!media) return <span className="text-gray-300">—</span>
  const isVid = media === '비디오'
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isVid ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
      {media}
    </span>
  )
}

/* ── 삭제 확인 모달 ── */
function DeleteConfirmModal({ message, detail, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-5">
          <Icon icon="uil:exclamation-circle" width={22} height={22} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-800">{message}</p>
            {detail && <p className="text-sm text-gray-400 mt-1 leading-relaxed">{detail}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">취소</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium cursor-pointer">삭제</button>
        </div>
      </div>
    </div>
  )
}

/* ── Ad Set 편집 모달 ── */
function AdsetEditModal({ adset, hypotheses, onSave, onClose }) {
  const [form, setForm] = useState({
    avg_ipm: adset.avg_ipm ?? '',
    total_impressions: adset.total_impressions ?? '',
    total_installs: adset.total_installs ?? '',
    total_cost: adset.total_cost ?? '',
    avg_ecpi: adset.avg_ecpi ?? '',
    upload_date: adset.upload_date ?? '',
    hypothesis_id: adset.hypothesis_id ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(adset.id, {
        avg_ipm: form.avg_ipm !== '' ? parseFloat(form.avg_ipm) : null,
        total_impressions: form.total_impressions !== '' ? parseFloat(form.total_impressions) : null,
        total_installs: form.total_installs !== '' ? parseFloat(form.total_installs) : null,
        total_cost: form.total_cost !== '' ? parseFloat(form.total_cost) : null,
        avg_ecpi: form.avg_ecpi !== '' ? parseFloat(form.avg_ecpi) : null,
        upload_date: form.upload_date || null,
        hypothesis_id: form.hypothesis_id || null,
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Ad Set 편집</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded cursor-pointer"><Icon icon="uil:times" width={18} height={18} className="text-gray-400" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1.5 rounded truncate">{adset.adset_name}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '평균 IPM', key: 'avg_ipm' },
              { label: '총 노출수', key: 'total_impressions' },
              { label: '총 설치수', key: 'total_installs' },
              { label: '총 비용 ($)', key: 'total_cost' },
              { label: '평균 eCPI ($)', key: 'avg_ecpi' },
            ].map(f => (
              <label key={f.key} className="block">
                <span className="text-xs text-gray-500 mb-1 block">{f.label}</span>
                <input type="number" step="any" value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20" />
              </label>
            ))}
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">집행 시작일</span>
              <input type="date" value={form.upload_date}
                onChange={e => setForm(p => ({ ...p, upload_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-gray-500 mb-1 block">연결 가설</span>
            <select value={form.hypothesis_id} onChange={e => setForm(p => ({ ...p, hypothesis_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none bg-white">
              <option value="">— 미연결 —</option>
              {hypotheses.map(h => <option key={h.id} value={h.id}>{h.id} {h.title}</option>)}
            </select>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#7AB51D] hover:bg-[#6A9E18] text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50">
            {saving ? <Icon icon="uil:sync" width={14} height={14} className="animate-spin" /> : <Icon icon="uil:check" width={14} height={14} />} 저장
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── 개별 Ad 인라인 편집 행 ── */
function AdEditRow({ ad, hypotheses, onSave, onCancel }) {
  const [form, setForm] = useState({
    ipm: ad.ipm ?? '',
    impressions: ad.impressions ?? '',
    installs: ad.installs ?? '',
    cost: ad.cost ?? '',
    asset_type: ad.asset_type ?? 'GENERAL',
    hypothesis_id: ad.hypothesis_id ?? '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(ad.id, {
        ipm: form.ipm !== '' ? parseFloat(form.ipm) : null,
        impressions: form.impressions !== '' ? parseFloat(form.impressions) : null,
        installs: form.installs !== '' ? parseFloat(form.installs) : null,
        cost: form.cost !== '' ? parseFloat(form.cost) : null,
        asset_type: form.asset_type,
        hypothesis_id: form.hypothesis_id || null,
      })
    } finally { setSaving(false) }
  }

  const inp = 'w-full px-1.5 py-1 border border-[#7AB51D]/40 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/40 bg-white'

  return (
    <tr className="border-b border-[#7AB51D]/20 bg-[#F0F7E6]/60">
      <td className="px-3 py-2 w-8" />
      <td className="px-6 py-2 font-mono text-[11px] text-gray-500 max-w-[260px] truncate">✏️ {ad.ad_name}</td>
      <td className="px-3 py-2">
        <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className={inp}>
          {ASSET_TYPE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-center text-gray-400 text-[11px]">{parseAdInfo(ad.ad_name).media || '—'}</td>
      <td className="px-3 py-2 text-center text-gray-400 text-[11px]">{parseAdInfo(ad.ad_name).resolution ?? <span className="italic text-gray-300">통합</span>}</td>
      <td className="px-3 py-2"><input type="number" step="any" value={form.ipm} onChange={e => setForm(p => ({ ...p, ipm: e.target.value }))} className={inp} /></td>
      <td className="px-3 py-2"><input type="number" step="any" value={form.impressions} onChange={e => setForm(p => ({ ...p, impressions: e.target.value }))} className={inp} /></td>
      <td className="px-3 py-2"><input type="number" step="any" value={form.installs} onChange={e => setForm(p => ({ ...p, installs: e.target.value }))} className={inp} /></td>
      <td className="px-3 py-2"><input type="number" step="any" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} className={inp} /></td>
      <td className="px-3 py-2">
        <select value={form.hypothesis_id} onChange={e => setForm(p => ({ ...p, hypothesis_id: e.target.value }))} className={inp}>
          <option value="">—</option>
          {hypotheses.map(h => <option key={h.id} value={h.id}>{h.id}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={saving} className="p-1.5 rounded bg-[#7AB51D] hover:bg-[#6A9E18] text-white cursor-pointer disabled:opacity-50">
            {saving ? <Icon icon="uil:sync" width={11} height={11} className="animate-spin" /> : <Icon icon="uil:check" width={11} height={11} />}
          </button>
          <button onClick={onCancel} className="p-1.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 cursor-pointer"><Icon icon="uil:times" width={11} height={11} /></button>
        </div>
      </td>
    </tr>
  )
}

/* ── Ad Set 행 ── */
function AdSortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <Icon icon="uil:sort" width={10} height={10} className="opacity-30 ml-0.5" />
  return sortDir === 'desc'
    ? <Icon icon="uil:arrow-down" width={10} height={10} className="text-[#7AB51D] ml-0.5" />
    : <Icon icon="uil:arrow-up" width={10} height={10} className="text-[#7AB51D] ml-0.5" />
}

function AdSetRow({ adset, hypotheses, checked, onCheck, onDeleted, onUpdated, adFilters }) {
  const [open, setOpen] = useState(false)
  const [ads, setAds] = useState([])
  const [loadingAds, setLoadingAds] = useState(false)
  const [editingAdId, setEditingAdId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showAdsetEdit, setShowAdsetEdit] = useState(false)
  const [adSortCol, setAdSortCol] = useState('ipm')
  const [adSortDir, setAdSortDir] = useState('desc')

  const handleAdSort = (col) => {
    if (adSortCol === col) setAdSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setAdSortCol(col); setAdSortDir('desc') }
  }

  const loadAds = useCallback(async (force = false) => {
    if (loadingAds) return
    if (ads.length > 0 && !force) return
    setLoadingAds(true)
    try { setAds(await fetchAdPerformance({ adset_name: adset.adset_name })) }
    catch (e) { console.error(e) }
    finally { setLoadingAds(false) }
  }, [adset.adset_name, ads.length, loadingAds])

  const toggle = () => { if (!open) loadAds(); setOpen(o => !o) }

  const handleDeleteAdset = async () => {
    try { await deleteAdsByAdset(adset.adset_name); await deleteAdsetPerformance(adset.id); onDeleted() }
    catch (e) { console.error(e) }
    setDeleteTarget(null)
  }
  const handleDeleteAd = async () => {
    try { await deleteAdPerformance(deleteTarget.id); setAds(p => p.filter(a => a.id !== deleteTarget.id)) }
    catch (e) { console.error(e) }
    setDeleteTarget(null)
  }

  // 소재명 기반 파싱으로 필터링 + 정렬된 ads (미디어·해상도 다중 선택)
  const filteredAds = ads
    .filter(ad => {
      const info = parseAdInfo(ad.ad_name)
      const { mediaKeys = [], resolutionKeys = [] } = adFilters
      if (mediaKeys.length > 0) {
        if (!info.media || !mediaKeys.includes(info.media)) return false
      }
      if (resolutionKeys.length > 0) {
        const isTong = info.resolution == null
        const ok = resolutionKeys.some(r => (r === '통합' ? isTong : info.resolution === r))
        if (!ok) return false
      }
      return true
    })
    .sort((a, b) => {
      const KEY_MAP = { ipm: 'ipm', impressions: 'impressions', installs: 'installs', cost: 'cost' }
      const key = KEY_MAP[adSortCol] || 'ipm'
      const va = a[key] ?? 0
      const vb = b[key] ?? 0
      return adSortDir === 'desc' ? vb - va : va - vb
    })

  const hypTitle = adset.hypotheses?.title || ''

  return (
    <>
      <tr className={`border-b border-gray-100 transition-colors group ${checked ? 'bg-red-50/40' : 'hover:bg-[#F0F7E6]/30'}`}>
        <td className="pl-4 pr-2 py-3 w-10" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={checked} onChange={() => onCheck(adset.id)}
            className="w-4 h-4 accent-red-500 cursor-pointer rounded" />
        </td>
        <td className="px-3 py-3 text-left cursor-pointer w-[240px] max-w-[240px] align-middle" onClick={toggle}>
          <div className="flex items-center gap-2 min-w-0 max-w-full">
            {open ? <Icon icon="uil:angle-down" width={14} height={14} className="text-gray-400 shrink-0" /> : <Icon icon="uil:angle-right" width={14} height={14} className="text-gray-400 shrink-0" />}
            <span className="font-medium text-sm text-gray-800 truncate text-left min-w-0">{adset.adset_name}</span>
          </div>
        </td>
        <td className="pl-1 pr-3 py-3 text-right text-sm tabular-nums whitespace-nowrap cursor-pointer w-16 align-middle" onClick={toggle}>{adset.ad_count}</td>
        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[#7AB51D] cursor-pointer" onClick={toggle}>{(adset.avg_ipm || 0).toFixed(2)}</td>
        <td className="px-4 py-3 text-right font-mono text-xs cursor-pointer" onClick={toggle}>{(adset.total_impressions || 0).toLocaleString()}</td>
        <td className="px-4 py-3 text-right font-mono text-xs cursor-pointer" onClick={toggle}>{(adset.total_installs || 0).toLocaleString()}</td>
        <td className="px-4 py-3 text-right font-mono text-xs cursor-pointer" onClick={toggle}>${(adset.total_cost || 0).toFixed(2)}</td>
        <td className="px-4 py-3 text-right font-mono text-xs cursor-pointer" onClick={toggle}>${(adset.avg_ecpi || 0).toFixed(2)}</td>
        <td className="px-4 py-3 cursor-pointer" onClick={toggle}>
          {adset.hypothesis_id
            ? <span className="text-xs font-mono font-bold text-[#7AB51D]">{adset.hypothesis_id}{hypTitle && <span className="text-gray-400 font-normal ml-1 text-[11px]">{hypTitle}</span>}</span>
            : <span className="text-gray-300 text-xs">미연결</span>}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 cursor-pointer" onClick={toggle}>{adset.upload_date || '—'}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={e => { e.stopPropagation(); setShowAdsetEdit(true) }}
              className="p-1.5 rounded hover:bg-[#F0F7E6] text-gray-400 hover:text-[#7AB51D] cursor-pointer" title="편집"><Icon icon="uil:pen" width={13} height={13} /></button>
            <button onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'adset', id: adset.id, name: adset.adset_name }) }}
              className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 cursor-pointer" title="삭제"><Icon icon="uil:trash-alt" width={13} height={13} /></button>
          </div>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={11} className="p-0">
            <div className="bg-[#F8FAFC] border-b border-gray-200">
              {loadingAds
                ? <div className="flex items-center gap-2 px-10 py-4 text-gray-400 text-sm"><Icon icon="uil:sync" width={14} height={14} className="animate-spin" /> 로딩 중...</div>
                : filteredAds.length === 0
                  ? <p className="px-10 py-4 text-gray-400 text-sm">{ads.length === 0 ? 'Ad 데이터가 없습니다.' : '필터 조건에 맞는 Ad가 없습니다.'}</p>
                  : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase tracking-wide border-b border-gray-200 bg-gray-50/80">
                          <th className="w-8 px-3 py-2" />
                          <th className="text-left px-6 py-2 font-medium">소재명</th>
                          <th className="text-center px-3 py-2 font-medium w-16">미디어</th>
                          <th className="text-center px-3 py-2 font-medium w-24">해상도</th>
                          {[
                            { key: 'ipm', label: 'IPM', cls: 'text-right w-16' },
                            { key: 'impressions', label: '노출', cls: 'text-right w-20' },
                            { key: 'installs', label: '설치', cls: 'text-right w-16' },
                            { key: 'cost', label: '비용', cls: 'text-right w-20' },
                          ].map(({ key, label, cls }) => (
                            <th key={key}
                              className={`px-3 py-2 font-medium cursor-pointer select-none hover:text-gray-700 transition-colors ${cls}`}
                              onClick={() => handleAdSort(key)}>
                              <span className="inline-flex items-center justify-end gap-0.5">
                                {label}
                                <AdSortIcon col={key} sortCol={adSortCol} sortDir={adSortDir} />
                              </span>
                            </th>
                          ))}
                          <th className="text-left px-3 py-2 font-medium w-20">가설</th>
                          <th className="px-3 py-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAds.map(ad => {
                          const info = parseAdInfo(ad.ad_name)
                          return editingAdId === ad.id
                            ? <AdEditRow key={ad.id} ad={ad} hypotheses={hypotheses}
                                onSave={async (id, u) => { await updateAdPerformance(id, u); setAds(p => p.map(a => a.id === id ? { ...a, ...u } : a)); setEditingAdId(null) }}
                                onCancel={() => setEditingAdId(null)} />
                            : (
                              <tr key={ad.id} className="border-b border-gray-100 hover:bg-white/80 transition-colors group/ad">
                                <td className="w-8 px-3 py-2" />
                                <td className="px-6 py-2 font-mono text-[11px] max-w-[240px] truncate text-gray-700" title={ad.ad_name}>└ {ad.ad_name}</td>
                                <td className="px-3 py-2 text-center"><MediaBadge media={info.media} /></td>
                                <td className="px-3 py-2 text-center font-mono text-[10px] text-gray-500">{info.resolution ?? <span className="text-gray-300 italic text-[10px]">통합</span>}</td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{(ad.ipm || 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{(ad.impressions || 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">{(ad.installs || 0).toLocaleString()}</td>
                                <td className="px-3 py-2 text-right font-mono text-gray-600">${(ad.cost || 0).toFixed(2)}</td>
                                <td className="px-3 py-2">
                                  {ad.hypothesis_id ? <span className="font-mono font-bold text-[#7AB51D] text-[10px]">{ad.hypothesis_id}</span> : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex gap-1 opacity-0 group-hover/ad:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingAdId(ad.id)} className="p-1 rounded hover:bg-[#F0F7E6] text-gray-400 hover:text-[#7AB51D] cursor-pointer"><Icon icon="uil:pen" width={11} height={11} /></button>
                                    <button onClick={() => setDeleteTarget({ type: 'ad', id: ad.id, name: ad.ad_name })} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 cursor-pointer"><Icon icon="uil:trash-alt" width={11} height={11} /></button>
                                  </div>
                                </td>
                              </tr>
                            )
                        })}
                      </tbody>
                    </table>
                  )}
            </div>
          </td>
        </tr>
      )}

      {deleteTarget && (
        <tr><td>
          <DeleteConfirmModal
            message={deleteTarget.type === 'adset' ? 'Ad Set을 삭제하시겠습니까?' : 'Ad를 삭제하시겠습니까?'}
            detail={deleteTarget.type === 'adset' ? `"${deleteTarget.name}" 및 하위 모든 Ad 데이터가 함께 삭제됩니다.` : `"${deleteTarget.name}"`}
            onConfirm={deleteTarget.type === 'adset' ? handleDeleteAdset : handleDeleteAd}
            onCancel={() => setDeleteTarget(null)}
          />
        </td></tr>
      )}
      {showAdsetEdit && (
        <tr><td>
          <AdsetEditModal adset={adset} hypotheses={hypotheses}
            onSave={async (id, u) => { await updateAdsetPerformance(id, u); onUpdated() }}
            onClose={() => setShowAdsetEdit(false)} />
        </td></tr>
      )}
    </>
  )
}

/* ── 정렬 헤더 버튼 ── */
function SortTh({ label, colKey, sortCol, sortDir, onSort, className = '', align = 'right' }) {
  const active = sortCol === colKey
  const justify = align === 'left' ? 'justify-start' : 'justify-end'
  return (
    <th
      className={`py-3 font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors group ${className}`}
      onClick={() => onSort(colKey)}
    >
      <span className={`flex items-center gap-1 ${justify}`}>
        {label}
        {active
          ? sortDir === 'desc'
            ? <Icon icon="uil:arrow-down" width={12} height={12} className="text-[#7AB51D] shrink-0" />
            : <Icon icon="uil:arrow-up" width={12} height={12} className="text-[#7AB51D] shrink-0" />
          : <Icon icon="uil:sort" width={11} height={11} className="text-gray-300 group-hover:text-gray-400 shrink-0" />}
      </span>
    </th>
  )
}

/* ── 메인 ── */
export default function PerformanceData() {
  const [adsets, setAdsets] = useState([])
  const [hypotheses, setHypotheses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('avg_ipm')
  const [sortDir, setSortDir] = useState('desc')
  const [monthFilter, setMonthFilter] = useState('전체')
  const [mediaFilterKeys, setMediaFilterKeys] = useState([])
  const [resolutionFilterKeys, setResolutionFilterKeys] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const csvInputRef = useRef(null)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [csvInitialFile, setCsvInitialFile] = useState(null)

  const adFilters = { mediaKeys: mediaFilterKeys, resolutionKeys: resolutionFilterKeys }

  const toggleMediaFilter = (key) => {
    if (key === '전체') { setMediaFilterKeys([]); return }
    setMediaFilterKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }
  const toggleResolutionFilter = (key) => {
    if (key === '전체') { setResolutionFilterKeys([]); return }
    setResolutionFilterKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  const closeCsvModal = () => {
    setCsvModalOpen(false)
    setCsvInitialFile(null)
  }

  const load = useCallback(async () => {
    setLoading(true); setSelected(new Set())
    try {
      const [a, h] = await Promise.all([fetchAdsetPerformance(), fetchHypotheses()])
      setAdsets(a); setHypotheses(h)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const monthOptions = ['전체', ...Array.from(
    new Set(adsets.map(a => toYM(a.upload_date)).filter(Boolean))
  ).sort().reverse()]

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  let filtered = adsets.filter(a => {
    if (search && !a.adset_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (monthFilter !== '전체' && toYM(a.upload_date) !== monthFilter) return false
    return true
  })

  const numSort = (key) => [...filtered].sort((a, b) =>
    sortDir === 'desc' ? (b[key] || 0) - (a[key] || 0) : (a[key] || 0) - (b[key] || 0)
  )
  const strSort = (key) => [...filtered].sort((a, b) => {
    const va = (a[key] || '').toLowerCase()
    const vb = (b[key] || '').toLowerCase()
    return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb)
  })
  if (sortCol === 'avg_ipm') filtered = numSort('avg_ipm')
  else if (sortCol === 'ad_count') filtered = numSort('ad_count')
  else if (sortCol === 'total_impressions') filtered = numSort('total_impressions')
  else if (sortCol === 'total_installs') filtered = numSort('total_installs')
  else if (sortCol === 'total_cost') filtered = numSort('total_cost')
  else if (sortCol === 'avg_ecpi') filtered = numSort('avg_ecpi')
  else if (sortCol === 'adset_name') filtered = strSort('adset_name')

  const filteredIds = filtered.map(a => a.id)
  const allChecked = filteredIds.length > 0 && filteredIds.every(id => selected.has(id))
  const someChecked = filteredIds.some(id => selected.has(id))
  const toggleAll = () => {
    if (allChecked) setSelected(p => { const n = new Set(p); filteredIds.forEach(id => n.delete(id)); return n })
    else setSelected(p => new Set([...p, ...filteredIds]))
  }
  const toggleOne = (id) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      for (const t of adsets.filter(a => selected.has(a.id))) {
        await deleteAdsByAdset(t.adset_name)
        await deleteAdsetPerformance(t.id)
      }
      await load()
    } catch (e) { console.error(e) }
    finally { setBulkDeleting(false); setBulkDeleteConfirm(false) }
  }

  const hasAdFilter = mediaFilterKeys.length > 0 || resolutionFilterKeys.length > 0
  const selectedCount = [...selected].filter(id => filteredIds.includes(id)).length

  return (
    <div className="space-y-4">
      {/* 필터 바 — 상단 (좌: 검색·기간 / 우: 선택삭제·CSV) */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="relative">
            <Icon icon="uil:search" width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Ad Set명 검색..."
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20 w-48" />
          </div>
          <div className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-2.5 py-2 bg-white">
            <Icon icon="uil:calendar-alt" width={13} height={13} className="text-gray-400 shrink-0" />
            <select value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setSelected(new Set()) }}
              className="text-sm focus:outline-none bg-transparent">
              {monthOptions.map(m => <option key={m} value={m}>{m === '전체' ? '전체 기간' : ymLabel(m)}</option>)}
            </select>
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">Ad Set {filtered.length}개</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
          {someChecked && (
            <>
              <span className="text-sm text-red-500 font-medium">{selectedCount}개 선택됨</span>
              <button onClick={() => setBulkDeleteConfirm(true)} disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors">
                {bulkDeleting ? <Icon icon="uil:sync" width={14} height={14} className="animate-spin" /> : <Icon icon="uil:trash-alt" width={14} height={14} />} 선택 삭제
              </button>
              <button onClick={() => setSelected(new Set())}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 cursor-pointer">
                해제
              </button>
            </>
          )}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setCsvInitialFile(f)
              setCsvModalOpen(true)
            }}
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 bg-white text-gray-700 hover:border-[#7AB51D]/50 hover:bg-[#F0F7E6]/50 transition-colors cursor-pointer"
          >
            <Icon icon="uil:upload" width={14} height={14} />
            CSV 업로드
          </button>
        </div>
      </div>

      {csvModalOpen && csvInitialFile && (
        <div className="fixed inset-0 z-[70] flex justify-end p-4 pointer-events-auto">
          <button type="button" className="absolute inset-0 bg-black/40 cursor-default" aria-label="닫기" onClick={closeCsvModal} />
          <div className="relative z-10 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl border border-gray-200 shadow-2xl flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white rounded-t-2xl">
              <p className="text-sm font-bold text-gray-800">CSV 업로드</p>
              <button type="button" onClick={closeCsvModal} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer">
                <Icon icon="uil:times" width={18} height={18} />
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <CsvUpload
                key={`${csvInitialFile.name}-${csvInitialFile.size}-${csvInitialFile.lastModified}`}
                initialFile={csvInitialFile}
                onSaved={() => {
                  load()
                  closeCsvModal()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Ad 레벨 필터 */}
      <div className={`flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${hasAdFilter ? 'border-[#7AB51D]/20 bg-[#F0F7E6]/60' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mr-1">
          <Icon icon="uil:filter" width={12} height={12} /> Ad 필터
        </div>

        {/* 미디어 (다중 선택, 전체=선택 없음) */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-400">미디어</span>
          <button type="button" onClick={() => toggleMediaFilter('전체')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              mediaFilterKeys.length === 0 ? 'bg-[#7AB51D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            전체
          </button>
          {['비디오', '이미지'].map(m => (
            <button key={m} type="button" onClick={() => toggleMediaFilter(m)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                mediaFilterKeys.includes(m)
                  ? m === '비디오' ? 'bg-purple-500 text-white ring-2 ring-purple-300 ring-offset-1' : 'bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-1'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {m}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* 해상도 (다중 선택) */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-400">해상도</span>
          <button type="button" onClick={() => toggleResolutionFilter('전체')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              resolutionFilterKeys.length === 0 ? 'bg-[#7AB51D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            전체
          </button>
          {[...RESOLUTIONS, '통합'].map(r => (
            <button key={r} type="button" onClick={() => toggleResolutionFilter(r)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                r !== '통합' ? 'font-mono' : ''
              } ${
                resolutionFilterKeys.includes(r)
                  ? 'bg-[#7AB51D] text-white ring-2 ring-[#7AB51D]/40 ring-offset-1'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {r}
            </button>
          ))}
        </div>

        {hasAdFilter && (
          <button type="button" onClick={() => { setMediaFilterKeys([]); setResolutionFilterKeys([]) }}
            className="ml-auto text-xs text-[#7AB51D] hover:underline cursor-pointer">
            필터 초기화
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wide">
                <th className="pl-4 pr-2 py-3 w-10 align-middle">
                  <input type="checkbox" checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-red-500 cursor-pointer"
                    title={allChecked ? '전체 해제' : '전체 선택'} />
                </th>
                <SortTh label="Ad Set명" colKey="adset_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="left" className="text-left px-3 py-3 w-[240px] max-w-[240px]" />
                <SortTh label="AD 수" colKey="ad_count" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right py-3 pl-1 pr-3 whitespace-nowrap w-16" />
                <SortTh label="평균 IPM" colKey="avg_ipm" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right px-4 w-24" />
                <SortTh label="총 노출" colKey="total_impressions" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right px-4 w-24" />
                <SortTh label="총 설치" colKey="total_installs" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right px-4 w-24" />
                <SortTh label="총 비용" colKey="total_cost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right px-4 w-24" />
                <SortTh label="eCPI" colKey="avg_ecpi" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="text-right px-4 w-20" />
                <th className="text-left px-4 py-3 font-semibold w-44">연결된 가설</th>
                <th className="text-left px-4 py-3 font-semibold w-24">집행일</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={11} className="py-20 text-center text-gray-400"><Icon icon="uil:sync" width={22} height={22} className="animate-spin mx-auto mb-2" /> 로딩 중...</td></tr>
                : filtered.length === 0
                  ? <tr><td colSpan={11} className="py-20 text-center text-gray-400">{adsets.length === 0 ? 'CSV를 업로드하면 성과 데이터가 여기에 표시됩니다.' : '검색 결과가 없습니다.'}</td></tr>
                  : filtered.map(adset => (
                    <AdSetRow key={adset.id} adset={adset} hypotheses={hypotheses}
                      checked={selected.has(adset.id)} onCheck={toggleOne}
                      onDeleted={load} onUpdated={load}
                      adFilters={adFilters} />
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {bulkDeleteConfirm && (
        <DeleteConfirmModal
          message={`${selectedCount}개 Ad Set을 삭제하시겠습니까?`}
          detail="선택된 Ad Set 및 하위 모든 Ad 데이터가 영구 삭제됩니다."
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
