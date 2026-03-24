import { useState, useEffect, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { fetchHypotheses } from '../lib/supabase'
import HypothesisPanel from './HypothesisPanel'
import HypothesisModal from './HypothesisModal'
import ConfluenceImport from './ConfluenceImport'

const CATEGORIES = ['전체', 'Phase 0: Control', 'Phase 1: Hook', 'Phase 2: Body', 'Phase 3: CTA', 'Phase 4: Final', 'Phase 5: Scale', '기타']

const VERDICT_TABS = [
  { label: '전체', value: '전체', icon: null, iconColor: '' },
  { label: '채택', value: '✅ 채택', icon: 'uil:check-circle', iconColor: 'text-green-600' },
  { label: '기각', value: '❌ 기각', icon: 'uil:times-circle', iconColor: 'text-red-500' },
  { label: '재검증', value: '⏳ 재검증', icon: 'uil:clock', iconColor: 'text-amber-500' },
  { label: '미집행', value: '⬜ 미집행', icon: 'uil:minus-circle', iconColor: 'text-gray-400' },
]

// ── 판정·상태 설정 ──
export const VERDICT_CONFIG = {
  '✅ 채택': { icon: 'uil:check-circle', label: '채택', cls: 'bg-green-100 text-green-700 border border-green-200' },
  '❌ 기각': { icon: 'uil:times-circle', label: '기각', cls: 'bg-red-100 text-red-600 border border-red-100' },
  '⏳ 재검증': { icon: 'uil:clock', label: '재검증', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  '⬜ 미집행': { icon: 'uil:minus-circle', label: '미집행', cls: 'bg-gray-100 text-gray-400 border border-gray-200' },
}

export const RELIABILITY_CONFIG = {
  '🟢 높음': { icon: 'uil:check-circle', label: '높음', iconCls: 'text-green-500' },
  '🟡 보통': { icon: 'uil:minus-circle', label: '보통', iconCls: 'text-amber-500' },
  '🔴 낮음': { icon: 'uil:exclamation-circle', label: '낮음', iconCls: 'text-red-500' },
  '⬜ 미검토': { icon: 'uil:circle', label: '미검토', iconCls: 'text-gray-300' },
}

export function VerdictBadge({ verdict }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG['⬜ 미집행']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      <Icon icon={cfg.icon} width={11} height={11} />
      {cfg.label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const cfg = {
    '미집행': { icon: 'uil:clock', label: '미집행', cls: 'bg-gray-100 text-gray-500' },
    '집행중': { icon: 'uil:play-circle', label: '집행중', cls: 'bg-[#F0F7E6] text-[#7AB51D]' },
    '완료': { icon: 'uil:check-circle', label: '완료', cls: 'bg-green-100 text-green-700' },
  }[status] || { icon: 'uil:clock', label: status || '미집행', cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      <Icon icon={cfg.icon} width={11} height={11} />
      {cfg.label}
    </span>
  )
}

function IpmCell({ ipmTest }) {
  if (ipmTest == null) return <span className="text-gray-300">—</span>
  return (
    <div className="flex items-center justify-end">
      <span className="font-mono font-bold text-gray-800">{Number(ipmTest).toFixed(2)}</span>
    </div>
  )
}

function CatChip({ cat }) {
  const colors = {
    'Phase 0: Control': 'bg-gray-100 text-gray-600',
    'Phase 1: Hook': 'bg-blue-50 text-blue-600',
    'Phase 2: Body': 'bg-purple-50 text-purple-600',
    'Phase 3: CTA': 'bg-amber-50 text-amber-600',
    'Phase 4: Final': 'bg-green-50 text-green-700',
    'Phase 5: Scale': 'bg-pink-50 text-pink-600',
    '기타': 'bg-gray-100 text-gray-500',
  }
  const short = cat ? cat.replace(/^Phase \d: /, '') : '—'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${colors[cat] || 'bg-gray-100 text-gray-400'}`}>
      {short}
    </span>
  )
}

// ── 요약 통계 바 ──
function SummaryBar({ hypotheses }) {
  const total = hypotheses.length
  const adopted = hypotheses.filter(h => h.verdict === '✅ 채택').length
  const rate = total > 0 ? Math.round(adopted / total * 100) : 0
  const ipms = hypotheses.filter(h => h.ipm_test != null).map(h => Number(h.ipm_test))
  const avg = ipms.length > 0 ? (ipms.reduce((a, b) => a + b, 0) / ipms.length).toFixed(1) : '—'
  const best = hypotheses.reduce((b, h) => (!b || (h.ipm_test || 0) > (b.ipm_test || 0)) ? h : b, null)

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {[
        { label: '총 가설', value: `${total}개`, sub: '등록됨', color: 'border-gray-200 bg-white' },
        { label: '채택률', value: `${rate}%`, sub: `${adopted}/${total} 채택`, color: 'border-green-200 bg-green-50' },
        { label: '평균 IPM', value: avg, sub: '전체 소재 평균', color: 'border-gray-200 bg-white' },
        { label: '최고 IPM', value: best?.ipm_test != null ? Number(best.ipm_test).toFixed(1) : '—', sub: best?.id || '—', color: 'border-[#7AB51D]/30 bg-[#F0F7E6]' },
      ].map(s => (
        <div key={s.label} className={`rounded-2xl border px-4 py-3 shadow-sm ${s.color}`}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-0.5">{s.label}</p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">{s.value}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── 아코디언 확장 행 ──
function ExpandedRow({ h }) {
  return (
    <tr className="bg-[#F0F7E6]/40 border-b border-[#7AB51D]/10">
      <td colSpan={7} className="px-6 py-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3 bg-white rounded-xl px-4 py-3 border border-[#7AB51D]/20">
            <p className="text-[10px] font-bold text-[#7AB51D] uppercase mb-1">가설 정제 문장</p>
            <p className="text-sm text-gray-700 leading-relaxed">{h.hypothesis || '—'}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-[#7AB51D]/20">
            <p className="text-[10px] font-bold text-[#7AB51D] uppercase mb-2">핵심 수치</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 text-xs">IPM</span>
              <span className="font-mono font-bold text-gray-800">
                {h.ipm_test != null ? Number(h.ipm_test).toFixed(2) : '—'}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-[#7AB51D]/20">
            <p className="text-[10px] font-bold text-[#7AB51D] uppercase mb-1">왜 이겼는가</p>
            <p className="text-xs text-gray-600 leading-relaxed">{h.win_reason || '—'}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-[#7AB51D]/20">
            <p className="text-[10px] font-bold text-[#7AB51D] uppercase mb-1">다음 시드 가설</p>
            <p className="text-xs text-gray-600 leading-relaxed">{h.next_seed || '—'}</p>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── 메인 ──
export default function HypothesisDB() {
  const [hypotheses, setHypotheses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('전체')
  const [verdictFilter, setVerdictFilter] = useState('전체')
  const [sortCol, setSortCol] = useState('ipm_test')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedId, setExpandedId] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [modalHyp, setModalHyp] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setHypotheses(await fetchHypotheses()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  let filtered = hypotheses.filter(h => {
    if (catFilter !== '전체' && h.category !== catFilter) return false
    if (verdictFilter !== '전체' && (h.verdict || '⬜ 미집행') !== verdictFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return [h.id, h.title, h.hypothesis].some(f => (f || '').toLowerCase().includes(q))
    }
    return true
  })

  if (sortCol === 'ipm_test') {
    filtered = [...filtered].sort((a, b) =>
      sortDir === 'desc'
        ? (b.ipm_test ?? -Infinity) - (a.ipm_test ?? -Infinity)
        : (a.ipm_test ?? Infinity) - (b.ipm_test ?? Infinity)
    )
  }

  // 탭별 카운트
  const counts = VERDICT_TABS.reduce((acc, t) => {
    acc[t.value] = t.value === '전체'
      ? hypotheses.length
      : hypotheses.filter(h => (h.verdict || '⬜ 미집행') === t.value).length
    return acc
  }, {})

  const openAdd = () => { setEditing(null); setPanelOpen(true) }
  const openEdit = (h, e) => { e.stopPropagation(); setEditing(h); setPanelOpen(true) }
  const openModal = (h, e) => { e.stopPropagation(); setModalHyp(h) }
  const onSaved = () => { setPanelOpen(false); setEditing(null); load() }
  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  return (
    <div>
      {/* 요약 통계 바 */}
      {!loading && <SummaryBar hypotheses={hypotheses} />}

      {/* 상단 컨트롤 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* 퀵 필터 탭 */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {VERDICT_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setVerdictFilter(t.value)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                verdictFilter === t.value
                  ? 'bg-white shadow-sm text-gray-800'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon && (
                <Icon icon={t.icon} width={11} height={11}
                  className={verdictFilter === t.value ? t.iconColor : 'text-gray-400'} />
              )}
              {t.label}
              <span className={`ml-0.5 ${verdictFilter === t.value ? 'text-[#7AB51D]' : 'text-gray-400'}`}>
                {counts[t.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 검색 */}
          <div className="relative">
            <Icon icon="uil:search" width={14} height={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ID·가설명 검색"
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20 focus:border-[#7AB51D] w-40"
            />
          </div>
          {/* Phase 필터 */}
          <div className="relative">
            <select
              value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20 bg-white text-gray-600 cursor-pointer"
            >
              {CATEGORIES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Icon icon="uil:angle-down" width={14} height={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-400">{filtered.length}건</span>

          {/* 버튼 */}
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 border border-[#7AB51D] text-[#7AB51D] hover:bg-[#F0F7E6] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Icon icon="uil:file-alt" width={13} height={13} /> 기획안 가져오기
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-[#7AB51D] hover:bg-[#6A9E18] text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Icon icon="uil:plus" width={13} height={13} /> 새 가설
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-400 uppercase tracking-wide">
                <th className="text-center px-4 py-3 font-semibold w-28">판정</th>
                <th className="text-left px-3 py-3 font-semibold w-16">ID</th>
                <th className="text-left px-4 py-3 font-semibold max-w-[260px]">가설명</th>
                <th className="text-center px-3 py-3 font-semibold w-32">Phase</th>
                <th
                  className="text-right px-4 py-3 font-semibold w-24 cursor-pointer hover:bg-gray-100 select-none transition-colors group"
                  onClick={() => handleSort('ipm_test')}
                >
                  <span className="flex items-center justify-end gap-1">
                    IPM
                    {sortCol === 'ipm_test'
                      ? sortDir === 'desc' ? <Icon icon="uil:arrow-down" width={11} height={11} className="text-[#7AB51D]" /> : <Icon icon="uil:arrow-up" width={11} height={11} className="text-[#7AB51D]" />
                      : <Icon icon="uil:sort" width={11} height={11} className="text-gray-300 group-hover:text-gray-400" />}
                  </span>
                </th>
                <th className="text-center px-3 py-3 font-semibold w-16">상태</th>
                <th className="text-left px-3 py-3 font-semibold w-[7.5rem]">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-20 text-center text-gray-400">
                  <Icon icon="uil:sync" width={22} height={22} className="animate-spin mx-auto mb-2" />
                  <p className="text-sm">로딩 중...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-20 text-center text-gray-400">
                  {hypotheses.length === 0 ? '가설이 없습니다. 새 가설을 추가해보세요.' : '검색 결과가 없습니다.'}
                </td></tr>
              ) : filtered.map(h => {
                const isExpanded = expandedId === h.id
                return [
                  <tr
                    key={h.id}
                    onClick={() => toggleExpand(h.id)}
                    className={`border-b border-gray-100 transition-colors cursor-pointer group ${isExpanded ? 'bg-[#F0F7E6]/40 border-[#7AB51D]/10' : 'hover:bg-gray-50/80'}`}
                  >
                    {/* 판정 */}
                    <td className="px-4 py-3 text-center">
                      <VerdictBadge verdict={h.verdict} />
                    </td>
                    {/* ID */}
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs font-bold text-[#7AB51D]">{h.id}</span>
                    </td>
                    {/* 가설명 */}
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 leading-snug line-clamp-2">{h.title}</span>
                        {isExpanded
                          ? <Icon icon="uil:angle-up" width={14} height={14} className="text-[#7AB51D] shrink-0" />
                          : <Icon icon="uil:angle-down" width={14} height={14} className="text-gray-300 group-hover:text-gray-400 shrink-0" />
                        }
                      </div>
                    </td>
                    {/* 카테고리 */}
                    <td className="px-3 py-3 text-center">
                      <CatChip cat={h.category} />
                    </td>
                    {/* IPM */}
                    <td className="px-4 py-3">
                      <IpmCell ipmTest={h.ipm_test} />
                    </td>
                    {/* 상태 */}
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={h.status} />
                    </td>
                    {/* 액션: 자세히 보기 · 편집만 */}
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col items-stretch gap-1 min-w-[5.5rem]">
                        <button
                          type="button"
                          title="자세히 보기"
                          onClick={e => openModal(h, e)}
                          className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-600 hover:bg-[#F0F7E6] hover:text-[#5A8C10] cursor-pointer transition-colors"
                        >
                          <Icon icon="uil:eye" width={12} height={12} />
                          자세히 보기
                        </button>
                        <button
                          type="button"
                          title="편집"
                          onClick={e => openEdit(h, e)}
                          className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 cursor-pointer transition-colors"
                        >
                          <Icon icon="uil:pen" width={12} height={12} />
                          편집
                        </button>
                      </div>
                    </td>
                  </tr>,
                  isExpanded && <ExpandedRow key={`${h.id}-exp`} h={h} />,
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>

      {panelOpen && (
        <HypothesisPanel hypothesis={editing} onClose={() => { setPanelOpen(false); setEditing(null) }} onSaved={onSaved} />
      )}
      {modalHyp && (
        <HypothesisModal hypothesis={modalHyp} onClose={() => setModalHyp(null)} onUpdated={load} />
      )}
      {importOpen && (
        <ConfluenceImport onClose={() => setImportOpen(false)} onSaved={load} />
      )}
    </div>
  )
}
