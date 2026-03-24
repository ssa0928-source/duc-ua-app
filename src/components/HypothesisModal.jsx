import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { fetchAdPerformance, updateHypothesis } from '../lib/supabase'
import { generateSettingRequest } from '../lib/settingRequest'
import { VerdictBadge, StatusBadge, RELIABILITY_CONFIG } from './HypothesisDB'

function ReliabilityBadge({ value }) {
  if (!value) return null
  const cfg = RELIABILITY_CONFIG[value]
  if (!cfg) return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{value}</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">
      <Icon icon={cfg.icon} width={11} height={11} className={cfg.iconCls} />
      <span className="text-gray-600">{cfg.label}</span>
    </span>
  )
}

const TABS = [
  { id: 'info', label: '기본 정보', icon: 'uil:flask' },
  { id: 'perf', label: '성과 데이터', icon: 'uil:chart-bar' },
  { id: 'insight', label: '인사이트 & 액션', icon: 'uil:lightbulb' },
]

export default function HypothesisModal({ hypothesis, onClose, onUpdated }) {
  const [tab, setTab] = useState('info')
  const [ads, setAds] = useState([])
  const [loadingAds, setLoadingAds] = useState(true)
  const [aiSummary, setAiSummary] = useState(hypothesis.ai_summary || '')
  const [analyzing, setAnalyzing] = useState(false)
  const [copiedAi, setCopiedAi] = useState(false)
  const [copiedReq, setCopiedReq] = useState(false)

  useEffect(() => {
    fetchAdPerformance({ hypothesis_id: hypothesis.id })
      .then(setAds).catch(console.error).finally(() => setLoadingAds(false))
  }, [hypothesis.id])

  const handleAi = async () => {
    const key = import.meta.env.VITE_GEMINI_API_KEY
    if (!key) {
      alert('무료 AI 기능을 사용하려면\n.env 파일에 VITE_GEMINI_API_KEY를 입력해주세요.\n\nAPI 키 발급: https://aistudio.google.com/apikey')
      return
    }
    setAnalyzing(true)
    try {
      const prompt = `당신은 모바일 게임 UA(User Acquisition) 광고 소재 성과 분석 전문가입니다.
다음 가설 정보를 바탕으로 핵심 인사이트를 도출해주세요.

[가설] ${hypothesis.hypothesis || hypothesis.title}
[테스트 요소] ${hypothesis.independent_var || '없음'}
[고정 요소] ${hypothesis.fixed_var || '없음'}
[결과]
- IPM: ${hypothesis.ipm_test ?? '미집행'}
- 데이터 신뢰도: ${hypothesis.reliability}

다음 항목을 분석해주세요:
1. 주요 발견 (2-3문장)
2. 승인 또는 기각 이유 (1-2문장)
3. 다음 검증 가설 아이디어 (2-3문장)`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      )
      const d = await res.json()
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '결과를 받지 못했습니다.'
      setAiSummary(text)
      await updateHypothesis(hypothesis.id, { ai_summary: text })
      onUpdated?.()
    } catch (e) { alert('AI 분석 오류: ' + e.message) }
    finally { setAnalyzing(false) }
  }

  const copyAi = () => { navigator.clipboard.writeText(aiSummary); setCopiedAi(true); setTimeout(() => setCopiedAi(false), 2000) }
  const copyReq = () => { navigator.clipboard.writeText(generateSettingRequest(hypothesis)); setCopiedReq(true); setTimeout(() => setCopiedReq(false), 2000) }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-0 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="font-mono text-sm font-bold text-[#7AB51D]">{hypothesis.id}</span>
                <VerdictBadge verdict={hypothesis.verdict} />
                <StatusBadge status={hypothesis.status} />
                <ReliabilityBadge value={hypothesis.reliability} />
                {hypothesis.category && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{hypothesis.category}</span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-800 leading-snug">{hypothesis.title}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 cursor-pointer shrink-0 mt-0.5">
              <Icon icon="uil:times" width={18} height={18} className="text-gray-400" />
            </button>
          </div>
          <div className="flex gap-0">
            {TABS.map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-[#7AB51D] text-[#7AB51D]'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon icon={t.icon} width={14} height={14} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {tab === 'info' && (
            <div className="px-6 py-5 space-y-5">
              {hypothesis.hypothesis && (
                <div className="bg-[#F0F7E6] border border-[#7AB51D]/30 rounded-xl px-4 py-4">
                  <p className="text-[10px] font-bold text-[#7AB51D] uppercase mb-1.5">가설 정제 문장</p>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">{hypothesis.hypothesis}</p>
                </div>
              )}
              <div>
                <SectionTitle>테스트 설계</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard label="테스트 요소" value={hypothesis.independent_var} accent="green" />
                  <InfoCard label="고정 요소" value={hypothesis.fixed_var} accent="gray" />
                  <InfoCard label="대조군 소재" value={hypothesis.control_asset_desc} accent="gray" />
                  <InfoCard label="러닝타임" value={hypothesis.runtime} accent="gray" />
                </div>
              </div>
              <div>
                <SectionTitle>메타 정보</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {hypothesis.category && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 flex gap-2 items-center">
                      <span className="text-[10px] text-gray-400 font-semibold">테스트 Phase</span>
                      <span className="text-xs text-gray-700 font-medium">{hypothesis.category}</span>
                    </div>
                  )}
                  {hypothesis.reliability && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 flex gap-2 items-center">
                      <span className="text-[10px] text-gray-400 font-semibold">신뢰도</span>
                      <ReliabilityBadge value={hypothesis.reliability} />
                    </div>
                  )}
                  {hypothesis.status && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 flex gap-2 items-center">
                      <span className="text-[10px] text-gray-400 font-semibold">상태</span>
                      <StatusBadge status={hypothesis.status} />
                    </div>
                  )}
                  {hypothesis.start_date && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 flex gap-2 items-center">
                      <span className="text-[10px] text-gray-400 font-semibold">집행 기간</span>
                      <span className="text-xs text-gray-700 font-medium">{hypothesis.start_date} ~ {hypothesis.end_date || ''}</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <SectionTitle>세팅 리퀀스트</SectionTitle>
                <button onClick={copyReq}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors mb-3">
                  {copiedReq ? <Icon icon="uil:check" width={13} height={13} className="text-green-500" /> : <Icon icon="uil:file-alt" width={13} height={13} />}
                  {copiedReq ? '클립보드에 복사됨!' : '세팅 요청 복사 & 확인'}
                </button>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {generateSettingRequest(hypothesis)}
                </div>
              </div>
            </div>
          )}

          {tab === 'perf' && (
            <div className="px-6 py-5 space-y-5">
              <div className="max-w-[200px]">
                <MetricCard
                  label="IPM"
                  value={hypothesis.ipm_test != null ? Number(hypothesis.ipm_test).toFixed(2) : '—'}
                  sub="크리에이티브 성과"
                  color="green"
                />
              </div>
              <div>
                <SectionTitle>Ad 성과 상세 ({ads.length}건)</SectionTitle>
                {loadingAds ? (
                  <div className="py-8 text-center text-gray-400"><Icon icon="uil:sync" width={18} height={18} className="animate-spin mx-auto mb-1" /><p className="text-xs">로딩 중...</p></div>
                ) : ads.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg">
                    연결된 Ad 데이터가 없습니다. CSV를 업로드하세요.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                          {['소재명', 'IPM', '노출수', '설치수', '비용'].map(c => (
                            <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ads.map(a => (
                          <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-[10px] max-w-[200px] truncate text-gray-500" title={a.ad_name}>{a.ad_name}</td>
                            <td className="px-3 py-2 font-mono font-bold text-gray-800">{(a.ipm || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{(a.impressions || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{(a.installs || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">${(a.cost || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'insight' && (
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 gap-3">
                {hypothesis.win_reason && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-4">
                    <p className="text-[10px] font-bold text-green-500 uppercase mb-1.5">왔 이과유통으로</p>
                    <p className="text-sm text-green-900 leading-relaxed">{hypothesis.win_reason}</p>
                  </div>
                )}
                {hypothesis.next_seed && (
                  <div className="bg-[#F0F7E6] border border-[#7AB51D]/30 rounded-xl px-4 py-4">
                    <p className="text-[10px] font-bold text-[#7AB51D] uppercase mb-1.5">다음 시드 가설</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{hypothesis.next_seed}</p>
                  </div>
                )}
                {hypothesis.next_action && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-4">
                    <p className="text-[10px] font-bold text-orange-500 uppercase mb-1.5">다음 액션</p>
                    <p className="text-sm text-orange-900 leading-relaxed">{hypothesis.next_action}</p>
                  </div>
                )}
                {!hypothesis.win_reason && !hypothesis.next_seed && !hypothesis.next_action && (
                  <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg">
                    작성된 인사이트가 없습니다. 집행 후 결과를 기록해주세요.
                  </div>
                )}
              </div>
              <div>
                <SectionTitle>AI 분석 (Gemini)</SectionTitle>
                <div className="flex gap-2 mb-3">
                  <button onClick={handleAi} disabled={analyzing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer transition-colors">
                    {analyzing ? <Icon icon="uil:sync" width={13} height={13} className="animate-spin" /> : <Icon icon="uil:robot" width={13} height={13} />}
                    {analyzing ? '분석 중...' : 'AI 인사이트 생성'}
                  </button>
                  {aiSummary && (
                    <button onClick={copyAi} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 cursor-pointer">
                      {copiedAi ? <Icon icon="uil:check" width={12} height={12} className="text-green-500" /> : <Icon icon="uil:copy" width={12} height={12} />}
                      {copiedAi ? '복사됨' : '복사'}
                    </button>
                  )}
                </div>
                {aiSummary
                  ? <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiSummary}</div>
                  : <p className="text-gray-400 text-sm">AI 분석 버팀을 클릭하면 이 가설에 대한 핵심 인사이트를 생성합니다.</p>
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
      <span className="w-1 h-3.5 bg-[#7AB51D] rounded-full inline-block" />
      {children}
    </h3>
  )
}

function InfoCard({ label, value, accent = 'gray' }) {
  const bg = accent === 'green' ? 'bg-[#F0F7E6] border-[#7AB51D]/20' : 'bg-gray-50 border-gray-100'
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${bg}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{value || '—'}</p>
    </div>
  )
}

function MetricCard({ label, value, sub, color = 'gray' }) {
  const styles = {
    green: 'bg-[#F0F7E6] border-[#7AB51D]/30',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200',
  }
  return (
    <div className={`rounded-xl border px-4 py-4 text-center ${styles[color] || styles.gray}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
      <p className="text-[10px] text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
