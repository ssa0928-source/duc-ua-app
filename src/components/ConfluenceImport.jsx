import { useState } from 'react'
import { Icon } from '@iconify/react'
import { createHypothesis, getNextHypothesisId } from '../lib/supabase'

const CATEGORIES = ['Phase 0: Control', 'Phase 1: Hook', 'Phase 2: Body', 'Phase 3: CTA', 'Phase 4: Final', 'Phase 5: Scale', '기타']
const VERDICTS = ['✅ 채택', '❌ 기각', '⏳ 재검증', '⬜ 미집행']

const VERDICT_CONFIG = {
  '✅ 채택': { icon: 'uil:check-circle', label: '채택', cls: 'bg-green-100 text-green-700 border border-green-200' },
  '❌ 기각': { icon: 'uil:times-circle', label: '기각', cls: 'bg-red-100 text-red-600 border border-red-100' },
  '⏳ 재검증': { icon: 'uil:clock', label: '재검증', cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  '⬜ 미집행': { icon: 'uil:minus-circle', label: '미집행', cls: 'bg-gray-100 text-gray-400 border border-gray-200' },
}

const RELIABILITY_OPTIONS = [
  { value: '🟢 높음', label: '높음', icon: 'uil:check-circle', iconCls: 'text-green-500' },
  { value: '🟡 보통', label: '보통', icon: 'uil:minus-circle', iconCls: 'text-amber-500' },
  { value: '🔴 낮음', label: '낮음', icon: 'uil:exclamation-circle', iconCls: 'text-red-500' },
  { value: '⬜ 미검토', label: '미검토', icon: 'uil:circle', iconCls: 'text-gray-300' },
]

// ── Gemini API로 가설 추출 ──
async function extractHypotheses(text, apiKey) {
  const backtick = '`'
  const prompt = `당신은 모바일 게임 UA 광고 소재 기획안에서 가설 정보를 추출하는 전문가입니다.

아래 기획안 텍스트를 분석하여, 포함된 가설(A/B 테스트, 소재 실험, 검증 항목 등)을 모두 추출하세요.
가설이 여러 개라면 모두 추출하고, 각 가설마다 아래 JSON 구조로 반환하세요.

반드시 JSON 배열만 반환하세요. 마크다운 코드블록(${backtick}${backtick}${backtick})이나 설명 텍스트 없이 순수 JSON 배열만 출력하세요.

추출할 JSON 필드:
{
  "title": "가설명 (짧고 명확하게, 20자 이내)",
  "category": "테스트 Phase (아래 중 하나만 선택: Phase 0: Control / Phase 1: Hook / Phase 2: Body / Phase 3: CTA / Phase 4: Final / Phase 5: Scale / 기타)",
  "hypothesis": "가설 정제 문장 (If~Then 형태로, 없으면 내용 기반으로 추론)",
  "independent_var": "테스트 요소 (바꾸는 요소 한 가지)",
  "fixed_var": "고정 요소 (동일하게 유지하는 요소들)",
  "control_asset_desc": "대조군 소재 설명",
  "runtime": "러닝타임 (예: 15초, 없으면 null)",
  "phase": null,
  "ipm_test": IPM 숫자 (없으면 null),
  "reliability": "데이터 신뢰도 (🟢 높음 / 🟡 보통 / 🔴 낮음 / ⬜ 미검토 중 하나, 언급 없으면 ⬜ 미검토)",
  "verdict": "판정 (✅ 채택 / ❌ 기각 / ⏳ 재검증 / ⬜ 미집행 중 하나, 언급 없으면 ⬜ 미집행)",
  "win_reason": "왜 이겼는가 (있으면, 없으면 null)",
  "next_seed": "다음 시드 가설 또는 반박 가설 (있으면, 없으면 null)",
  "next_action": "다음 액션 (있으면, 없으면 null)",
  "status": "미집행 또는 집행중 또는 완료 (성과 데이터가 있으면 완료, 없으면 미집행)"
}

[기획안 텍스트]
${text}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `API 오류 (${res.status})`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // JSON 파싱
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('AI가 올바른 JSON을 반환하지 않았습니다.')

  const parsed = JSON.parse(jsonMatch[0])
  if (!Array.isArray(parsed)) throw new Error('추출 결과가 배열이 아닙니다.')
  return parsed
}

// ── 카테고리별 색상 ──
function CategoryBadge({ cat }) {
  const colors = {
    'Phase 0: Control': 'bg-gray-100 text-gray-700',
    'Phase 1: Hook': 'bg-blue-100 text-[#4A7010]',
    'Phase 2: Body': 'bg-purple-100 text-purple-700',
    'Phase 3: CTA': 'bg-amber-100 text-amber-700',
    'Phase 4: Final': 'bg-green-100 text-green-700',
    'Phase 5: Scale': 'bg-pink-100 text-pink-700',
    '기타': 'bg-gray-100 text-gray-600',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[cat] || 'bg-gray-100 text-gray-600'}`}>{cat}</span>
}

function VerdictBadge({ v }) {
  const cfg = VERDICT_CONFIG[v] || VERDICT_CONFIG['⬜ 미집행']
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      <Icon icon={cfg.icon} width={11} height={11} />
      {cfg.label}
    </span>
  )
}

// ── 개별 가설 카드 (편집 가능) ──
function HypothesisCard({ item, index, checked, onCheck, onChange }) {
  const [expanded, setExpanded] = useState(false)

  const set = (k, v) => onChange(index, { ...item, [k]: v })

  return (
    <div className={`border rounded-xl transition-all ${checked ? 'border-[#7AB51D]/40 bg-[#F0F7E6]/40' : 'border-gray-200 bg-white'}`}>
      {/* 헤더 */}
      <div className="flex items-start gap-3 px-4 py-3">
        <input type="checkbox" checked={checked} onChange={() => onCheck(index)}
          className="mt-1 w-4 h-4 accent-[#7AB51D] cursor-pointer shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CategoryBadge cat={item.category} />
            <VerdictBadge v={item.verdict} />
            {item.ipm_test && <span className="text-xs text-[#7AB51D] font-mono">IPM: {item.ipm_test}</span>}
          </div>
          <input value={item.title || ''} onChange={e => set('title', e.target.value)}
            className="w-full font-semibold text-gray-800 text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#7AB51D] focus:outline-none py-0.5 transition-colors"
            placeholder="가설명" />
          {item.hypothesis && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.hypothesis}</p>}
        </div>
        <button onClick={() => setExpanded(e => !e)}
          className="p-1 rounded hover:bg-gray-100 cursor-pointer shrink-0 mt-0.5">
          {expanded ? <Icon icon="uil:angle-up" width={15} height={15} className="text-gray-400" /> : <Icon icon="uil:angle-down" width={15} height={15} className="text-gray-400" />}
        </button>
      </div>

      {/* 상세 편집 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <EditField label="테스트 Phase">
            <select value={item.category || ''} onChange={e => set('category', e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 bg-white">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </EditField>
          <EditField label="가설 정제 문장">
            <textarea value={item.hypothesis || ''} onChange={e => set('hypothesis', e.target.value)} rows={2}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 resize-none" />
          </EditField>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="테스트 요소">
              <input value={item.independent_var || ''} onChange={e => set('independent_var', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30" />
            </EditField>
            <EditField label="고정 요소">
              <input value={item.fixed_var || ''} onChange={e => set('fixed_var', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30" />
            </EditField>
            <EditField label="대조군 소재">
              <input value={item.control_asset_desc || ''} onChange={e => set('control_asset_desc', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30" />
            </EditField>
            <EditField label="러닝타임">
              <input value={item.runtime || ''} onChange={e => set('runtime', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30" />
            </EditField>
            <EditField label="IPM">
              <input type="number" step="any" value={item.ipm_test ?? ''} onChange={e => set('ipm_test', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 font-mono" />
            </EditField>
          </div>
          <div className="space-y-2">
            <EditField label="판정">
              <div className="flex gap-1.5 flex-wrap">
                {VERDICTS.map(v => {
                  const cfg = VERDICT_CONFIG[v]
                  const active = (item.verdict || '⬜ 미집행') === v
                  return (
                    <button key={v} type="button" onClick={() => set('verdict', v)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                        active ? cfg.cls : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                      }`}>
                      <Icon icon={cfg.icon} width={11} height={11} className={active ? '' : 'text-gray-300'} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </EditField>
            <EditField label="신뢰도">
              <div className="flex gap-1.5">
                {RELIABILITY_OPTIONS.map(r => {
                  const active = (item.reliability || '⬜ 미검토') === r.value
                  return (
                    <button key={r.value} type="button" onClick={() => set('reliability', r.value)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                        active ? 'border-gray-400 bg-gray-50 text-gray-700 shadow-sm' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                      }`}>
                      <Icon icon={r.icon} width={11} height={11} className={active ? r.iconCls : 'text-gray-300'} />
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </EditField>
            <EditField label="상태">
              <select value={item.status || '미집행'} onChange={e => set('status', e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 bg-white">
                {['미집행', '집행중', '완료'].map(s => <option key={s}>{s}</option>)}
              </select>
            </EditField>
          </div>
          {(item.win_reason != null || item.next_seed != null || item.next_action != null) && (
            <div className="grid grid-cols-1 gap-2">
              {item.win_reason != null && <EditField label="왜 이겼는가">
                <textarea value={item.win_reason || ''} onChange={e => set('win_reason', e.target.value)} rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 resize-none" />
              </EditField>}
              {item.next_seed != null && <EditField label="다음 시드 가설">
                <textarea value={item.next_seed || ''} onChange={e => set('next_seed', e.target.value)} rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 resize-none" />
              </EditField>}
              {item.next_action != null && <EditField label="다음 액션">
                <textarea value={item.next_action || ''} onChange={e => set('next_action', e.target.value)} rows={2}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#7AB51D]/30 resize-none" />
              </EditField>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EditField({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">{label}</span>
      {children}
    </label>
  )
}

// ── 메인 모달 ──
export default function ConfluenceImport({ onClose, onSaved }) {
  const [text, setText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null) // [{...}, ...]
  const [checked, setChecked] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [step, setStep] = useState('input') // 'input' | 'preview'

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  const handleExtract = async () => {
    if (!text.trim()) { setError('기획안 내용을 붙여넣어 주세요.'); return }
    if (!apiKey) {
      setError('Gemini API 키가 설정되어 있지 않습니다.\n.env 파일의 VITE_GEMINI_API_KEY에 키를 입력하고 다시 빌드해주세요.\n\n키 발급: https://aistudio.google.com/apikey')
      return
    }
    setError(''); setExtracting(true)
    try {
      const result = await extractHypotheses(text, apiKey)
      if (result.length === 0) { setError('기획안에서 가설을 찾지 못했습니다. 내용을 확인해주세요.'); return }
      setExtracted(result)
      setChecked(new Set(result.map((_, i) => i)))
      setStep('preview')
    } catch (e) { setError(e.message) }
    finally { setExtracting(false) }
  }

  const toggleCheck = (i) => setChecked(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  const toggleAll = () => {
    if (checked.size === extracted.length) setChecked(new Set())
    else setChecked(new Set(extracted.map((_, i) => i)))
  }
  const updateItem = (i, updated) => setExtracted(prev => prev.map((item, idx) => idx === i ? updated : item))

  const handleSave = async () => {
    const toSave = extracted.filter((_, i) => checked.has(i))
    if (toSave.length === 0) { setError('저장할 가설을 선택해주세요.'); return }
    setSaving(true); setError('')
    let count = 0
    try {
      for (const item of toSave) {
        const category = item.category || 'Phase 1: Hook'
        const id = await getNextHypothesisId(category)

        await createHypothesis({
          id,
          category,
          title: item.title || '(제목 없음)',
          hypothesis: item.hypothesis || null,
          independent_var: item.independent_var || null,
          fixed_var: item.fixed_var || null,
          control_asset_desc: item.control_asset_desc || null,
          runtime: item.runtime || null,
          phase: item.phase || null,
          ipm_test: item.ipm_test ?? null,
          ipm_control: null,
          ipm_diff: null,
          reliability: item.reliability || '⬜ 미검토',
          verdict: item.verdict || '⬜ 미집행',
          win_reason: item.win_reason || null,
          next_seed: item.next_seed || null,
          next_action: item.next_action || null,
          status: item.status || '미집행',
        })
        count++
      }
      setSavedCount(count)
      onSaved?.()
    } catch (e) { setError('저장 오류: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Icon icon="uil:file-alt" width={18} height={18} className="text-[#7AB51D]" />
              기획안에서 가설 가져오기
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Confluence 기획안을 붙여넣으면 AI가 가설 항목을 자동으로 추출합니다</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 cursor-pointer"><Icon icon="uil:times" width={18} height={18} className="text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* STEP 1: 입력 */}
          {step === 'input' && (
            <div className="px-6 py-5 space-y-4">
              {/* API 키 경고 */}
              {!apiKey && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <Icon icon="uil:exclamation-circle" width={16} height={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 leading-relaxed">
                    <p className="font-semibold mb-0.5">Gemini API 키 필요</p>
                    <p>이 기능은 Google Gemini AI를 사용합니다. <code className="bg-amber-100 px-1 rounded">.env</code> 파일의 <code className="bg-amber-100 px-1 rounded">VITE_GEMINI_API_KEY</code>에 키를 입력한 후 <code className="bg-amber-100 px-1 rounded">npm run build</code>를 다시 실행해주세요. 키 발급: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com/apikey</a></p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Confluence 기획안 내용 붙여넣기
                </label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={16}
                  placeholder={`Confluence 기획안 내용을 여기에 붙여넣으세요.\n\n예시:\n─────────────────\n[H-03 가설] Mature Humor 훅 효과 검증\n\n가설: 오프닝에서 성숙한 유머 요소를 사용하면 기존 대비 IPM이 10% 이상 높을 것이다\n테스트 요소: 오프닝 장면 유형 (Mature Humor vs 일반 게임플레이)\n고정 요소: 러닝타임 15초, BGM/SFX 동일\n대조군 소재: 기존 게임플레이 오프닝\n\n결과:\n- 테스트 IPM: 9.2\n- 대조군 IPM: 7.1\n- 판정: 채택\n─────────────────`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7AB51D]/20 focus:border-[#7AB51D] resize-none font-mono leading-relaxed"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  {text.length.toLocaleString()}자 입력됨 · 여러 가설이 포함된 기획안도 한 번에 처리됩니다
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 whitespace-pre-line">{error}</div>
              )}
            </div>
          )}

          {/* STEP 2: 미리보기 */}
          {step === 'preview' && extracted && (
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-700">
                    {extracted.length}개 가설 추출됨
                    <span className="text-gray-400 font-normal ml-2">({checked.size}개 선택)</span>
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox"
                      checked={checked.size === extracted.length}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 accent-[#7AB51D]" />
                    전체선택
                  </label>
                </div>
                <button
                  onClick={() => { setStep('input'); setExtracted(null); setError('') }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <Icon icon="uil:sync" width={12} height={12} /> 다시 입력
                </button>
              </div>

              {savedCount > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Icon icon="uil:check" width={32} height={32} className="text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-green-700 text-lg">{savedCount}개 가설이 저장되었습니다!</p>
                  <p className="text-sm text-green-600 mt-1">가설 DB 탭에서 확인하세요.</p>
                  <button onClick={onClose} className="mt-4 px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium cursor-pointer">
                    닫기
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {extracted.map((item, i) => (
                    <HypothesisCard
                      key={i} item={item} index={i}
                      checked={checked.has(i)}
                      onCheck={toggleCheck}
                      onChange={updateItem}
                    />
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{error}</div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between rounded-b-2xl">
          {step === 'input' ? (
            <>
              <p className="text-xs text-gray-400">AI가 가설, 테스트 요소, IPM, 판정 등을 자동 추출합니다</p>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">취소</button>
                <button
                  onClick={handleExtract}
                  disabled={extracting || !text.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-[#7AB51D] hover:bg-[#6A9E18] text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {extracting ? <Icon icon="uil:sync" width={15} height={15} className="animate-spin" /> : <Icon icon="uil:stars" width={15} height={15} />}
                  {extracting ? 'AI 분석 중...' : 'AI로 가설 추출'}
                </button>
              </div>
            </>
          ) : savedCount === 0 ? (
            <>
              <p className="text-xs text-gray-400">항목을 펼쳐 내용을 수정한 뒤 저장하세요</p>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">취소</button>
                <button
                  onClick={handleSave}
                  disabled={saving || checked.size === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-[#7AB51D] hover:bg-[#6A9E18] text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {saving ? <Icon icon="uil:sync" width={15} height={15} className="animate-spin" /> : <Icon icon="uil:save" width={15} height={15} />}
                  {saving ? '저장 중...' : `선택 저장 (${checked.size}개)`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
