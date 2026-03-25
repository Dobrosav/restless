import { useState, useRef } from 'react'
import { useApp } from '../stores/AppContext'
import { parseCurl } from '../lib/curlImport'
import { Collection } from '../types'

function RequestItem({ request, isActive, onClick, onDelete }: { request: any; isActive: boolean; onClick: () => void; onDelete: () => void }) {
  const methodColors: Record<string, string> = {
    GET: 'text-green-400',
    POST: 'text-yellow-400',
    PUT: 'text-blue-400',
    PATCH: 'text-purple-400',
    DELETE: 'text-red-400',
  }

  return (
    <div className="flex items-center gap-1 group">
      <button
        onClick={onClick}
        className={`flex-1 text-left text-sm py-1 px-2 rounded flex items-center gap-2 ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
      >
        <span className={`text-xs font-mono w-10 ${methodColors[request.method] || 'text-gray-400'}`}>
          {request.method}
        </span>
        <span className="truncate">{request.name}</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="text-xs text-red-400 hover:text-red-300 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete request"
      >
        ×
      </button>
    </div>
  )
}

function CollectionNode({
  collection,
  depth,
  expandedCollections,
  toggleExpanded,
  currentRequest,
  setCurrentRequest,
  deleteRequest,
  deleteCollection,
  createCollection
}: {
  collection: Collection,
  depth: number,
  expandedCollections: Record<string, boolean>,
  toggleExpanded: (id: string) => void,
  currentRequest: any,
  setCurrentRequest: any,
  deleteRequest: any,
  deleteCollection: any,
  createCollection: any
}) {
  const isExpanded = expandedCollections[collection.id] !== false
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const handleCreateSubFolder = async () => {
    if (!newFolderName.trim()) return
    const path = await createCollection(newFolderName.trim(), collection.id)
    if (path) {
      setNewFolderName('')
      setShowNewFolder(false)
      if (!isExpanded) toggleExpanded(collection.id)
    } else {
      alert('Failed to create subfolder')
    }
  }

  return (
    <div className="group/node mt-1">
      <div 
        className="flex items-center gap-1 relative hover:bg-gray-700 rounded transition-colors group/item" 
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          onClick={() => toggleExpanded(collection.id)}
          className="flex items-center flex-1 text-left text-sm text-gray-300 hover:text-white p-1"
        >
          <span className="mr-1 text-xs">{isExpanded ? '▼' : '▶'}</span>
          <span className="truncate">{collection.name}</span>
        </button>
        <div className="flex bg-gray-700 opacity-0 group-hover/item:opacity-100 transition-opacity absolute right-1 items-center px-1 rounded">
          <button
            onClick={() => setShowNewFolder(true)}
            className="text-[10px] text-blue-400 hover:text-blue-300 px-1.5"
            title="New Subfolder"
          >
            +📁
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete collection "${collection.name}" and all its contents?`)) {
                deleteCollection(collection.id)
              }
            }}
            className="text-xs text-red-400 hover:text-red-300 px-1.5"
            title="Delete collection"
          >
            ×
          </button>
        </div>
      </div>

      {showNewFolder && (
        <div className="flex gap-1 my-1" style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs text-white"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSubFolder()}
          />
          <button onClick={handleCreateSubFolder} className="text-xs text-green-400">✓</button>
          <button onClick={() => setShowNewFolder(false)} className="text-xs text-red-400">✕</button>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-0.5">
          {collection.collections?.map(sub => (
            <CollectionNode
              key={sub.id}
              collection={sub}
              depth={depth + 1}
              expandedCollections={expandedCollections}
              toggleExpanded={toggleExpanded}
              currentRequest={currentRequest}
              setCurrentRequest={setCurrentRequest}
              deleteRequest={deleteRequest}
              deleteCollection={deleteCollection}
              createCollection={createCollection}
            />
          ))}
          {collection.requests.map((request) => (
            <div style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }} key={request.id}>
              <RequestItem
                request={request}
                isActive={currentRequest?.id === request.id}
                onClick={() => setCurrentRequest(request)}
                onDelete={async () => {
                  if (confirm(`Delete request "${request.name}"?`)) {
                    await deleteRequest(request.id)
                  }
                }}
              />
            </div>
          ))}
          {(!collection.collections || collection.collections.length === 0) && collection.requests.length === 0 && (
            <p className="text-xs text-gray-500 p-1 italic" style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}>Empty</p>
          )}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { workspace, currentRequest, setCurrentRequest, createRequest, createCollection, deleteRequest, deleteCollection, openTab, refreshWorkspace } = useApp()
  const [collectionsOpen, setCollectionsOpen] = useState(true)
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({})
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [showImportCurlModal, setShowImportCurlModal] = useState(false)
  const [curlInput, setCurlInput] = useState('')
  const [curlError, setCurlError] = useState('')
  const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleImport = async () => {
    if (!workspace) {
      alert('Please open a workspace folder first!')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !workspace) return

      try {
        const text = await file.text()
        const result = await window.electronAPI.postmanImport(workspace.path, text)

        if (result.success && result.collectionName) {
          await refreshWorkspace()
          alert(`Successfully imported collection "${result.collectionName}"!`)
        } else {
          alert('Failed to import collection. ' + (result.error || 'Make sure the file is a valid Postman collection.'))
        }
      } catch (err) {
        console.error('Import error:', err)
        alert('Failed to import collection. Check console for details.')
      }
    }
    input.click()
  }

  const handleImportCurl = () => {
    const trimmed = curlInput.trim()
    if (!trimmed) {
      setCurlError('Please paste a curl command.')
      return
    }
    try {
      const parsed = parseCurl(trimmed)
      const newRequest: import('../types').ApiRequest = {
        id: crypto.randomUUID(),
        name: parsed.url ? `Imported: ${parsed.method || 'GET'} ${parsed.url}` : 'Imported Request',
        method: parsed.method || 'GET',
        url: parsed.url || '',
        params: parsed.params || [],
        headers: parsed.headers || [],
        body: parsed.body || { type: 'none', content: '' },
        auth: parsed.auth || { type: 'none' },
        script: { pre: '', post: '' },
      }
      openTab(newRequest)
      setShowImportCurlModal(false)
      setCurlInput('')
      setCurlError('')
    } catch (err) {
      setCurlError('Failed to parse curl command. Please check the syntax.')
    }
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return

    const path = await createCollection(newCollectionName.trim())
    if (path) {
      setNewCollectionName('')
      setShowNewCollection(false)
    } else {
      alert('Failed to create collection')
    }
  }

  const toggleCollectionExpanded = (collectionId: string) => {
    setExpandedCollections(prev => ({
      ...prev,
      [collectionId]: !prev[collectionId],
    }))
  }

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <img src="./logo.png" alt="Restless" className="h-[98px] -ml-3 w-auto object-contain" />
          <div className="flex gap-1">
            <div
              className="relative"
              onMouseEnter={() => {
                if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current)
                setShowImportDropdown(true)
              }}
              onMouseLeave={() => {
                dropdownTimeout.current = setTimeout(() => setShowImportDropdown(false), 150)
              }}
            >
              <button
                className="text-xs bg-gray-600 px-2 py-1 rounded hover:bg-gray-500 transition-colors"
              >
                Import ▾
              </button>
              {showImportDropdown && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-gray-700 border border-gray-600 rounded shadow-lg z-50">
                  <button
                    onClick={() => { setShowImportDropdown(false); handleImport() }}
                    className="w-full text-left text-xs px-3 py-2 hover:bg-gray-600 text-gray-200 rounded-t"
                  >
                    Collection
                  </button>
                  <button
                    onClick={() => { setShowImportDropdown(false); setCurlInput(''); setCurlError(''); setShowImportCurlModal(true) }}
                    className="w-full text-left text-xs px-3 py-2 hover:bg-gray-600 text-gray-200 rounded-b"
                  >
                    ⌨ cURL
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={createRequest}
              className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 transition-colors"
            >
              + New
            </button>
          </div>
        </div>
        {workspace && (
          <div className="mt-2 text-xs text-gray-400 truncate" title={workspace.path}>
            {workspace.path.split(/[\\/]/).pop()}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <button
          onClick={() => setCollectionsOpen(!collectionsOpen)}
          className="flex items-center w-full text-left text-sm text-gray-300 hover:text-white p-1"
        >
          <span className="mr-1">{collectionsOpen ? '▼' : '▶'}</span>
          Collections
        </button>

        {collectionsOpen && workspace && (
          <div className="space-y-2">
            {showNewCollection ? (
              <div className="flex gap-1 mb-2 px-1">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCollection()}
                />
                <button
                  onClick={handleCreateCollection}
                  className="text-xs text-green-400 hover:text-green-300 px-1"
                >
                  ✓
                </button>
                <button
                  onClick={() => {
                    setShowNewCollection(false)
                    setNewCollectionName('')
                  }}
                  className="text-xs text-red-400 hover:text-red-300 px-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="text-[11px] px-2 opacity-60 hover:opacity-100 transition-opacity text-blue-400 hover:text-blue-300 mb-1"
              >
                + New Collection
              </button>
            )}
            {workspace.collections.length === 0 ? (
              <p className="text-xs text-gray-500 p-2">No collections yet</p>
            ) : (
              <div className="space-y-0.5">
                {workspace.collections.map((collection) => (
                  <CollectionNode
                    key={collection.id}
                    collection={collection}
                    depth={0}
                    expandedCollections={expandedCollections}
                    toggleExpanded={toggleCollectionExpanded}
                    currentRequest={currentRequest}
                    setCurrentRequest={setCurrentRequest}
                    deleteRequest={deleteRequest}
                    deleteCollection={deleteCollection}
                    createCollection={createCollection}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showImportCurlModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-4 rounded-lg w-[520px] max-w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Import cURL</h3>
              <button
                onClick={() => setShowImportCurlModal(false)}
                className="text-gray-400 hover:text-gray-200 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2">Paste curl command below:</p>
            <textarea
              value={curlInput}
              onChange={(e) => { setCurlInput(e.target.value); setCurlError('') }}
              placeholder={`curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' -d '{"key":"value"}'`}
              className="w-full h-40 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowImportCurlModal(false)
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleImportCurl()
              }}
            />
            {curlError && (
              <p className="text-red-400 text-xs mt-1">{curlError}</p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleImportCurl}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium"
              >
                Import
              </button>
              <button
                onClick={() => setShowImportCurlModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm"
              >
                Otkaži
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
