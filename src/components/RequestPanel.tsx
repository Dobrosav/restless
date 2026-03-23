import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../stores/AppContext'
import { HttpMethod, KeyValue } from '../types'
import { generateCurl } from '../lib/curlExport'
import { createHttpClient } from '../lib/httpWorkerClient'

const httpClient = createHttpClient()

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'WS', 'GRAPHQL']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
  WS: 'text-cyan-400',
  GRAPHQL: 'text-pink-400',
}

interface KeyValueEditorProps {
  items: KeyValue[]
  onChange: (items: KeyValue[]) => void
  placeholder?: string
}

function KeyValueEditor({ items, onChange, placeholder = 'Key' }: KeyValueEditorProps) {
  const addItem = () => {
    onChange([...items, { key: '', value: '', enabled: true }])
  }

  const updateItem = (index: number, updates: Partial<KeyValue>) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], ...updates }
    onChange(newItems)
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => updateItem(index, { enabled: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateItem(index, { key: e.target.value })}
            placeholder={placeholder}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateItem(index, { value: e.target.value })}
            placeholder="Value"
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          />
          <button
            onClick={() => removeItem(index)}
            className="text-gray-500 hover:text-red-400 px-1"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        + Add
      </button>
    </div>
  )
}

export function RequestPanel() {
  const { currentRequest, updateRequest, setTabResponse, clearTabResponse, setTabLoading, cancelRequest, createRequest, activeEnvironment, workspace, saveRequest, createCollection, tabResponses, activeTabId, isLoading } = useApp()
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth' | 'script'>('params')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false)
  const [showCurlModal, setShowCurlModal] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const responseRef = useRef(tabResponses[activeTabId || ''] || null)
  responseRef.current = activeTabId ? tabResponses[activeTabId] || null : null
  const clearRequest = useCallback(() => {
    updateRequest({ 
      url: '', 
      headers: [], 
      params: [], 
      body: { type: 'none', content: '' }, 
      auth: { type: 'none' } 
    })
    if (activeTabId) clearTabResponse(activeTabId)
  }, [updateRequest, activeTabId, clearTabResponse])

  const handleSendRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSendRef.current?.()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        setShowSaveDialog(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        clearRequest()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        urlInputRef.current?.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        if (responseRef.current?.body) {
          navigator.clipboard.writeText(responseRef.current.body)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault()
        setActiveTab('params')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault()
        setActiveTab('headers')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault()
        setActiveTab('body')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') {
        e.preventDefault()
        setActiveTab('auth')
      }
      if (e.key === 'Escape') {
        setShowSaveDialog(false)
        setShowCurlModal(false)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [clearRequest])

  // Check if current request is already saved
  const isRequestSaved = () => {
    if (!currentRequest || !workspace) return false
    return workspace.collections.some(collection =>
      collection.requests.some(req => req.id === currentRequest.id)
    )
  }

  // Get the collection where the request is saved
  const getSavedCollection = () => {
    if (!currentRequest || !workspace) return null
    for (const collection of workspace.collections) {
      if (collection.requests.some(req => req.id === currentRequest.id)) {
        return collection
      }
    }
    return null
  }

  if (!currentRequest) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p>No request selected</p>
          <button
            onClick={createRequest}
            className="mt-2 text-blue-400 hover:text-blue-300"
          >
            Create new request
          </button>
        </div>
      </div>
    )
  }

  const handleSend = async () => {
    if (!currentRequest.url && currentRequest.method !== 'WS') return
    if (!activeTabId) return
    
    setTabLoading(activeTabId, true)
    clearTabResponse(activeTabId)
    
    try {
      const electronAPI = (window as any).electronAPI
      if (electronAPI && electronAPI.httpSendRequest) {
        const response = await electronAPI.httpSendRequest(currentRequest, activeEnvironment)
        setTabResponse(activeTabId, response)
      } else {
        const response = await httpClient.sendRequest(currentRequest, activeEnvironment)
        setTabResponse(activeTabId, response)
      }
    } catch (error: any) {
      setTabResponse(activeTabId, {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: error.message,
        time: 0,
        size: 0,
        type: 'http',
      })
    } finally {
      setTabLoading(activeTabId, false)
    }
  }
  handleSendRef.current = handleSend

  const handleCancel = () => {
    if (activeTabId) {
      const electronAPI = (window as any).electronAPI
      if (electronAPI && electronAPI.httpCancelRequest) {
        electronAPI.httpCancelRequest()
      }
      httpClient.cancelRequest()
      cancelRequest(activeTabId)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setShowSaveDialog(true)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full" onKeyDown={handleKeyDown}>
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <select
          value={currentRequest.method}
          onChange={(e) => updateRequest({ method: e.target.value as HttpMethod })}
          className={`bg-gray-700 border border-gray-600 rounded px-2 py-1 font-mono text-sm font-bold ${METHOD_COLORS[currentRequest.method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className={METHOD_COLORS[m]}>
              {m}
            </option>
          ))}
        </select>
        
        <input
          ref={urlInputRef}
          type="text"
          value={currentRequest.url}
          onChange={(e) => updateRequest({ url: e.target.value })}
          placeholder="Enter URL"
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white"
        />
        
        <button
          onClick={() => setShowSaveDialog(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-medium"
        >
          Save
        </button>
        {isLoading ? (
          <button
            onClick={handleCancel}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded font-medium"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={handleSend}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded font-medium"
          >
            Send
          </button>
        )}
        <button
          onClick={() => setShowCurlModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-medium"
          title="Export as curl"
        >
          cURL
        </button>
      </div>

      <div className="border-b border-gray-700">
        <div className="flex">
          {(['params', 'headers', 'body', 'auth', 'script'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm ${
                activeTab === tab
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'params' && (
          <KeyValueEditor
            items={currentRequest.params}
            onChange={(params) => updateRequest({ params })}
            placeholder="Parameter"
          />
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor
            items={currentRequest.headers}
            onChange={(headers) => updateRequest({ headers })}
            placeholder="Header"
          />
        )}

        {activeTab === 'body' && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {(['none', 'json', 'text', 'form-data', 'x-www-form-urlencoded', 'graphql'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => updateRequest({ body: { ...currentRequest.body, type, graphql: currentRequest.body.graphql || { query: '', variables: '{}' } } })}
                  className={`px-2 py-1 text-xs rounded ${
                    currentRequest.body.type === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {currentRequest.body.type === 'graphql' && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Query</label>
                  <textarea
                    className="w-full h-32 bg-[#1e1e1e] text-gray-200 font-mono text-xs p-3 rounded border border-gray-600 resize-none focus:outline-none focus:border-blue-500"
                    value={currentRequest.body.graphql?.query || ''}
                    onChange={(e) => updateRequest({ body: { ...currentRequest.body, graphql: { query: e.target.value, variables: currentRequest.body.graphql?.variables || '{}' } } })}
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Variables</label>
                  <textarea
                    className="w-full h-20 bg-[#1e1e1e] text-gray-200 font-mono text-xs p-3 rounded border border-gray-600 resize-none focus:outline-none focus:border-blue-500"
                    value={currentRequest.body.graphql?.variables || '{}'}
                    onChange={(e) => updateRequest({ body: { ...currentRequest.body, graphql: { query: currentRequest.body.graphql?.query || '', variables: e.target.value } } })}
                    spellCheck={false}
                  />
                </div>
              </div>
            )}
            {currentRequest.body.type !== 'none' && currentRequest.body.type !== 'graphql' && (
              <textarea
                className="w-full h-52 bg-[#1e1e1e] text-gray-200 font-mono text-xs p-3 rounded border border-gray-600 resize-none focus:outline-none focus:border-blue-500"
                value={currentRequest.body.content}
                onChange={(e) => updateRequest({ body: { ...currentRequest.body, content: e.target.value } })}
                spellCheck={false}
              />
            )}
          </div>
        )}

        {activeTab === 'auth' && (
          <div className="space-y-3">
            <select
              value={currentRequest.auth.type}
              onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, type: e.target.value as any } })}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
            >
              <option value="none">No Auth</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer Token</option>
              <option value="api-key">API Key</option>
            </select>
            
            {currentRequest.auth.type === 'basic' && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Username"
                  value={currentRequest.auth.basic?.username || ''}
                  onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, basic: { username: e.target.value, password: currentRequest.auth.basic?.password || '' } } })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={currentRequest.auth.basic?.password || ''}
                  onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, basic: { username: currentRequest.auth.basic?.username || '', password: e.target.value } } })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                />
              </div>
            )}
            
            {currentRequest.auth.type === 'bearer' && (
              <input
                type="text"
                placeholder="Token"
                value={currentRequest.auth.bearer?.token || ''}
                onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, bearer: { token: e.target.value } } })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
              />
            )}
            
            {currentRequest.auth.type === 'api-key' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Key"
                    value={currentRequest.auth.apiKey?.key || ''}
                    onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, apiKey: { key: e.target.value, value: currentRequest.auth.apiKey?.value || '', in: currentRequest.auth.apiKey?.in || 'header' } } })}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={currentRequest.auth.apiKey?.value || ''}
                    onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, apiKey: { key: currentRequest.auth.apiKey?.key || '', value: e.target.value, in: currentRequest.auth.apiKey?.in || 'header' } } })}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <select
                  value={currentRequest.auth.apiKey?.in || 'header'}
                  onChange={(e) => updateRequest({ auth: { ...currentRequest.auth, apiKey: { key: currentRequest.auth.apiKey?.key || '', value: currentRequest.auth.apiKey?.value || '', in: e.target.value as 'header' | 'query' } } })}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                >
                  <option value="header">Header</option>
                  <option value="query">Query Param</option>
                </select>
              </div>
            )}
          </div>
        )}

        {activeTab === 'script' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Pre-request Script</label>
              <textarea
                className="w-full h-28 bg-[#1e1e1e] text-gray-200 font-mono text-xs p-3 rounded border border-gray-600 resize-none focus:outline-none focus:border-blue-500"
                value={currentRequest.script.pre}
                onChange={(e) => updateRequest({ script: { ...currentRequest.script, pre: e.target.value } })}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Post-request Script</label>
              <textarea
                className="w-full h-28 bg-[#1e1e1e] text-gray-200 font-mono text-xs p-3 rounded border border-gray-600 resize-none focus:outline-none focus:border-blue-500"
                value={currentRequest.script.post}
                onChange={(e) => updateRequest({ script: { ...currentRequest.script, post: e.target.value } })}
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>

       {showSaveDialog && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-gray-800 p-4 rounded-lg w-80">
             <h3 className="text-white font-medium mb-3">
               {isRequestSaved() ? 'Update Request' : 'Save Request'}
             </h3>
             
             {!workspace ? (
               <div className="text-yellow-400 text-sm mb-3">Please open a workspace folder first!</div>
             ) : workspace.collections.length === 0 ? (
               <div className="text-yellow-400 text-sm mb-3">No collections. Create one below!</div>
             ) : null}
             
             {isRequestSaved() && (
               <div className="text-cyan-400 text-sm mb-3 p-2 bg-cyan-900 bg-opacity-30 rounded">
                 This request already exists. Click Save to update it.
               </div>
             )}
             
             <div className="mb-3">
               <label className="text-gray-400 text-sm">Request Name</label>
               <input
                 type="text"
                 value={currentRequest.name}
                 onChange={(e) => updateRequest({ name: e.target.value })}
                 className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm mt-1"
               />
             </div>
             
             <div className="mb-3">
               <label className="text-gray-400 text-sm">Collection</label>
               {workspace && workspace.collections.length > 0 ? (
                 <select
                   id="collection-select"
                   defaultValue={getSavedCollection()?.id || ''}
                   className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm mt-1"
                 >
                   {workspace?.collections.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                 </select>
               ) : (
                 <div className="text-gray-500 text-sm mt-1">No collections available</div>
               )}
               {showNewCollectionInput ? (
                 <div className="flex gap-1 mt-1">
                   <input
                     type="text"
                     value={newCollectionName}
                     onChange={(e) => setNewCollectionName(e.target.value)}
                     placeholder="Collection name"
                     className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                     autoFocus
                   />
                   <button
                     onClick={async () => {
                       if (newCollectionName.trim()) {
                         const path = await createCollection(newCollectionName.trim())
                         if (path) {
                           setNewCollectionName('')
                           setShowNewCollectionInput(false)
                         }
                       }
                     }}
                     className="text-xs text-green-400 hover:text-green-300 px-1"
                   >
                     ✓
                   </button>
                   <button
                     onClick={() => {
                       setShowNewCollectionInput(false)
                       setNewCollectionName('')
                     }}
                     className="text-xs text-red-400 hover:text-red-300 px-1"
                   >
                     ✕
                   </button>
                 </div>
               ) : (
                 <button
                   onClick={() => setShowNewCollectionInput(true)}
                   className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                 >
                   + New Collection
                 </button>
               )}
             </div>
             
             <div className="flex gap-2">
               <button
                 onClick={async () => {
                   if (!workspace) {
                     alert('Please open a workspace folder first!')
                     return
                   }
                   if (workspace.collections.length === 0) {
                     alert('Please create a collection first!')
                     return
                   }
                   const select = document.getElementById('collection-select') as HTMLSelectElement
                   if (!select?.value) {
                     alert('Please select a collection!')
                     return
                   }
                   const collectionId = select.value
                   const success = await saveRequest(collectionId)
                   if (success) {
                     setShowSaveDialog(false)
                   } else {
                     alert('Failed to save request. Check console for details.')
                   }
                 }}
                 className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
               >
                 {isRequestSaved() ? 'Update' : 'Save'}
               </button>
               <button
                 onClick={() => setShowSaveDialog(false)}
                 className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
               >
                 Cancel
               </button>
             </div>
           </div>
         </div>
       )}

       {showCurlModal && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-gray-800 rounded shadow-lg border border-gray-600 max-w-2xl w-full mx-4">
             <div className="flex items-center justify-between p-4 border-b border-gray-700">
               <h2 className="text-lg font-bold text-white">Export as cURL</h2>
               <button
                 onClick={() => setShowCurlModal(false)}
                 className="text-gray-400 hover:text-gray-300 text-2xl"
               >
                 ×
               </button>
             </div>
             
             <div className="p-4 bg-gray-900">
               <div className="bg-gray-800 border border-gray-700 rounded p-3 mb-3 max-h-64 overflow-y-auto">
                 <code className="text-gray-200 text-xs font-mono whitespace-pre-wrap break-all">
                   {generateCurl(currentRequest, activeEnvironment)}
                 </code>
               </div>
               
               <div className="flex gap-2">
                 <button
                   onClick={() => {
                     navigator.clipboard.writeText(generateCurl(currentRequest, activeEnvironment))
                     alert('cURL command copied to clipboard!')
                   }}
                   className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium"
                 >
                   Copy to Clipboard
                 </button>
                 <button
                   onClick={() => setShowCurlModal(false)}
                   className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium"
                 >
                   Close
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}
     </div>
   )
}
