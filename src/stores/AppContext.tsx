import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Workspace, ApiRequest, ResponseData, HttpMethod, Environment, Collection } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface AppState {
  workspace: Workspace | null
  tabs: ApiRequest[]
  activeTabId: string | null
  response: ResponseData | null
  isLoading: boolean
  activeEnvironment: Environment | null
  environments: Environment[]
}

interface AppContextType extends AppState {
  currentRequest: ApiRequest | null
  setWorkspace: (workspace: Workspace | null) => void
  setCurrentRequest: (request: ApiRequest | null) => void
  openTab: (request: ApiRequest) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  setActiveTabId: (tabId: string | null) => void
  setResponse: (response: ResponseData | null) => void
  setIsLoading: (loading: boolean) => void
  setActiveEnvironment: (env: Environment | null) => void
  createRequest: () => ApiRequest
  updateRequest: (request: Partial<ApiRequest>) => void
  saveRequest: (collectionId: string) => Promise<boolean>
  deleteRequest: (requestId: string) => Promise<boolean>
  createCollection: (name: string) => Promise<string | null>
  deleteCollection: (collectionId: string) => Promise<boolean>
  createEnvironment: (name: string) => Environment
  updateEnvironment: (env: Environment) => void
  deleteEnvironment: (envId: string) => void
  setEnvironments: (envs: Environment[]) => void
  refreshWorkspace: () => Promise<void>
}

const defaultRequest = (): ApiRequest => ({
  id: crypto.randomUUID(),
  name: 'New Request',
  method: 'GET' as HttpMethod,
  url: '',
  params: [],
  headers: [],
  body: { type: 'none', content: '' },
  auth: { type: 'none' },
  script: { pre: '', post: '' },
})

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tabs, setTabs] = useState<ApiRequest[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const currentRequest = tabs.find(t => t.id === activeTabId) || null
  const [response, setResponse] = useState<ResponseData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])

  const refreshWorkspace = async () => {
    if (!workspace) return
    
    try {
      // 1. Load collections
      const collections: Collection[] = []
      
      const loadRequestsRecursively = async (dirPath: string): Promise<any[]> => {
        const requests: any[] = []
        const items = await window.electronAPI.readDir(dirPath)
        for (const item of items) {
          if (item.isDirectory) {
            const subRequests = await loadRequestsRecursively(item.path)
            requests.push(...subRequests)
          } else if (item.name.endsWith('.json') && item.name !== 'environments.json') {
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
      
      const items = await window.electronAPI.readDir(workspace.path)
      for (const item of items) {
        if (item.isDirectory && item.name !== '.git') {
          const requests = await loadRequestsRecursively(item.path)
          collections.push({
            id: item.name,
            name: item.name,
            path: item.path,
            requests,
          })
        }
      }

      // 2. Load environments
      let loadedEnvs: Environment[] = []
      try {
        const envPath = `${workspace.path}/environments.json`
        const exists = await window.electronAPI.exists(envPath)
        if (exists) {
          const content = await window.electronAPI.readFile(envPath)
          if (content) {
            loadedEnvs = JSON.parse(content)
          }
        }
      } catch (error) {
        console.error('Failed to load environments:', error)
      }

      setWorkspace({
        ...workspace,
        collections,
        environments: loadedEnvs
      })
      setEnvironments(loadedEnvs)

    } catch (e) {
       console.error("Error refreshing workspace:", e)
    }
  }

  // Watch for workspace changes to load environments
  useEffect(() => {
    if (workspace && workspace.environments) {
      setEnvironments(workspace.environments)
      
      // Restore active environment from local storage if available
      const savedActiveEnvId = localStorage.getItem(`activeEnv_${workspace.path}`)
      if (savedActiveEnvId) {
        const env = workspace.environments.find(e => e.id === savedActiveEnvId)
        if (env) {
          setActiveEnvironment(env)
        }
      }
    }
  }, [workspace?.path]) // Only reload when workspace path changes

  const saveEnvironmentsToDisk = async (envs: Environment[]) => {
    if (!workspace) return
    const envPath = `${workspace.path}/environments.json`
    try {
      await window.electronAPI.writeFile(envPath, JSON.stringify(envs, null, 2))
      // Auto-stage with git add
      try {
        await window.electronAPI.gitAdd([envPath])
      } catch (gitError) {
        console.warn('Failed to auto-stage environments.json:', gitError)
      }
    } catch (error) {
      console.error('Failed to save environments:', error)
    }
  }

  const createRequest = useCallback(() => {
    const req = defaultRequest()
    setTabs(prev => [...prev, req])
    setActiveTabId(req.id)
    return req
  }, [])

  const updateRequest = useCallback((updates: Partial<ApiRequest>) => {
    if (activeTabId) {
      setTabs(prev => prev.map(t => 
        t.id === activeTabId ? { ...t, ...updates } : t
      ))
    }
  }, [activeTabId])

  const openTab = useCallback((request: ApiRequest) => {
    setTabs(prev => {
      if (!prev.find(t => t.id === request.id)) {
        return [...prev, request]
      }
      return prev
    })
    setActiveTabId(request.id)
  }, [])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId)
      if (activeTabId === tabId) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
      }
      return newTabs
    })
  }, [activeTabId])

  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs(prev => {
      const remainingTab = prev.find(t => t.id === tabId)
      if (!remainingTab) return prev
      setActiveTabId(tabId)
      return [remainingTab]
    })
  }, [])

  const closeAllTabs = useCallback(() => {
    setTabs([])
    setActiveTabId(null)
  }, [])

  const setCurrentRequest = useCallback((request: ApiRequest | null) => {
    if (request) {
      openTab(request)
    } else {
      setActiveTabId(null)
    }
  }, [openTab])

  const createCollection = useCallback(async (name: string): Promise<string | null> => {
    if (!workspace) return null
    const collectionPath = `${workspace.path}/${name}`
    try {
      await window.electronAPI.mkdir(collectionPath)
      const newCollection = {
        id: name,
        name,
        path: collectionPath,
        requests: [],
      }
      setWorkspace({
        ...workspace,
        collections: [...workspace.collections, newCollection],
      })
      return collectionPath
    } catch {
      return null
    }
  }, [workspace])

   const saveRequest = useCallback(async (collectionId: string): Promise<boolean> => {
     if (!workspace || !currentRequest) return false
     
     const collection = workspace.collections.find(c => c.id === collectionId)
     if (!collection) return false
     
     const fileName = `${currentRequest.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
     const filePath = `${collection.path}/${fileName}`
     
     try {
       await window.electronAPI.writeFile(filePath, JSON.stringify(currentRequest, null, 2))
       
       // Auto-stage all changes with git add .
       try {
         await window.electronAPI.gitAdd(['.'])
       } catch (gitError) {
         console.warn('Failed to auto-stage changes:', gitError)
         // Don't fail the save if git add fails
       }
       
       // Check if request already exists in collection (by ID)
       const existingIndex = collection.requests.findIndex(r => r.id === currentRequest.id)
       let updatedRequests: ApiRequest[]
       
       if (existingIndex !== -1) {
         // Update existing request
         updatedRequests = collection.requests.map((r, i) => 
           i === existingIndex ? currentRequest : r
         )
       } else {
         // Add new request
         updatedRequests = [...collection.requests, currentRequest]
       }
       
       const updatedCollection = {
         ...collection,
         requests: updatedRequests,
       }
       
       setWorkspace({
         ...workspace,
         collections: workspace.collections.map(c => 
           c.id === collectionId ? updatedCollection : c
         ),
       })
       
       return true
     } catch {
       return false
     }
   }, [workspace, currentRequest])

  const createEnvironment = useCallback((name: string): Environment => {
    const env: Environment = {
      id: uuidv4(),
      name,
      variables: [],
    }
    setEnvironments(prev => {
      const newEnvs = [...prev, env]
      saveEnvironmentsToDisk(newEnvs)
      return newEnvs
    })
    return env
  }, [workspace])

  const updateEnvironment = useCallback((env: Environment) => {
    setEnvironments(prev => {
      const newEnvs = prev.map(e => e.id === env.id ? env : e)
      saveEnvironmentsToDisk(newEnvs)
      return newEnvs
    })
    if (activeEnvironment?.id === env.id) {
      setActiveEnvironment(env)
    }
  }, [activeEnvironment, workspace])

  const deleteEnvironment = useCallback((envId: string) => {
    setEnvironments(prev => {
      const newEnvs = prev.filter(e => e.id !== envId)
      saveEnvironmentsToDisk(newEnvs)
      return newEnvs
    })
    if (activeEnvironment?.id === envId) {
      setActiveEnvironment(null)
    }
  }, [activeEnvironment, workspace])

  const deleteRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!workspace) return false
    
    try {
      // Find collection containing this request
      const collectionIndex = workspace.collections.findIndex(c => 
        c.requests.some(r => r.id === requestId)
      )
      
      if (collectionIndex === -1) return false
      
      const collection = workspace.collections[collectionIndex]
      const request = collection.requests.find(r => r.id === requestId)
      
      if (!request) return false
      
      // Delete the file
      const fileName = `${request.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
      const filePath = `${collection.path}/${fileName}`
      await window.electronAPI.delete(filePath)
      
      // Auto-stage deletion with git
      try {
        await window.electronAPI.gitAdd(['.'])
      } catch (gitError) {
        console.warn('Failed to auto-stage deletion:', gitError)
      }
      
      // Update workspace state
      const updatedCollection = {
        ...collection,
        requests: collection.requests.filter(r => r.id !== requestId),
      }
      
      const updatedCollections = workspace.collections.map((c, i) => 
        i === collectionIndex ? updatedCollection : c
      )
      
      setWorkspace({
        ...workspace,
        collections: updatedCollections,
      })
      
      // Close tab if it was deleted
      closeTab(requestId)
      
      return true
    } catch (error) {
      console.error('Failed to delete request:', error)
      return false
    }
  }, [workspace, currentRequest])

  const deleteCollection = useCallback(async (collectionId: string): Promise<boolean> => {
    if (!workspace) return false
    
    try {
      const collection = workspace.collections.find(c => c.id === collectionId)
      if (!collection) return false
      
      // Delete the entire collection directory
      await window.electronAPI.delete(collection.path)
      
      // Auto-stage deletion with git
      try {
        await window.electronAPI.gitAdd(['.'])
      } catch (gitError) {
        console.warn('Failed to auto-stage collection deletion:', gitError)
      }
      
      // Update workspace state
      const updatedCollections = workspace.collections.filter(c => c.id !== collectionId)
      
      setWorkspace({
        ...workspace,
        collections: updatedCollections,
      })
      
      // Clear from tabs if it was from deleted collection
      collection.requests.forEach(r => closeTab(r.id))
      
      return true
    } catch (error) {
      console.error('Failed to delete collection:', error)
      return false
    }
  }, [workspace, currentRequest])

  return (
    <AppContext.Provider
       value={{
          workspace,
          tabs,
          activeTabId,
          currentRequest,
          response,
          isLoading,
          activeEnvironment,
          environments,
          setWorkspace,
          setCurrentRequest,
          openTab,
          closeTab,
          closeOtherTabs,
          closeAllTabs,
          setActiveTabId,
          setResponse,
          setIsLoading,
          setActiveEnvironment: (env) => {
            setActiveEnvironment(env)
            if (workspace) {
              if (env) {
                localStorage.setItem(`activeEnv_${workspace.path}`, env.id)
              } else {
                localStorage.removeItem(`activeEnv_${workspace.path}`)
              }
            }
          },
          createRequest,
          updateRequest,
          saveRequest,
          deleteRequest,
          createCollection,
          deleteCollection,
          createEnvironment,
          updateEnvironment,
          deleteEnvironment,
          setEnvironments,
          refreshWorkspace,
       }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
