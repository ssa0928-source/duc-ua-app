import { useState, useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import CsvUpload from './CsvUpload'

const BASE_URL = 'http://duc-dev.doubleugames.com:8081/apps/views/dashboard.php'

const AD_TYPES = [
  { value: 'BX', label: 'BX 소재' },
  { value: 'UA', label: 'UA 소재' },
  { value: 'ALL', label: '전체' },
]

const INNER_TABS = [
  { id: 'dash', label: '대시보드 보기', icon: 'uil:monitor' },
  { id: 'csv', label: 'CSV 업로드', icon: 'uil:upload' },
]

export default function AdDashboard({ onSaved }) {
  const [innerTab, setInnerTab] = useState('dash')
  const [adType, setAdType] = useState('BX')
  const [frameKey, setFrameKey] = useState(0)
  const [frameStatus, setFrameStatus] = useState('loading')
  const timerRef = useRef(null)

  const iframeSrc = `${BASE_URL}?adtype=${adType}`

  useEffect(() => {
    if (innerTab !== 'dash' || frameStatus !== 'loading') return
    timerRef.current = setTimeout(() => setFrameStatus('error'), 10000)
    return () => clearTimeout(timerRef.current)
  }, [frameKey, innerTab])

  const reload = () => {
    clearTimeout(timerRef.current)
    setFrameStatus('loading')
    setFrameKey(k => k + 1)
  }

  const changeType = (val) => {
    clearTimeout(timerRef.current)
    setAdType(val)
    setFrameStatus('loading')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 내부 탭 + 컨트롤 */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-2.5 flex items-center gap-3 shadow-sm">
        {/* 내부 탭 토글 */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {INNER_TABS.map(t => {
            const active = innerTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setInnerTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  active ? 'bg-white text-[#7AB51D] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon icon={t.icon} width={13} height={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* 대시보드 전용 컨트롤 */}
        {innerTab === 'dash' && (
          <>
            {/* 연결 상태 */}
            <div className="flex items-center gap-1.5">
              {frameStatus === 'loading' && (
                <span className="flex items-center gap-1 text-xs text-yellow-600">
                  <Icon icon="uil:sync" width={11} height={11} className="animate-spin" /> 연결 중...
                </span>
              )}
              {frameStatus === 'ok' && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Icon icon="uil:wifi" width={11} height={11} /> 연결됨
                </span>
              )}
              {frameStatus === 'error' && (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <Icon icon="uil:wifi-slash" width={11} height={11} /> 연결 실패
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Ad Type 필터 */}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Icon icon="uil:filter" width={12} height={12} />
                {AD_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => changeType(t.value)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      adType === t.value
                        ? 'bg-[#7AB51D] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={reload}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Icon icon="uil:sync" width={12} height={12} /> 새로고침
              </button>

              <a
                href={iframeSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-600 hover:border-[#7AB51D] hover:text-[#7AB51D] cursor-pointer transition-colors"
              >
                <Icon icon="uil:external-link-alt" width={12} height={12} /> 새 탭에서 열기
              </a>
            </div>
          </>
        )}

        {/* CSV 탭 전용 안내 */}
        {innerTab === 'csv' && (
          <span className="text-xs text-gray-400 ml-2">
            AppsFlyer에서 다운로드한 CSV를 업로드하면 가설 DB에 IPM / 판정이 자동 반영됩니다.
          </span>
        )}
      </div>

      {/* ── 대시보드 보기 ── */}
      {innerTab === 'dash' && (
        <>
          {/* 연결 실패 안내 */}
          {frameStatus === 'error' && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-5 space-y-3">
              <div className="flex items-start gap-3">
                <Icon icon="uil:shield-exclamation" width={18} height={18} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800 mb-1">페이지를 불러오지 못했습니다</p>
                  <p className="text-xs text-slate-600 leading-relaxed">두 가지 이유 중 하나입니다. 아래 해결 방법을 순서대로 시도해보세요.</p>
                </div>
              </div>

              <div className="space-y-3 pl-7">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-700 mb-2">① HTTPS 환경에서의 혼합 콘텐츠 차단 (가장 흔한 원인)</p>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    이 앱(HTTPS)에서 내부망 HTTP 사이트를 불러올 때 Chrome이 차단합니다.
                    아래 Chrome 설정에서 <strong>1회만</strong> 허용하면 이후 계속 사용 가능합니다.
                  </p>
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1.5">방법 A — 주소창에서 바로 허용</p>
                    <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside leading-relaxed">
                      <li>주소창 오른쪽 끝 <strong>방패(🛡) 또는 자물쇠</strong> 아이콘 클릭</li>
                      <li><strong>"안전하지 않은 콘텐츠 허용"</strong> 선택</li>
                      <li>페이지 자동 새로고침 → 완료</li>
                    </ol>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1.5">방법 B — Chrome 설정에서 영구 허용 (권장)</p>
                    <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>
                        Chrome 주소창에 입력
                        <div className="mt-1 flex items-center gap-2">
                          <code className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700">chrome://settings/content/insecureContent</code>
                          <button onClick={() => navigator.clipboard.writeText('chrome://settings/content/insecureContent')}
                            className="text-[10px] px-2 py-1 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer shrink-0">복사</button>
                        </div>
                      </li>
                      <li><strong>"허용"</strong> 섹션 → <strong>추가</strong> 클릭 후 아래 주소 입력
                        <div className="mt-1 flex items-center gap-2">
                          <code className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-700">{window.location.hostname}</code>
                          <button onClick={() => navigator.clipboard.writeText(window.location.hostname)}
                            className="text-[10px] px-2 py-1 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer shrink-0">복사</button>
                        </div>
                      </li>
                      <li>이 탭으로 돌아와 새로고침</li>
                    </ol>
                  </div>
                  <button onClick={reload}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7AB51D] text-white text-xs font-semibold rounded-lg hover:bg-[#6A9E18] cursor-pointer transition-colors">
                    <Icon icon="uil:sync" width={11} height={11} /> 허용 후 새로고침
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-700 mb-2">② 사무실 내부망 미연결</p>
                  <p className="text-xs text-slate-500 leading-relaxed mb-2">사무실 Wi-Fi에 연결된 상태인지 확인하세요.</p>
                  <div className="flex gap-2">
                    <a href={`${BASE_URL}?adtype=BX`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
                      <Icon icon="uil:external-link-alt" width={11} height={11} /> BX 소재 열기
                    </a>
                    <a href={`${BASE_URL}?adtype=UA`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
                      <Icon icon="uil:external-link-alt" width={11} height={11} /> UA 소재 열기
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative"
            style={{ height: 'calc(100vh - 190px)', minHeight: 600 }}
          >
            {frameStatus === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white z-10 pointer-events-none">
                <div className="text-center text-gray-400">
                  <Icon icon="uil:sync" width={24} height={24} className="animate-spin mx-auto mb-2" />
                  <p className="text-sm">로딩 중...</p>
                </div>
              </div>
            )}
            {frameStatus === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 pointer-events-none">
                <p className="text-xs text-gray-400">위 안내에 따라 혼합 콘텐츠를 허용한 뒤 새로고침 하세요.</p>
              </div>
            )}
            <iframe
              key={frameKey}
              src={iframeSrc}
              className="w-full h-full border-0"
              title="내부 성과 대시보드"
              onLoad={() => { clearTimeout(timerRef.current); setFrameStatus('ok') }}
              onError={() => { clearTimeout(timerRef.current); setFrameStatus('error') }}
              style={{ minHeight: 600 }}
            />
          </div>
        </>
      )}

      {/* ── CSV 업로드 ── */}
      {innerTab === 'csv' && (
        <CsvUpload onSaved={onSaved} />
      )}
    </div>
  )
}
