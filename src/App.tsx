import { AppProvider, useApp } from './stores/AppContext'
import { Sidebar } from './components/Sidebar'
import { TabsBar } from './components/TabsBar'
import { RequestPanel } from './components/RequestPanel'
import { ResponsePanel } from './components/ResponsePanel'
import { EnvironmentManager } from './components/EnvironmentManager'
import { GitPanel } from './components/GitPanel'
import { GitConfigDialog } from './components/GitConfigDialog'
import { Collection, Environment } from './types'
import { useEffect, useState } from 'react'

function AppContent() {
  const { workspace, setWorkspace, isLoading, activeTabId } = useApp()
  const [showGitConfigDialog, setShowGitConfigDialog] = useState(false)

  const loadCollections = async (dirPath: string): Promise<Collection[]> => {
    const collections: Collection[] = []
    
    const loadRequestsRecursively = async (dirPath: string): Promise<any[]> => {
      const requests: any[] = []
      const items = await window.electronAPI.readDir(dirPath)
      
      for (const item of items) {
        if (item.isDirectory) {
          // Recursively load from subdirectories
          const subRequests = await loadRequestsRecursively(item.path)
          requests.push(...subRequests)
        } else if (item.name.endsWith('.json')) {
          // Load request file
          const content = await window.electronAPI.readFile(item.path)
          if (content) {
            try {
              const request = JSON.parse(content)
              request.path = item.path
              requests.push(request)
            } catch {
              console.error('Failed to parse:', item.path)
            }
          }
        }
      }
      
      return requests
    }
    
    const items = await window.electronAPI.readDir(dirPath)
    for (const item of items) {
      if (item.isDirectory && item.name !== '.git') {
        const requests = await loadRequestsRecursively(item.path)
        
        let envs: Environment[] = []
        try {
          const envPath = `${item.path}/environments.json`
          if (await window.electronAPI.exists(envPath)) {
            const content = await window.electronAPI.readFile(envPath)
            if (content) envs = JSON.parse(content)
          }
        } catch (error) {
          console.error('Failed to load environments for collection', item.name, error)
        }

        const activeEnvId = localStorage.getItem(`activeEnv_${item.name}`) || undefined

        collections.push({
          id: item.name,
          name: item.name,
          path: item.path,
          requests,
          environments: envs,
          activeEnvironmentId: activeEnvId
        })
      }
    }
    
    return collections
  }



  useEffect(() => {
    const initWorkspace = async () => {
      const defaultPath = await window.electronAPI.getDefaultWorkspace()
      const collections = await loadCollections(defaultPath)
      setWorkspace({
        path: defaultPath,
        collections,
      })
      
      const isConfigSet = await window.electronAPI.gitIsConfigSet()
      if (!isConfigSet) {
        setShowGitConfigDialog(true)
      }
    }
    initWorkspace()
  }, [])
  
  const handleGitConfigSave = async (config: { userName: string; userEmail: string }) => {
    await window.electronAPI.gitSetConfig(config)
  }

  const openWorkspace = async () => {
    const dir = await window.electronAPI.openWorkspace()
    if (dir) {
      const collections = await loadCollections(dir)
      setWorkspace({
        path: dir,
        collections,
      })
    }
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 overflow-visible relative">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Workspace:</span>
              <button
                onClick={openWorkspace}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {workspace ? workspace.path.split(/[\\/]/).pop() : 'Open folder...'}
              </button>
            </div>
            <EnvironmentManager />
            <GitPanel onOpenConfig={() => setShowGitConfigDialog(true)} />
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-sm text-yellow-400">Sending...</span>
            )}
            <button
              onClick={() => setShowGitConfigDialog(true)}
              className="text-xs text-gray-500 hover:text-white"
            >
              ⚙️
            </button>
          </div>
        </div>
        <TabsBar />
        <div className="flex-1 flex overflow-hidden">
          <RequestPanel />
          <ResponsePanel tabId={activeTabId} />
        </div>
      </div>
      <GitConfigDialog 
        isOpen={showGitConfigDialog} 
        onClose={() => setShowGitConfigDialog(false)}
        onSave={handleGitConfigSave}
      />
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App
