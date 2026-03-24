import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { parseCsvFile, aggregateByAdset } from '../lib/csvParser'
import { fetchHypotheses, insertAdPerformance, upsertAdsetPerformance, updateHypothesis } from '../lib/supabase'

// ── IPM 변화 계산 ─────────────────────────────────────────
function buildHypChanges(adsets, hypotheses) {
  const hypMap = {}
  for (const grp of adsets) {
    if (!grp.hypothesis_id) continue
    if (!hypMap[grp.hypothesis_id]) hypMap[grp.hypothesis_id] = []
    if (grp.avg_ipm != null) hypMap[grp.hypothesis_id].push(grp.avg_ipm)
  }

  return Object.entries(hypMap).map(([hId, ipms]) => {
    const hyp = hypotheses.find(h => h.id === hId)
    if (!hyp) return null

    const newIpm = ipms.length > 0
      ? parseFloat((ipms.reduce((a, b) => a + b, 0) / ipms.length).toFixed(2))
      : null

    return {
      id: hId,
      title: hyp.title,
      category: hyp.category,
      prevIpm: hyp.ipm_test,
      newIpm,
      prevVerdict: hyp.verdict,
      newVerdict: hyp.verdict,
      prevStatus: hyp.status,
    }
  }).filter(Boolean)
}

// ── 판정 설정 ──────────────────────────────────────────────
const VERDICT_CONFIG = {
  '✅ 채택': { icon: 'uil:check-circle', label: '채택', cls: 'bg-green-100 text-green-700 border border-green-200' },
  '❌ 기각': { icon: 'uil:times-circle', label: '기각', cls: 'bg-red-100 text-red-600 border border-red-100' },
  '⏳ 재검증': { icon: 'uil:clock', label: '재검증', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  '⬜ 미집행': { icon: 'uil:minus-circle', label: '미집행', cls: 'bg-gray-100 text-gray-400 border border-gray-200' },
}

function VerdictChip({ v }) {
  const cfg = VERDICT_CONFIG[v] || VERDICT_CONFIG['⬜ 미집행']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      <Icon icon={cfg.icon} width={10} height={10} />
      {cfg.label}
    </span>
  )
}

// ── IPM 차이 표시 ──────────────────────────────────────────
function IpmDelta({ prev, next }) {
  if (next == null) return <span className="text-gray-300 text-xs">—</span>
  const diff = prev != null ? next - prev : null
  const color = diff == null ? 'text-gray-600' : diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'
  return (
    <div className="flex items-center gap-1.5">
      {prev != null && (
        <>
          <span className="text-gray-400 text-xs">{prev.toFixed(1)}</span>
          <Icon icon="uil:arrow-right" width={11} height={11} className="text-gray-300" />
        </>
      )}
      <span className={`font-bold text-sm ${color}`}>{next.toFixed(1)}</span>
      {diff != null && diff !== 0 && (
        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${color}`}>
          {diff > 0 ? <Icon icon="uil:trending-up" width={10} height={10} /> : <Icon icon="uil:arrow-down" width={10} height={10} />}
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}
        </span>
      )}
    </div>
  )
}

// ── 매칭 뱃지 ────────────────────────────────────────────
function MatchBadge({ status }) {
  if (status === 'matched') return <span className="inline-flex items-center gap-1 text-xs text-green-600"><Icon icon="uil:check-circle" width={12} height={12} />매칭됨</span>
  if (status === 'no_hypothesis') return <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><Icon icon="uil:exclamation-triangle" width={12} height={12} />가설 없음</span>
  return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Icon icon="uil:minus" width={12} height={12} />일반 소재</span>
}

// ── 가설 변화 미리보기 패널 ───────────────────────────────
function HypothesisChangePanel({ changes }) {
  const [open, setOpen] = useState(true)
  if (!changes.length) return null

  const verdictChanged = changes.filter(c => c.prevVerdict !== c.newVerdict).length

  return (
    <div className="bg-white rounded-xl border border-[#7AB51D]/30 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#F0F7E6]/50 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {open ? <Icon icon="uil:angle-down" width={15} height={15} className="text-[#7AB51D]" /> : <Icon icon="uil:angle-right" width={15} height={15} className="text-[#7AB51D]" />}
          <span className="text-sm font-bold text-gray-800">가설 DB 업데이트 예정</span>
          <span className="text-xs bg-blue-100 text-[#4A7010] font-semibold px-2 py-0.5 rounded-full">
            {changes.length}개 가설
          </span>
          {verdictChanged > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
              판정 변경 {verdictChanged}건
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">저장 시 자동 반영됩니다</span>
      </button>

      {open && (
        <div className="border-t border-blue-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F0F7E6]/60 text-[11px] text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-semibold w-16">ID</th>
                <th className="text-left px-4 py-2.5 font-semibold">가설명</th>
                <th className="text-center px-4 py-2.5 font-semibold w-32">IPM</th>
                <th className="text-center px-4 py-2.5 font-semibold w-40">판정</th>
                <th className="text-center px-4 py-2.5 font-semibold w-24">상태 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changes.map(c => {
                const verdictChanged = c.prevVerdict !== c.newVerdict
                return (
                  <tr key={c.id} className={verdictChanged ? 'bg-amber-50/40' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#3B82F6]">{c.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700 leading-snug line-clamp-2">{c.title}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <IpmDelta prev={c.prevIpm} next={c.newIpm} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {verdictChanged ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <VerdictChip v={c.prevVerdict || '⬜ 미집행'} />
                          <Icon icon="uil:arrow-right" width={11} height={11} className="text-gray-400 shrink-0" />
                          <VerdictChip v={c.newVerdict} />
                        </div>
                      ) : (
                        c.newVerdict ? <VerdictChip v={c.newVerdict} /> : <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.prevStatus === '미집행' ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[10px] text-gray-400">미집행</span>
                          <Icon icon="uil:arrow-right" width={10} height={10} className="text-gray-300" />
                          <span className="text-[10px] text-blue-600 font-semibold">집행중</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">{c.prevStatus}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 상세 Ad 테이블 ────────────────────────────────────────
function AdTable({ rows, hypotheses, onUpdateRow }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {open ? <Icon icon="uil:angle-down" width={15} height={15} className="text-gray-400" /> : <Icon icon="uil:angle-right" width={15} height={15} className="text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700">개별 Ad 상세</span>
          <span className="text-xs text-gray-400 font-normal">{rows.length}건</span>
        </div>
        <span className="text-xs text-gray-400">{open ? '접기' : '펼치기'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-semibold">소재명</th>
                <th className="text-center px-3 py-2.5 font-semibold w-24">가설 ID</th>
                <th className="text-right px-4 py-2.5 font-semibold w-18">IPM</th>
                <th className="text-right px-4 py-2.5 font-semibold w-22">노출</th>
                <th className="text-right px-4 py-2.5 font-semibold w-18">설치</th>
                <th className="text-center px-3 py-2.5 font-semibold w-24">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50/20 ${row.matchStatus === 'general' ? 'opacity-55' : ''}`}>
                  <td className="px-4 py-2 font-mono text-[11px] text-gray-700 max-w-[260px] truncate" title={row.ad_name}>{row.ad_name}</td>
                  <td className="px-3 py-2 text-center">
                    {row.matchStatus === 'no_hypothesis' ? (
                      <select
                        value={row.hypothesis_id || ''}
                        onChange={e => onUpdateRow(i, e.target.value)}
                        className="border border-gray-300 rounded px-1.5 py-0.5 text-[11px] w-full cursor-pointer"
                      >
                        <option value="">— 선택 —</option>
                        {hypotheses.map(h => <option key={h.id} value={h.id}>{h.id}</option>)}
                      </select>
                    ) : row.hypothesis_id ? (
                      <span className="font-mono text-[11px] font-bold text-[#3B82F6]">{row.hypothesis_id}</span>
                    ) : <span className="text-gray-300 text-[11px]">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[11px]">{row.ipm.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-[11px]">{row.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-[11px]">{row.installs.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center"><MatchBadge status={row.matchStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function CsvUpload({ onSaved, initialFile = null }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [adsets, setAdsets] = useState([])
  const [hypChanges, setHypChanges] = useState([])
  const [hypotheses, setHypotheses] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [opts, setOpts] = useState({ matchHypothesis: true, saveAds: true })
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const fileRef = useRef()

  useEffect(() => { fetchHypotheses().then(setHypotheses).catch(console.error) }, [])

  const process = async (file) => {
    if (!file?.name.endsWith('.csv')) { setError('CSV 파일만 업로드 가능합니다.'); return }
    setError(''); setSaved(false); setFileName(file.name)
    try {
      let hypList = hypotheses
      if (!hypList?.length) {
        hypList = await fetchHypotheses()
        setHypotheses(hypList)
      }
      const { rows: parsed } = await parseCsvFile(file)
      const withStatus = parsed.map(r => {
        let matchStatus = r.matchStatus
        if (matchStatus === 'matched') {
          const exists = hypList.find(h => h.id === r.hypothesis_id)
          if (!exists) matchStatus = 'no_hypothesis'
        }
        return { ...r, matchStatus }
      })
      const agg = aggregateByAdset(withStatus)
      setRows(withStatus)
      setAdsets(agg)
      setHypChanges(buildHypChanges(agg, hypList))
    } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    if (initialFile) process(initialFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialFile만 반응
  }, [initialFile])

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); process(e.dataTransfer.files[0]) }
  const onInput = (e) => { process(e.target.files[0]) }

  const updateRowHyp = (i, hypId) => {
    const next = rows.map((r, idx) => idx !== i ? r : {
      ...r, hypothesis_id: hypId,
      matchStatus: hypId ? 'matched' : 'general',
    })
    const agg = aggregateByAdset(next)
    setRows(next)
    setAdsets(agg)
    setHypChanges(buildHypChanges(agg, hypotheses))
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const today = new Date().toISOString().split('T')[0]
      const from = dateFrom || today
      const to = dateTo || today

      if (opts.saveAds) {
        const toInsert = rows
          .filter(r => r.ad_name)
          .map(r => ({
            adset_name: r.adset_name, ad_name: r.ad_name,
            asset_type: r.asset_type, media_type: r.media_type, resolution: r.resolution,
            hypothesis_id: r.hypothesis_id || null,
            ipm: r.ipm, impressions: r.impressions, clicks: r.clicks,
            installs: r.installs, cost: r.cost, ecpi: r.ecpi,
            active_users: r.active_users, revenue: r.revenue, roas: r.roas,
            af_login: r.af_login, af_tutorial_completion: r.af_tutorial_completion,
            upload_date: from,
          }))
        if (toInsert.length > 0) await insertAdPerformance(toInsert)
      }

      if (opts.matchHypothesis) {
        const adsetRows = adsets.map(grp => ({
          adset_name: grp.adset_name, hypothesis_id: grp.hypothesis_id || null,
          avg_ipm: grp.avg_ipm, total_impressions: grp.total_impressions,
          total_installs: grp.total_installs, total_cost: grp.total_cost,
          avg_ecpi: grp.avg_ecpi, ad_count: grp.ad_count, upload_date: from,
        }))
        if (adsetRows.length > 0) await upsertAdsetPerformance(adsetRows)

        for (const c of hypChanges) {
          const hyp = hypotheses.find(h => h.id === c.id)
          if (!hyp) continue
          const updates = {}
          if (c.newIpm != null) updates.ipm_test = c.newIpm
          if (hyp.status === '미집행') updates.status = '집행중'
          if (from && !hyp.start_date) updates.start_date = from
          if (to) updates.end_date = to
          await updateHypothesis(c.id, updates)
        }
      }

      setSaved(true)
      onSaved?.()
    } catch (e) { setError('저장 오류: ' + e.message) }
    finally { setSaving(false) }
  }

  const reset = () => {
    setRows([]); setAdsets([]); setHypChanges([]); setFileName('')
    setSaved(false); setError(''); setDateFrom(''); setDateTo('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const matchedCount = rows.filter(r => r.matchStatus === 'matched').length
  const generalCount = rows.filter(r => r.matchStatus === 'general').length
  const noHypCount = rows.filter(r => r.matchStatus === 'no_hypothesis').length

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* 드롭존 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-[#7AB51D] bg-blue-50 scale-[1.01]'
            : rows.length > 0
              ? 'border-green-300 bg-green-50/30'
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50/50'
        }`}
        onClick={() => !rows.length && fileRef.current?.click()}
      >
        {rows.length > 0 ? (
          <div className="flex items-center justify-center gap-3">
            <Icon icon="uil:check-circle" width={24} height={24} className="text-green-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-green-700">파일 로드 완료: {fileName}</p>
              <p className="text-xs text-green-600 mt-0.5">총 {rows.length}건 · 가설 매칭 {matchedCount}건</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); reset() }}
              className="ml-4 px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
            >
              다른 파일
            </button>
          </div>
        ) : (
          <>
            <Icon icon="uil:upload" width={36} height={36} className={`mx-auto mb-3 ${dragOver ? 'text-[#3B82F6]' : 'text-gray-300'}`} />
            <p className="text-gray-600 font-semibold mb-1">
              AppsFlyer에서 다운로드한 CSV 파일을 여기에 드롭하세요
            </p>
            <p className="text-gray-400 text-sm mb-1">또는 클릭해서 파일 선택</p>
            <p className="text-xs text-gray-300">소재명(Ad Name) 기준으로 가설 ID를 자동 인식합니다</p>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv" onChange={onInput} className="hidden" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Icon icon="uil:exclamation-triangle" width={15} height={15} /> {error}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Icon icon="uil:check-circle" width={15} height={15} /> 저장 완료! 가설 DB에서 IPM 및 판정을 확인하세요.
        </div>
      )}

      {rows.length > 0 && !saved && (
        <>
          {/* 옵션 & 기간 & 저장 버튼 */}
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input type="checkbox" checked={opts.matchHypothesis}
                onChange={e => setOpts(o => ({ ...o, matchHypothesis: e.target.checked }))}
                className="w-4 h-4 accent-[#7AB51D]" />
              가설 DB에 IPM / 판정 자동 업데이트
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
              <input type="checkbox" checked={opts.saveAds}
                onChange={e => setOpts(o => ({ ...o, saveAds: e.target.checked }))}
                className="w-4 h-4 accent-[#7AB51D]" />
              개별 Ad 성과 저장 (성과 데이터 탭)
            </label>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-xs text-gray-400 font-medium">집행 기간</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20" />
              <span className="text-xs text-gray-400">~</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20" />
            </div>

            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#7AB51D] hover:bg-[#6A9E18] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-sm">
              {saving ? <Icon icon="uil:sync" width={15} height={15} className="animate-spin" /> : <Icon icon="uil:save" width={15} height={15} />}
              {saving ? '저장 중...' : 'DB에 저장'}
            </button>
          </div>

          {/* 요약 통계 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-gray-800">{rows.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">총 Ad 수</div>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-200 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-green-700">{matchedCount}</div>
              <div className="text-xs text-green-600 mt-0.5">가설 매칭됨</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
              <div className="text-2xl font-bold text-gray-500">{generalCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">일반 소재</div>
            </div>
          </div>

          {/* 가설 변화 미리보기 */}
          {opts.matchHypothesis && hypChanges.length > 0 && (
            <HypothesisChangePanel changes={hypChanges} />
          )}

          {/* 가설 매핑 없음 안내 */}
          {opts.matchHypothesis && hypChanges.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
              <Icon icon="uil:info-circle" width={14} height={14} className="shrink-0" />
              소재명에서 가설 ID를 인식하지 못했습니다. 아래 상세 테이블에서 가설을 수동 매핑하세요.
            </div>
          )}

          {/* 개별 Ad 상세 (접기 가능) */}
          <AdTable rows={rows} hypotheses={hypotheses} onUpdateRow={updateRowHyp} />
        </>
      )}
    </div>
  )
}
