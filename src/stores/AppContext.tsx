import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Workspace, ApiRequest, ResponseData, HttpMethod, Environment, Collection } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface AppState {
  workspace: Workspace | null
  tabs: ApiRequest[]
  activeTabId: string | null
  tabResponses: Record<string, ResponseData | null>
  tabLoadingStates: Record<string, boolean>
}

interface AppContextType extends AppState {
  currentRequest: ApiRequest | null
  currentCollection: Collection | null
  activeEnvironment: Environment | null
  environments: Environment[]
  isLoading: boolean
  setWorkspace: (workspace: Workspace | null) => void
  setCurrentRequest: (request: ApiRequest | null) => void
  openTab: (request: ApiRequest) => void
  closeTab: (tabId: string) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  setActiveTabId: (tabId: string | null) => void
  setTabResponse: (tabId: string, response: ResponseData | null) => void
  clearTabResponse: (tabId: string) => void
  setTabLoading: (tabId: string, loading: boolean) => void
  cancelRequest: (tabId: string) => void
  setActiveEnvironment: (env: Environment | null) => void
  createRequest: () => ApiRequest
  updateRequest: (request: Partial<ApiRequest>) => void
  saveRequest: (collectionId: string) => Promise<boolean>
  deleteRequest: (requestId: string) => Promise<boolean>
  createCollection: (name: string) => Promise<string | null>
  deleteCollection: (collectionId: string) => Promise<boolean>
  createEnvironment: (name: string) => Environment | null
  updateEnvironment: (env: Environment) => void
  deleteEnvironment: (envId: string) => void
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

const findCollectionRecursive = (collections: Collection[], predicate: (c: Collection) => boolean): Collection | null => {
  for (const c of collections) {
    if (predicate(c)) return c
    const found = findCollectionRecursive(c.collections || [], predicate)
    if (found) return found
  }
  return null
}

const updateCollectionRecursive = (collections: Collection[], targetId: string, updater: (c: Collection) => Collection): Collection[] => {
  return collections.map(c => {
    if (c.id === targetId) return updater(c)
    return {
      ...c,
      collections: updateCollectionRecursive(c.collections || [], targetId, updater)
    }
  })
}

const removeCollectionRecursive = (collections: Collection[], targetId: string): Collection[] => {
  return collections.filter(c => c.id !== targetId).map(c => ({
    ...c,
    collections: removeCollectionRecursive(c.collections || [], targetId)
  }))
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tabs, setTabs] = useState<ApiRequest[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const currentRequest = tabs.find(t => t.id === activeTabId) || null
  const currentCollection = workspace ? findCollectionRecursive(workspace.collections, c => c.requests.some(r => r.id === currentRequest?.id)) : null
  const environments = currentCollection?.environments || []
  const activeEnvironment = environments.find(e => e.id === currentCollection?.activeEnvironmentId) || null
  
  const [tabResponses, setTabResponses] = useState<Record<string, ResponseData | null>>({})
  const [tabLoadingStates, setTabLoadingStates] = useState<Record<string, boolean>>({})

  const isLoading = activeTabId ? (tabLoadingStates[activeTabId] || false) : false

  const setTabLoading = useCallback((tabId: string, loading: boolean) => {
    setTabLoadingStates(prev => ({ ...prev, [tabId]: loading }))
  }, [])

  const cancelRequest = useCallback(async (tabId: string) => {
    setTabLoadingStates(prev => ({ ...prev, [tabId]: false }))
  }, [])

  const refreshWorkspace = async () => {
    if (!workspace) return
    
    try {
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

      const items = await window.electronAPI.readDir(workspace.path)
      for (const item of items) {
        if (item.isDirectory && item.name !== '.git') {
          const collection = await loadCollectionData(item.path, item.name)
          collections.push(collection)
        }
      }

      setWorkspace({
        ...workspace,
        collections
      })
    } catch (e) {
       console.error("Error refreshing workspace:", e)
    }
  }

  const setTabResponse = useCallback((tabId: string, response: ResponseData | null) => {
    setTabResponses(prev => ({ ...prev, [tabId]: response }))
  }, [])

  const clearTabResponse = useCallback((tabId: string) => {
    setTabResponses(prev => {
      const newResponses = { ...prev }
      delete newResponses[tabId]
      return newResponses
    })
  }, [])

  const saveEnvironmentsToDisk = async (collectionId: string, envs: Environment[]) => {
    if (!workspace) return
    const collection = findCollectionRecursive(workspace.collections, c => c.id === collectionId)
    if (!collection) return
    
    const envPath = `${collection.path}/environments.json`
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
    clearTabResponse(tabId)
  }, [activeTabId, clearTabResponse])

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

  const createCollection = useCallback(async (name: string, parentId?: string): Promise<string | null> => {
    if (!workspace) return null
    let parentPath = workspace.path
    if (parentId) {
      const parent = findCollectionRecursive(workspace.collections, c => c.id === parentId)
      if (parent) parentPath = parent.path
    }
    const collectionPath = `${parentPath}/${name}`
    try {
      await window.electronAPI.mkdir(collectionPath)
      const newCollection = {
        id: collectionPath,
        name,
        path: collectionPath,
        requests: [],
        collections: []
      }
      if (parentId) {
        setWorkspace({
          ...workspace,
          collections: updateCollectionRecursive(workspace.collections, parentId, c => ({
            ...c,
            collections: [...(c.collections || []), newCollection]
          }))
        })
      } else {
        setWorkspace({
          ...workspace,
          collections: [...workspace.collections, newCollection],
        })
      }
      return collectionPath
    } catch {
      return null
    }
  }, [workspace])

   const saveRequest = useCallback(async (collectionId: string): Promise<boolean> => {
     if (!workspace || !currentRequest) return false
     
     const collection = findCollectionRecursive(workspace.collections, c => c.id === collectionId)
     if (!collection) return false
     
     const fileName = `${(currentRequest.name || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}.json`
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
       
       setWorkspace({
         ...workspace,
         collections: updateCollectionRecursive(workspace.collections, collectionId, c => ({
           ...c,
           requests: updatedRequests
         }))
       })
       
       return true
     } catch {
       return false
     }
   }, [workspace, currentRequest])

  const createEnvironment = useCallback((name: string): Environment | null => {
    if (!workspace || !currentCollection) return null
    const env: Environment = {
      id: uuidv4(),
      name,
      variables: [],
    }
    const newEnvs = [...(currentCollection.environments || []), env]
    
    setWorkspace({
      ...workspace,
      collections: updateCollectionRecursive(workspace.collections, currentCollection.id, c => ({
        ...c,
        environments: newEnvs
      }))
    })
    saveEnvironmentsToDisk(currentCollection.id, newEnvs)
    return env
  }, [workspace, currentCollection])

  const updateEnvironment = useCallback((env: Environment) => {
    if (!workspace || !currentCollection) return
    const newEnvs = (currentCollection.environments || []).map(e => e.id === env.id ? env : e)
    
    setWorkspace({
      ...workspace,
      collections: updateCollectionRecursive(workspace.collections, currentCollection.id, c => ({
        ...c,
        environments: newEnvs
      }))
    })
    saveEnvironmentsToDisk(currentCollection.id, newEnvs)
  }, [workspace, currentCollection])

  const deleteEnvironment = useCallback((envId: string) => {
    if (!workspace || !currentCollection) return
    const newEnvs = (currentCollection.environments || []).filter(e => e.id !== envId)
    
    const isDeletingActive = currentCollection.activeEnvironmentId === envId
    
    setWorkspace({
      ...workspace,
      collections: updateCollectionRecursive(workspace.collections, currentCollection.id, c => ({
        ...c,
        environments: newEnvs,
        activeEnvironmentId: isDeletingActive ? undefined : c.activeEnvironmentId
      }))
    })
    
    if (isDeletingActive) {
      localStorage.removeItem(`activeEnv_${currentCollection.id}`)
    }
    
    saveEnvironmentsToDisk(currentCollection.id, newEnvs)
  }, [workspace, currentCollection])

  const deleteRequest = useCallback(async (requestId: string): Promise<boolean> => {
    if (!workspace) return false
    
    try {
      // Find collection containing this request
      const collection = findCollectionRecursive(workspace.collections, c => c.requests.some(r => r.id === requestId))
      
      if (!collection) return false
      
      const request = collection.requests.find(r => r.id === requestId)
      
      if (!request) return false
      
      // Delete the file
      if (request.path) {
        await window.electronAPI.delete(request.path)
      } else {
        const fileName = `${(request.name || 'Untitled').replace(/[^a-zA-Z0-9]/g, '_')}.json`
        const filePath = `${collection.path}/${fileName}`
        await window.electronAPI.delete(filePath)
      }
      
      // Auto-stage deletion with git
      try {
        await window.electronAPI.gitAdd(['.'])
      } catch (gitError) {
        console.warn('Failed to auto-stage deletion:', gitError)
      }
      
      setWorkspace({
        ...workspace,
        collections: updateCollectionRecursive(workspace.collections, collection.id, c => ({
          ...c,
          requests: c.requests.filter(r => r.id !== requestId)
        }))
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
      const collection = findCollectionRecursive(workspace.collections, c => c.id === collectionId)
      if (!collection) return false
      
      // Delete the entire collection directory
      await window.electronAPI.delete(collection.path)
      
      // Auto-stage deletion with git
      try {
        await window.electronAPI.gitAdd(['.'])
      } catch (gitError) {
        console.warn('Failed to auto-stage collection deletion:', gitError)
      }
      
      setWorkspace({
        ...workspace,
        collections: removeCollectionRecursive(workspace.collections, collectionId)
      })
      
      // Clear from tabs if it was from deleted collection
      // Wait, we need to recursively gather all requests from this collection
      const gatherRequests = (c: Collection): ApiRequest[] => {
        let reqs = [...c.requests]
        for (const sub of (c.collections || [])) {
          reqs = [...reqs, ...gatherRequests(sub)]
        }
        return reqs
      }
      gatherRequests(collection).forEach(r => closeTab(r.id))
      
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
          tabResponses,
          tabLoadingStates,
          currentRequest,
          currentCollection,
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
          setTabResponse,
          clearTabResponse,
          setTabLoading,
          cancelRequest,
          setActiveEnvironment: (env) => {
            if (!workspace || !currentCollection) return
            
            setWorkspace({
              ...workspace,
              collections: workspace.collections.map(c => 
                c.id === currentCollection.id ? { ...c, activeEnvironmentId: env?.id } : c
              )
            })
            
            if (env) {
              localStorage.setItem(`activeEnv_${currentCollection.id}`, env.id)
            } else {
              localStorage.removeItem(`activeEnv_${currentCollection.id}`)
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
