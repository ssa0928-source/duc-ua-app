import { useState } from 'react'
import { Icon } from '@iconify/react'
import HypothesisDB from './components/HypothesisDB'
import PerformanceData from './components/PerformanceData'
import Dashboard from './components/Dashboard'
import AdDashboard from './components/AdDashboard'

const TABS = [
  { id: 'dashboard', label: '대시보드', icon: 'uil:chart-bar' },
  { id: 'hypothesis', label: '가설 DB', icon: 'uil:database' },
  { id: 'performance', label: '성과 데이터', icon: 'uil:table' },
  { id: 'addashboard', label: '성과 연동', icon: 'uil:link-alt' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  const triggerRefresh = () => setRefreshKey(k => k + 1)
  const currentTab = TABS.find(t => t.id === activeTab)

  return (
    <div className="flex min-h-screen" style={{ fontFamily: 'Pretendard, -apple-system, sans-serif', background: '#F5F5F0' }}>

      {/* 사이드바 */}
      <aside
        className="flex flex-col bg-white border-r border-gray-100 transition-all duration-300 shrink-0"
        style={{ width: collapsed ? 68 : 240, boxShadow: '1px 0 0 #F3F4F6' }}
      >
        {/* 로고 */}
        <div className={`flex items-center h-16 px-4 shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}
          style={{ borderBottom: '1px solid #F3F4F6' }}
        >
          <img src="/logo.png" alt="DoubleU Games" className={`object-contain transition-all duration-300 ${collapsed ? 'h-7 w-7' : 'h-8 w-auto max-w-[140px]'}`} />
        </div>

        {/* 앱 이름 */}
        {!collapsed && (
          <div className="px-4 pt-5 pb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">가설 관리 시스템</p>
          </div>
        )}

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {TABS.map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={collapsed ? tab.label : undefined}
                className={`relative w-full flex items-center rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer group
                  ${collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-3 py-2.5'}
                  ${active
                    ? 'bg-[#F0F7E6] text-[#5A8C10]'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#7AB51D] rounded-r-full" />
                )}
                <Icon
                  icon={tab.icon}
                  width={19}
                  height={19}
                  className={active ? 'text-[#7AB51D]' : 'text-gray-400 group-hover:text-gray-600'}
                />
                {!collapsed && <span>{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* 하단 */}
        <div className="px-3 py-4 shrink-0" style={{ borderTop: '1px solid #F3F4F6' }}>
          <a
            href="https://hq1.appsflyer.com/auth/login"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? 'AppsFlyer' : undefined}
            className={`flex items-center rounded-xl border border-gray-200 text-gray-500 hover:border-[#7AB51D] hover:text-[#7AB51D] hover:bg-[#F0F7E6] text-xs font-medium transition-all duration-150 cursor-pointer mb-2
              ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2.5'}`}
          >
            <Icon icon="uil:external-link-alt" width={14} height={14} />
            {!collapsed && 'AppsFlyer'}
          </a>

          <button
            onClick={() => setCollapsed(c => !c)}
            className={`w-full flex items-center rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150 cursor-pointer
              ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2 px-3 py-2.5'}`}
          >
            <Icon icon={collapsed ? 'uil:angle-right' : 'uil:angle-left'} width={16} height={16} />
            {!collapsed && <span>접기</span>}
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 헤더 */}
        <header className="bg-white h-16 flex items-center px-6 shrink-0" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F0F7E6]">
              <Icon icon={currentTab?.icon || 'uil:chart-bar'} width={16} height={16} className="text-[#7AB51D]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 leading-tight">{currentTab?.label}</h2>
              <p className="text-[11px] text-gray-400">DUC UA TF — 가설 관리 시스템</p>
            </div>
          </div>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 p-6 overflow-auto">
          {activeTab === 'hypothesis' && <HypothesisDB key={`hyp-${refreshKey}`} />}
          {activeTab === 'performance' && <PerformanceData key={`perf-${refreshKey}`} />}
          {activeTab === 'dashboard' && <Dashboard key={`dash-${refreshKey}`} />}
          {activeTab === 'addashboard' && <AdDashboard onSaved={triggerRefresh} />}
        </main>
      </div>
    </div>
  )
}