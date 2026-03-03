import { useState } from 'react'
import { useApp } from '../stores/AppContext'
import { Environment, KeyValue } from '../types'

export function EnvironmentManager() {
  const { 
    environments, 
    activeEnvironment, 
    setActiveEnvironment, 
    createEnvironment, 
    updateEnvironment, 
    deleteEnvironment 
  } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)

  const handleCreate = () => {
    const name = prompt('Environment name:')
    if (name) {
      const env = createEnvironment(name)
      setEditingEnv(env)
    }
  }

  const handleDelete = (envId: string) => {
    if (confirm('Delete this environment?')) {
      deleteEnvironment(envId)
    }
  }

  const handleAddVariable = () => {
    if (editingEnv) {
      updateEnvironment({
        ...editingEnv,
        variables: [...editingEnv.variables, { key: '', value: '', enabled: true }]
      })
    }
  }

  const handleUpdateVariable = (index: number, updates: Partial<KeyValue>) => {
    if (editingEnv) {
      const newVars = [...editingEnv.variables]
      newVars[index] = { ...newVars[index], ...updates }
      updateEnvironment({ ...editingEnv, variables: newVars })
    }
  }

  const handleRemoveVariable = (index: number) => {
    if (editingEnv) {
      const newVars = editingEnv.variables.filter((_, i) => i !== index)
      updateEnvironment({ ...editingEnv, variables: newVars })
    }
  }

  const handleSave = () => {
    if (editingEnv) {
      updateEnvironment(editingEnv)
      setEditingEnv(null)
    }
  }

  if (!isOpen) {
    return (
      <div className="p-2 border-t border-gray-700">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full text-left px-2 py-1 text-sm text-gray-400 hover:text-white flex items-center gap-2"
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
    <div className="p-2 border-t border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">Environments</span>
        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">×</button>
      </div>

      <div className="space-y-2">
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
            onClick={handleCreate}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
          >
            +
          </button>
        </div>

        {activeEnvironment && (
          <button
            onClick={() => setEditingEnv(activeEnvironment)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Edit {activeEnvironment.name}
          </button>
        )}

        {editingEnv && (
          <div className="bg-gray-800 p-2 rounded space-y-2 mt-2">
            <div className="text-sm font-medium text-white mb-2">Edit: {editingEnv.name}</div>
            
            {editingEnv.variables.map((v, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={v.enabled}
                  onChange={(e) => handleUpdateVariable(i, { enabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <input
                  type="text"
                  value={v.key}
                  onChange={(e) => handleUpdateVariable(i, { key: e.target.value })}
                  placeholder="Key"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                />
                <input
                  type="text"
                  value={v.value}
                  onChange={(e) => handleUpdateVariable(i, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                />
                <button
                  onClick={() => handleRemoveVariable(i)}
                  className="text-gray-500 hover:text-red-400 px-1"
                >
                  ×
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={handleAddVariable}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Variable
              </button>
              <button
                onClick={handleSave}
                className="text-xs text-green-400 hover:text-green-300"
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
                className="text-xs text-red-400 hover:text-red-300 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
