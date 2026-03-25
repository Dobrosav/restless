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
    
    const loadCollectionData = async (folderPath: string, folderName: string): Promise<Collection> => {
      const requests: any[] = []
      const subCollections: Collection[] = []
      let envs: Environment[] = []
      
      const items = await window.electronAPI.readDir(folderPath)
      
      for (const item of items) {
        if (item.isDirectory && item.name !== '.git') {
          const childColl = await loadCollectionData(item.path, item.name)
          subCollections.push(childColl)
        } else if (item.name.endsWith('.json')) {
          if (item.name === 'environments.json') {
            try {
              const content = await window.electronAPI.readFile(item.path)
              if (content) envs = JSON.parse(content)
            } catch (e) {
              console.error('Failed to parse environments.json:', item.path)
            }
          } else {
            const content = await window.electronAPI.readFile(item.path)
            if (content) {
              try {
                const request = JSON.parse(content)
                request.path = item.path
                request.id = request.id || crypto.randomUUID()
                request.name = request.name || 'Untitled'
                request.method = request.method || 'GET'
                request.url = request.url || ''
                request.params = request.params || []
                request.headers = request.headers || []
                request.body = request.body || { type: 'none', content: '' }
                request.auth = request.auth || { type: 'none' }
                request.script = request.script || { pre: '', post: '' }
                requests.push(request)
              } catch {
                console.error('Failed to parse:', item.path)
              }
            }
          }
        }
      }
      
      const activeEnvId = localStorage.getItem(`activeEnv_${folderName}`) || undefined
      
      return {
        id: folderPath, // use path as a stable distinct ID
        name: folderName,
        path: folderPath,
        requests,
        collections: subCollections,
        environments: envs,
        activeEnvironmentId: activeEnvId
      }
    }
    
    const items = await window.electronAPI.readDir(dirPath)
    for (const item of items) {
      if (item.isDirectory && item.name !== '.git') {
        const collection = await loadCollectionData(item.path, item.name)
        collections.push(collection)
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
