import { useState, useEffect } from 'react'

interface GitConfigDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: { userName: string; userEmail: string }) => void
}

export function GitConfigDialog({ isOpen, onClose, onSave }: GitConfigDialogProps) {
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      window.electronAPI.gitGetConfig()
        .then(config => {
          setUserName(config.userName || '')
          setUserEmail(config.userEmail || '')
        })
        .catch(err => {
          console.error('Failed to load config:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen])

  const handleSave = () => {
    if (userName.trim() && userEmail.trim()) {
      onSave({ userName: userName.trim(), userEmail: userEmail.trim() })
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userName.trim() && userEmail.trim()) {
      handleSave()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-96 border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">Git Configuration</h2>
        <p className="text-sm text-gray-400 mb-4">
          Please enter your Git username and email for commits.
        </p>
        <div className="space-y-3" onKeyDown={handleKeyDown}>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input
              type="text"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            disabled={!userName.trim() || !userEmail.trim() || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded text-sm font-medium"
          >
            {loading ? 'Loading...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
