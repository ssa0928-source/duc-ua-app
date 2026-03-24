import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { createHypothesis, updateHypothesis, getNextHypothesisId } from '../lib/supabase'

const CATEGORIES = ['Phase 0: Control', 'Phase 1: Hook', 'Phase 2: Body', 'Phase 3: CTA', 'Phase 4: Final', 'Phase 5: Scale', '기타']
const STATUSES = ['미집행', '집행중', '완료']
const RELIABILITY_OPTIONS = [
  { value: '🟢 높음', label: '높음', icon: 'uil:check-circle', iconCls: 'text-green-500' },
  { value: '🟡 보통', label: '보통', icon: 'uil:minus-circle', iconCls: 'text-amber-500' },
  { value: '🔴 낮음', label: '낮음', icon: 'uil:exclamation-circle', iconCls: 'text-red-500' },
  { value: '⬜ 미검토', label: '미검토', icon: 'uil:circle', iconCls: 'text-gray-300' },
]

const EMPTY = {
  category: 'Phase 1: Hook', title: '', hypothesis: '',
  independent_var: '', fixed_var: '', control_asset_desc: '', runtime: '',
  start_date: '', end_date: '', status: '미집행', reliability: '⬜ 미검토',
  win_reason: '', next_seed: '', next_action: '',
}

export default function HypothesisPanel({ hypothesis, onClose, onSaved }) {
  const isEdit = !!hypothesis
  const [form, setForm] = useState(EMPTY)
  const [nextId, setNextId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [guideOpen, setGuideOpen] = useState(true)

  useEffect(() => {
    if (hypothesis) {
      setForm({
        category: hypothesis.category || 'Phase 1: Hook',
        title: hypothesis.title || '',
        hypothesis: hypothesis.hypothesis || '',
        independent_var: hypothesis.independent_var || '',
        fixed_var: hypothesis.fixed_var || '',
        control_asset_desc: hypothesis.control_asset_desc || '',
        runtime: hypothesis.runtime || '',
        start_date: hypothesis.start_date || '',
        end_date: hypothesis.end_date || '',
        status: hypothesis.status || '미집행',
        reliability: hypothesis.reliability || '⬜ 미검토',
        win_reason: hypothesis.win_reason || '',
        next_seed: hypothesis.next_seed || '',
        next_action: hypothesis.next_action || '',
      })
    } else {
      setForm(EMPTY)
      getNextHypothesisId('Phase 1: Hook').then(setNextId).catch(() => setNextId('H-??'))
    }
  }, [hypothesis])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCategoryChange = async (cat) => {
    set('category', cat)
    if (!isEdit) {
      try { setNextId(await getNextHypothesisId(cat)) } catch { setNextId('?-??') }
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('가설명을 입력해주세요.'); return }
    setError(''); setSaving(true)
    try {
      if (isEdit) {
        await updateHypothesis(hypothesis.id, form)
      } else {
        const id = await getNextHypothesisId(form.category)
        await createHypothesis({ id, ...form })
      }
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const displayId = isEdit ? hypothesis.id : nextId
  const namingId = displayId ? displayId.replace('-', '') : ''

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl z-50 flex flex-col" style={{ animation: 'slideIn 0.22s ease-out' }}>
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">{isEdit ? '가설 수정' : '새 가설 추가'}</h2>
            {displayId && (
              <p className="text-xs text-gray-400 mt-0.5">
                가설 ID: <span className="font-mono font-bold text-[#7AB51D]">{displayId}</span>
                &nbsp;·&nbsp;소재 네이밍: <span className="font-mono">{namingId}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 cursor-pointer mt-0.5">
            <Icon icon="uil:times" width={18} height={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 용어 설명 박스 */}
          <div className="rounded-lg border-l-4 border-[#7AB51D] bg-[#F0F7E6]">
            <button
              onClick={() => setGuideOpen(g => !g)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#4A7010] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Icon icon="uil:info-circle" width={14} height={14} />
                가설 작성 가이드
              </span>
              {guideOpen ? <Icon icon="uil:angle-up" width={15} height={15} /> : <Icon icon="uil:angle-down" width={15} height={15} />}
            </button>
            {guideOpen && (
              <div className="px-4 pb-4 text-xs text-[#4A7010] space-y-3 leading-relaxed">
                <div>
                  <p className="font-semibold">테스트 요소</p>
                  <p className="text-[#7AB51D]/80 mt-0.5">이번에 바꾸는 것 딱 하나. (1회 1변수 원칙)</p>
                  <p className="text-gray-500 mt-0.5">예) 오프닝 장면 유형 (코인 폭발 vs 슬롯 릴 스핀)</p>
                </div>
                <div>
                  <p className="font-semibold">고정 요소</p>
                  <p className="text-[#7AB51D]/80 mt-0.5">두 소재에서 동일하게 유지하는 모든 것.</p>
                  <p className="text-gray-500 mt-0.5">예) 러닝타임 15초 / BGM·SFX 동일 / CTA 동일</p>
                </div>
                <div>
                  <p className="font-semibold">대조군 소재</p>
                  <p className="text-[#7AB51D]/80 mt-0.5">비교 기준이 되는 소재. (단일 고정 대조군 원칙)</p>
                  <p className="text-gray-500 mt-0.5">예) 슬롯 릴 스핀 오프닝 15초</p>
                </div>
              </div>
            )}
          </div>

          {/* 기본 정보 */}
          <Field label="테스트 Phase *">
            <Select value={form.category} onChange={handleCategoryChange} options={CATEGORIES} />
          </Field>

          <Field label="가설명 *">
            <Input value={form.title} onChange={v => set('title', v)} placeholder="짧은 제목 (예: 코인 폭발 오프닝 효과 검증)" />
          </Field>

          <Field label="가설 정제 문장">
            <Textarea value={form.hypothesis} onChange={v => set('hypothesis', v)} rows={3}
              placeholder="예: 오프닝에서 코인 폭발을 직접 보여주면 슬롯 릴 스핀 대비 IPM이 10% 이상 높을 것이다" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="테스트 요소">
              <Input value={form.independent_var} onChange={v => set('independent_var', v)} placeholder="이번에 바꾸는 요소 한 가지" />
            </Field>
            <Field label="고정 요소">
              <Input value={form.fixed_var} onChange={v => set('fixed_var', v)} placeholder="동일하게 유지하는 요소들" />
            </Field>
          </div>

          <Field label="대조군 소재">
            <Textarea value={form.control_asset_desc} onChange={v => set('control_asset_desc', v)} rows={2}
              placeholder="비교 기준이 되는 소재 설명" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="러닝타임">
              <Input value={form.runtime} onChange={v => set('runtime', v)} placeholder="예: 15초" />
            </Field>
            <Field label="상태">
              <Select value={form.status} onChange={v => set('status', v)} options={STATUSES} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="집행 시작일">
              <Input type="date" value={form.start_date} onChange={v => set('start_date', v)} />
            </Field>
            <Field label="집행 종료일">
              <Input type="date" value={form.end_date} onChange={v => set('end_date', v)} />
            </Field>
          </div>

          <Field label="데이터 신뢰도">
            <div className="flex gap-2">
              {RELIABILITY_OPTIONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set('reliability', r.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    form.reliability === r.value
                      ? 'border-gray-400 bg-gray-50 text-gray-800 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon icon={r.icon} width={13} height={13} className={form.reliability === r.value ? r.iconCls : 'text-gray-300'} />
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">집행 후 작성</p>
            <Field label="왜 이겼는가 (팀 합의 인사이트)">
              <Textarea value={form.win_reason} onChange={v => set('win_reason', v)} rows={2}
                placeholder="판정 채택 후 팀이 동의한 근거" />
            </Field>
            <Field label="반박 가설 / 다음 사이클 시드">
              <Textarea value={form.next_seed} onChange={v => set('next_seed', v)} rows={2}
                placeholder="다음에 검증할 가설 아이디어" />
            </Field>
            <Field label="다음 액션">
              <Textarea value={form.next_action} onChange={v => set('next_action', v)} rows={2}
                placeholder="후속 과제" />
            </Field>
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors">
              취소
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#7AB51D] hover:bg-[#6A9E18] text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50">
              {saving ? <Icon icon="uil:sync" width={15} height={15} className="animate-spin" /> : <Icon icon="uil:save" width={15} height={15} />}
              {isEdit ? '수정 저장' : '저장'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }`}</style>
    </>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none transition focus:border-[#7AB51D] focus:ring-2 focus:ring-[#7AB51D]/20" />
  )
}

function Textarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-none transition focus:border-[#7AB51D] focus:ring-2 focus:ring-[#7AB51D]/20" />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none bg-white transition focus:border-[#7AB51D] focus:ring-2 focus:ring-[#7AB51D]/20">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
