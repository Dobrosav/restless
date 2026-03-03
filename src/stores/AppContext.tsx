import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Workspace, ApiRequest, ResponseData, HttpMethod, Environment } from '../types'
import { v4 as uuidv4 } from 'uuid'

interface AppState {
  workspace: Workspace | null
  currentRequest: ApiRequest | null
  response: ResponseData | null
  isLoading: boolean
  activeEnvironment: Environment | null
  environments: Environment[]
}

interface AppContextType extends AppState {
  workspace: Workspace | null
  currentRequest: ApiRequest | null
  response: ResponseData | null
  isLoading: boolean
  activeEnvironment: Environment | null
  environments: Environment[]
  setWorkspace: (workspace: Workspace | null) => void
  setCurrentRequest: (request: ApiRequest | null) => void
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
  const [currentRequest, setCurrentRequest] = useState<ApiRequest | null>(null)
  const [response, setResponse] = useState<ResponseData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])

  const createRequest = useCallback(() => {
    const req = defaultRequest()
    setCurrentRequest(req)
    return req
  }, [])

  const updateRequest = useCallback((updates: Partial<ApiRequest>) => {
    if (currentRequest) {
      setCurrentRequest({ ...currentRequest, ...updates })
    }
  }, [currentRequest])

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
    setEnvironments(prev => [...prev, env])
    return env
  }, [])

  const updateEnvironment = useCallback((env: Environment) => {
    setEnvironments(prev => prev.map(e => e.id === env.id ? env : e))
    if (activeEnvironment?.id === env.id) {
      setActiveEnvironment(env)
    }
  }, [activeEnvironment])

  const deleteEnvironment = useCallback((envId: string) => {
    setEnvironments(prev => prev.filter(e => e.id !== envId))
    if (activeEnvironment?.id === envId) {
      setActiveEnvironment(null)
    }
  }, [activeEnvironment])

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
      
      // Clear current request if it was deleted
      if (currentRequest?.id === requestId) {
        setCurrentRequest(null)
      }
      
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
      
      // Clear current request if it was from deleted collection
      if (currentRequest && collection.requests.some(r => r.id === currentRequest.id)) {
        setCurrentRequest(null)
      }
      
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
          currentRequest,
          response,
          isLoading,
          activeEnvironment,
          environments,
          setWorkspace,
          setCurrentRequest,
          setResponse,
          setIsLoading,
          setActiveEnvironment,
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
