import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'
import { fetchHypotheses } from '../lib/supabase'
import { VerdictBadge } from './HypothesisDB'
import HypothesisModal from './HypothesisModal'

// ─── 상수 ───────────────────────────────────────────
const KPI_IPM = 15  // 26년 우수 소재 기준

const CAT_SHORT = {
  'Phase 0: Control': 'Control',
  'Phase 1: Hook': 'Hook',
  'Phase 2: Body': 'Body',
  'Phase 3: CTA': 'CTA',
  'Phase 4: Final': 'Final',
  'Phase 5: Scale': 'Scale',
  '기타': '기타',
}

// Confluence 기반 학습 인사이트 (채택 가설에서 도출)
const STATIC_INSIGHTS = [
  {
    icon: 'uil:crosshair',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    title: '즉각 보상 시각화 > 서사/설명형',
    desc: 'DUC 유저는 맥락 이해보다 즉각적인 보상(코인 분출·슬롯 당첨) 시각에 반응. 스포츠베팅·슬롯 소재 채택.',
    verdict: '✅ 채택',
    ipm: 16.57,
  },
  {
    icon: 'uil:users-alt',
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    title: '동물(강아지·고양이) > 사람 소재',
    desc: '동물 소재 평균 IPM 7.87 vs 사람 1.97. CTR 기준 4배 차이. 단, 중반 설득 구조 보완 필요.',
    verdict: '✅ 채택',
    ipm: 7.87,
  },
  {
    icon: 'uil:trophy',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'EASY(보상 접근) > FREE(비용 회피)',
    desc: '"이길 수 있다" 보상 기대 프레임이 "공짜" 절약 프레임보다 2.4배 높은 IPM. System 1 반응 유도.',
    verdict: '✅ 채택',
    ipm: 12.44,
  },
  {
    icon: 'uil:lightbulb-alt',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: '메시지 길이보다 정보 가치',
    desc: '무언 소재(8.93)와 가장 긴 메시지(8.63)가 유사. 의미 없는 텍스트 제거가 핵심, 길이 단축이 아님.',
    verdict: '❌ 기각',
    ipm: 8.93,
  },
  {
    icon: 'uil:film',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    title: '영상 > 이미지 (2~3배 차이)',
    desc: '2월 리뷰 기준 세로형(1080×1920) 영상이 일관되게 가장 높은 IPM. 이미지 전략 재평가 필요.',
    verdict: null,
    ipm: null,
  },
  {
    icon: 'uil:calendar-alt',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    title: '시즌 소재는 3주 전 선제 집행',
    desc: '할로윈·크리스마스 모두 기간 내 집행으로 기대감 형성 실패. 시즌 시작 3주 전 집행이 효과적.',
    verdict: '❌ 기각',
    ipm: null,
  },
]

// ─── IPM 구간 색상 ───────────────────────────────────
function ipmColor(ipm) {
  if (ipm == null) return '#D1D5DB'
  if (ipm >= KPI_IPM) return '#22C55E'
  if (ipm >= 10) return '#EAB308'
  return '#EF4444'
}

function ipmLabel(ipm) {
  if (ipm == null) return null
  if (ipm >= KPI_IPM) return { text: '우수', cls: 'text-green-600 bg-green-50 border-green-200' }
  if (ipm >= 10) return { text: '개선가능', cls: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
  return { text: '부적합', cls: 'text-red-500 bg-red-50 border-red-200' }
}

// ─── 커스텀 툴팁 ──────────────────────────────────────
function IpmTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const lbl = ipmLabel(d.ipm)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[180px]">
      <p className="font-bold text-gray-800 mb-1">{d.id} — {d.title}</p>
      <p className="font-mono font-bold text-gray-700 mb-1">IPM {d.ipm?.toFixed(2) ?? '—'}</p>
      {lbl && <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${lbl.cls}`}>{lbl.text}</span>}
    </div>
  )
}

// ─── 메인 대시보드 ───────────────────────────────────
export default function Dashboard() {
  const [hypotheses, setHypotheses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalHyp, setModalHyp] = useState(null)

  useEffect(() => {
    fetchHypotheses().then(setHypotheses).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <Icon icon="uil:sync" width={24} height={24} className="animate-spin mr-3" /> 대시보드 로딩 중...
    </div>
  )

  // ── 통계 계산 ──────────────────────────────────────
  const total = hypotheses.length
  const adopted = hypotheses.filter(h => h.verdict === '✅ 채택').length
  const running = hypotheses.filter(h => h.status === '집행중').length
  const pending = hypotheses.filter(h => h.status === '미집행').length
  const recheck = hypotheses.filter(h => h.verdict === '⏳ 재검증').length
  const adoptionRate = total > 0 ? Math.round(adopted / total * 100) : 0

  const withIpm = hypotheses.filter(h => h.ipm_test != null)
  const kpiHits = withIpm.filter(h => Number(h.ipm_test) >= KPI_IPM).length

  // IPM 분포 차트 데이터 (내림차순 정렬)
  const ipmChartData = [...hypotheses]
    .filter(h => h.ipm_test != null)
    .sort((a, b) => Number(b.ipm_test) - Number(a.ipm_test))
    .map(h => ({
      id: h.id,
      title: h.title,
      ipm: Number(h.ipm_test),
      shortTitle: h.title.length > 14 ? h.title.slice(0, 13) + '…' : h.title,
      verdict: h.verdict,
      raw: h,
    }))

  // Phase별 채택률 차트 데이터
  const catMap = {}
  for (const h of hypotheses) {
    const cat = CAT_SHORT[h.category] || '기타'
    if (!catMap[cat]) catMap[cat] = { adopted: 0, rejected: 0, recheck: 0, pending: 0 }
    const v = h.verdict || '⬜ 미집행'
    if (v === '✅ 채택') catMap[cat].adopted++
    else if (v === '❌ 기각') catMap[cat].rejected++
    else if (v === '⏳ 재검증') catMap[cat].recheck++
    else catMap[cat].pending++
  }
  const catChartData = Object.entries(catMap).map(([cat, d]) => ({ cat, ...d }))

  // 다음 액션 목록
  const actionList = [
    ...hypotheses.filter(h => h.status === '집행중'),
    ...hypotheses.filter(h => h.status === '미집행'),
    ...hypotheses.filter(h => h.verdict === '⏳ 재검증'),
  ].slice(0, 8)

  return (
    <div className="space-y-5">

      {/* ── ① KPI 현황 바 ─────────────────────────── */}
      <div className="bg-gradient-to-r from-[#4A7010] to-[#7AB51D] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-4">
          <Icon icon="uil:crosshair" width={16} height={16} className="opacity-70" />
          <span className="text-xs font-bold uppercase tracking-wide opacity-70">2026 목표 KPI</span>
          <span className="ml-auto text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-semibold">IPM ≥ 15 = 우수 소재</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '총 검증 가설', value: total, sub: '누적 등록', icon: 'uil:flask' },
            { label: 'KPI 달성 소재', value: `${kpiHits}개`, sub: `IPM ≥ ${KPI_IPM} 달성`, icon: 'uil:crosshair' },
            { label: '채택률', value: `${adoptionRate}%`, sub: `${adopted}/${total} 채택`, icon: 'uil:check-circle' },
            { label: '현재 집행중', value: `${running}건`, sub: `미집행 ${pending}건 대기`, icon: 'uil:play' },
          ].map(c => {
            return (
              <div key={c.label} className="bg-white/10 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2 opacity-70">
                  <Icon icon={c.icon} width={12} height={12} />
                  <span className="text-[10px] font-semibold uppercase">{c.label}</span>
                </div>
                <p className="text-2xl font-bold leading-tight">{c.value}</p>
                <p className="text-[11px] opacity-60 mt-0.5">{c.sub}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ② IPM 분포 차트 ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-800">가설별 IPM 분포</h3>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> 우수 ≥{KPI_IPM}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> 개선가능 10~{KPI_IPM}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> 부적합 &lt;10</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">막대 클릭 시 가설 상세 확인 · 빨간 점선 = 26년 KPI 기준</p>
        {ipmChartData.length === 0
          ? <p className="text-gray-400 text-sm text-center py-16">IPM 데이터가 없습니다.</p>
          : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ipmChartData} margin={{ top: 20, right: 16, left: 0, bottom: 60 }}
                onClick={e => { if (e?.activePayload?.[0]?.payload?.raw) setModalHyp(e.activePayload[0].payload.raw) }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="shortTitle" tick={{ fontSize: 10, fill: '#6B7280' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={[0, 'auto']} />
                <Tooltip content={<IpmTooltip />} cursor={{ fill: '#F1F5F9' }} />
                <ReferenceLine y={KPI_IPM} stroke="#EF4444" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: `KPI ${KPI_IPM}`, position: 'insideTopRight', fontSize: 10, fill: '#EF4444', fontWeight: 600 }} />
                <Bar dataKey="ipm" radius={[6, 6, 0, 0]} maxBarSize={40} cursor="pointer">
                  {ipmChartData.map((d, i) => (
                    <Cell key={i} fill={ipmColor(d.ipm)} />
                  ))}
                  <LabelList dataKey="ipm" position="top" formatter={v => v.toFixed(1)} style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>

      {/* ── ③ + ④ 2열 레이아웃 ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ③ 카테고리별 채택률 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1">Phase별 채택 현황</h3>
          <p className="text-xs text-gray-400 mb-4">어떤 Phase에서 인사이트가 많이 나오는가</p>
          {catChartData.length === 0
            ? <p className="text-gray-400 text-sm text-center py-12">데이터 없음</p>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={catChartData} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="cat" tick={{ fontSize: 11, fill: '#6B7280' }} width={68} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="adopted" name="채택" fill="#22C55E" stackId="a" radius={[0, 0, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="recheck" name="재검증" fill="#EAB308" stackId="a" maxBarSize={22} />
                  <Bar dataKey="rejected" name="기각" fill="#EF4444" stackId="a" maxBarSize={22} />
                  <Bar dataKey="pending" name="미집행" fill="#D1D5DB" stackId="a" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="pending" position="right" formatter={(v, entry) => {
                      const row = catChartData.find(d => d.pending === v)
                      const total = row ? row.adopted + row.rejected + row.recheck + row.pending : 0
                      return total > 0 ? total : ''
                    }} style={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          {/* 범례 */}
          <div className="flex gap-3 mt-3 justify-center flex-wrap">
            {[['#22C55E', '✅ 채택'], ['#EAB308', '⏳ 재검증'], ['#EF4444', '❌ 기각'], ['#D1D5DB', '⬜ 미집행']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1 text-[11px] text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ background: c }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* ④ 핵심 인사이트 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1">핵심 인사이트 레포트</h3>
          <p className="text-xs text-gray-400 mb-4">지금까지 검증된 크리에이티브 전략 패턴</p>
          <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 280 }}>
            {STATIC_INSIGHTS.map((ins, i) => (
              <div key={i} className={`flex gap-3 px-3.5 py-3 rounded-xl border ${
                ins.verdict === '✅ 채택' ? 'bg-green-50 border-green-100' :
                ins.verdict === '❌ 기각' ? 'bg-red-50 border-red-100' :
                'bg-gray-50 border-gray-100'
              }`}>
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${ins.iconBg}`}>
                  <Icon icon={ins.icon} width={16} height={16} className={ins.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-xs font-bold text-gray-800">{ins.title}</p>
                    {ins.ipm != null && (
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        ins.ipm >= KPI_IPM ? 'bg-green-100 text-green-700' :
                        ins.ipm >= 10 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        IPM {ins.ipm.toFixed(1)}
                      </span>
                    )}
                    {ins.verdict && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        ins.verdict === '✅ 채택' ? 'text-green-700' : 'text-red-500'
                      }`}>
                        {ins.verdict === '✅ 채택' ? '채택' : '기각'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{ins.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ⑤ 다음 액션 리스트 ─────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">다음 액션 리스트</h3>
            <p className="text-xs text-gray-400 mt-0.5">집행중 · 미집행 · 재검증 필요 가설 — 클릭 시 상세 확인</p>
          </div>
          <div className="flex gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-[#7AB51D]"><Icon icon="uil:play" width={11} height={11} /> 집행중 {running}</span>
            <span className="flex items-center gap-1 text-gray-500"><Icon icon="uil:exclamation-circle" width={11} height={11} /> 미집행 {pending}</span>
            <span className="flex items-center gap-1 text-yellow-600"><Icon icon="uil:redo" width={11} height={11} /> 재검증 {recheck}</span>
          </div>
        </div>

        {actionList.length === 0
          ? <p className="text-gray-400 text-sm text-center py-8">대기 중인 가설이 없습니다.</p>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {actionList.map(h => {
                const isRunning = h.status === '집행중'
                const isRecheck = h.verdict === '⏳ 재검증'
                const borderCls = isRunning ? 'border-[#7AB51D]/30 bg-[#F0F7E6]/60' : isRecheck ? 'border-yellow-200 bg-yellow-50/40' : 'border-gray-200 bg-white'
                const ipm = h.ipm_test != null ? Number(h.ipm_test) : null

                return (
                  <button
                    key={h.id}
                    onClick={() => setModalHyp(h)}
                    className={`text-left border rounded-xl p-3.5 hover:shadow-md transition-all group cursor-pointer ${borderCls}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-[#7AB51D]">{h.id}</span>
                      {isRunning
                        ? <span className="flex items-center gap-0.5 text-[10px] text-[#7AB51D] font-semibold"><Icon icon="uil:play" width={9} height={9} /> 집행중</span>
                        : isRecheck
                        ? <span className="flex items-center gap-0.5 text-[10px] text-yellow-600 font-semibold"><Icon icon="uil:redo" width={9} height={9} /> 재검증</span>
                        : <span className="text-[10px] text-gray-400 font-semibold">미집행</span>
                      }
                    </div>
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2 leading-snug">{h.title}</p>
                    <p className="text-[10px] text-gray-400 mb-2">{h.category?.replace(/^Phase \d: /, '') || '—'}</p>

                    {/* IPM 또는 다음 액션 */}
                    {ipm != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-mono font-bold ${ipm >= KPI_IPM ? 'text-green-600' : ipm >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
                          IPM {ipm.toFixed(1)}
                        </span>
                      </div>
                    ) : h.next_action ? (
                      <p className="text-[10px] text-[#7AB51D] font-medium line-clamp-1 flex items-center gap-1">
                        <Icon icon="uil:arrow-right" width={9} height={9} /> {h.next_action}
                      </p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )
        }
      </div>

      {/* 가설 모달 */}
      {modalHyp && (
        <HypothesisModal
          hypothesis={modalHyp}
          onClose={() => setModalHyp(null)}
          onUpdated={() => {
            fetchHypotheses().then(setHypotheses).catch(console.error)
            setModalHyp(null)
          }}
        />
      )}
    </div>
  )
}
