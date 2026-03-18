import { useState, useEffect, useRef } from 'react'
import { useApp } from '../stores/AppContext'

const methodColors: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
}

export function TabsBar() {
  const { tabs, activeTabId, setActiveTabId, closeTab, closeOtherTabs, closeAllTabs, createRequest } = useApp()
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean, x: number, y: number, tabId: string | null }>({
    isOpen: false,
    x: 0,
    y: 0,
    tabId: null
  })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(prev => ({ ...prev, isOpen: false }))
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      tabId
    })
  }

  if (tabs.length === 0) {
    return (
      <div className="h-10 bg-gray-900 border-b border-gray-700 flex items-center px-4">
        <button
          onClick={createRequest}
          className="text-gray-400 hover:text-white px-3 py-1 text-sm rounded transition-colors flex items-center gap-2"
        >
          <span>+</span>
          <span>New Request</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="h-10 bg-gray-900 border-b border-gray-700 flex items-center overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              className={`h-full flex items-center border-r border-gray-700 min-w-[150px] max-w-[200px] cursor-pointer group select-none transition-colors ${
                isActive ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'
              }`}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
            >
              <div className="px-3 flex-1 flex items-center gap-2 overflow-hidden truncate">
                <span className={`text-[10px] font-mono font-bold ${methodColors[tab.method] || 'text-gray-400'}`}>
                  {tab.method}
                </span>
                <span className={`text-sm truncate ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                  {tab.name || 'Untitled'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className={`px-2 py-1 flex items-center justify-center text-xs w-6 h-6 rounded-sm ml-1 mr-1 transition-opacity ${
                  isActive ? 'opacity-100 text-gray-400 hover:text-white hover:bg-gray-700' : 'opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white hover:bg-gray-700'
                }`}
                title="Close tab"
              >
                ×
              </button>
            </div>
          )
        })}
        <button
          onClick={createRequest}
          className="text-gray-400 hover:text-white px-3 h-full flex items-center justify-center hover:bg-gray-800 transition-colors"
          title="New Request"
        >
          +
        </button>
      </div>

      {contextMenu.isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 text-sm text-gray-300"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-700 hover:text-white transition-colors"
            onClick={() => {
              if (contextMenu.tabId) closeTab(contextMenu.tabId)
              setContextMenu(prev => ({ ...prev, isOpen: false }))
            }}
          >
            Close Tab
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-700 hover:text-white transition-colors"
            onClick={() => {
              if (contextMenu.tabId) closeOtherTabs(contextMenu.tabId)
              setContextMenu(prev => ({ ...prev, isOpen: false }))
            }}
          >
            Close Other Tabs
          </button>
          <div className="border-t border-gray-700 my-1"></div>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-700 hover:text-white transition-colors text-red-400 hover:text-red-300"
            onClick={() => {
              closeAllTabs()
              setContextMenu(prev => ({ ...prev, isOpen: false }))
            }}
          >
            Close All Tabs
          </button>
        </div>
      )}
    </>
  )
}
