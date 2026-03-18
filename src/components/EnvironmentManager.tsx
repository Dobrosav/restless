import { useState, useRef, useEffect } from 'react'
import { useApp } from '../stores/AppContext'
import { Environment, KeyValue } from '../types'

export function EnvironmentManager() {
  const { 
    environments, 
    activeEnvironment, 
    setActiveEnvironment, 
    createEnvironment, 
    updateEnvironment, 
    deleteEnvironment,
    currentCollection
  } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (editingEnv) {
          updateEnvironment(editingEnv)
          setEditingEnv(null)
        }
        setIsCreating(false)
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, editingEnv, updateEnvironment])

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newEnvName.trim()) {
      const env = createEnvironment(newEnvName.trim())
      if (env) {
        setEditingEnv(env)
      }
      setIsCreating(false)
      setNewEnvName('')
    }
  }

  const handleDelete = (envId: string) => {
    if (confirm('Delete this environment?')) {
      deleteEnvironment(envId)
      if (editingEnv?.id === envId) setEditingEnv(null)
    }
  }

  const handleAddVariable = () => {
    if (editingEnv) {
      const newEnv = {
        ...editingEnv,
        variables: [...editingEnv.variables, { key: '', value: '', enabled: true }]
      }
      setEditingEnv(newEnv)
      updateEnvironment(newEnv)
    }
  }

  const handleUpdateVariable = (index: number, updates: Partial<KeyValue>) => {
    if (editingEnv) {
      const newVars = [...editingEnv.variables]
      newVars[index] = { ...newVars[index], ...updates }
      const newEnv = { ...editingEnv, variables: newVars }
      setEditingEnv(newEnv)
      updateEnvironment(newEnv)
    }
  }

  const handleRemoveVariable = (index: number) => {
    if (editingEnv) {
      const newVars = editingEnv.variables.filter((_, i) => i !== index)
      const newEnv = { ...editingEnv, variables: newVars }
      setEditingEnv(newEnv)
      updateEnvironment(newEnv)
    }
  }

  const handleSave = () => {
    if (editingEnv) {
      updateEnvironment(editingEnv)
      setEditingEnv(null)
    }
  }

  if (!currentCollection) {
    return (
      <div className="p-2 border-gray-700 opacity-50 cursor-not-allowed text-xs" title="Select a request from a collection to manage environments">
        <div className="w-full text-left px-2 py-1 text-gray-400 flex items-center gap-2">
          <span>🔧</span>
          <span>Environments</span>
        </div>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <div className="p-2 border-gray-700">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full text-left px-2 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-2 bg-gray-700 rounded transition-colors"
        >
          <span>🔧</span>
          <span>Environments</span>
          {activeEnvironment && (
            <span className="ml-auto text-green-400">● {activeEnvironment.name}</span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="absolute top-12 left-4 z-50 w-80 bg-gray-800 border border-gray-700 rounded shadow-xl p-3">
      <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
        <span className="text-sm font-medium text-gray-300">Environments <span className="text-xs text-gray-500">({currentCollection.name})</span></span>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">×</button>
      </div>

      <div className="space-y-3">
        {!isCreating ? (
          <div className="flex gap-2">
            <select
              value={activeEnvironment?.id || ''}
              onChange={(e) => {
                const env = environments.find(en => en.id === e.target.value) || null
                setActiveEnvironment(env)
              }}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
            >
              <option value="">No Environment</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
            <button
              onClick={() => setIsCreating(true)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 transition-colors rounded text-sm text-white"
            >
              +
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit} className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              placeholder="Environment name..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-green-600 hover:bg-green-500 transition-colors rounded text-sm text-white flex items-center justify-center"
              title="Save"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false)
                setNewEnvName('')
              }}
              className="px-2 py-1 bg-red-600 hover:bg-red-500 transition-colors rounded text-sm text-white flex items-center justify-center"
              title="Cancel"
            >
              ✕
            </button>
          </form>
        )}

        {activeEnvironment && !isCreating && (
          <button
            onClick={() => setEditingEnv(activeEnvironment)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center mt-1"
          >
            ✏️ Edit "{activeEnvironment.name}"
          </button>
        )}

        {editingEnv && (
          <div className="bg-gray-900 border border-gray-700 p-3 rounded mt-3 shadow-inner">
            <div className="text-sm font-medium text-white mb-2">Edit: {editingEnv.name}</div>
            
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {editingEnv.variables.map((v, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={v.enabled}
                    onChange={(e) => handleUpdateVariable(i, { enabled: e.target.checked })}
                    className="w-4 h-4 rounded"
                    title="Enable/Disable variable"
                  />
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => handleUpdateVariable(i, { key: e.target.value })}
                    placeholder="Key"
                    className="flex-1 w-1/3 bg-gray-800 border border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={v.value}
                    onChange={(e) => handleUpdateVariable(i, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 w-1/2 bg-gray-800 border border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-xs text-white"
                  />
                  <button
                    onClick={() => handleRemoveVariable(i)}
                    className="text-gray-500 hover:text-red-400 px-1 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-700">
              <button
                onClick={handleAddVariable}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Variable
              </button>
              <button
                onClick={handleSave}
                className="text-xs text-green-400 hover:text-green-300 ml-auto"
              >
                Save
              </button>
              <button
                onClick={() => setEditingEnv(null)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(editingEnv.id)}
                className="text-xs text-red-500 hover:text-red-400 ml-1"
                title="Delete Environment"
              >
                🗑️
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
