import { useState, useEffect, useRef } from 'react'
import { useApp } from '../stores/AppContext'

interface GitStatus {
  modified: string[]
  not_added: string[]
  deleted: string[]
  untracked: string[]
  staged: string[]
  current: string | null
  ahead: number
  behind: number
}

interface GitPanelProps {
  onOpenConfig?: () => void
}

export function GitPanel({ onOpenConfig }: GitPanelProps) {
  const { workspace } = useApp()
  const panelRef = useRef<HTMLDivElement>(null)
   const [isOpen, setIsOpen] = useState(false)
   const [isGitRepo, setIsGitRepo] = useState(false)
   const [status, setStatus] = useState<GitStatus | null>(null)
   const [commitMessage, setCommitMessage] = useState('')
   const [isLoading, setIsLoading] = useState(false)
   const [remoteUrl, setRemoteUrl] = useState('')
   const [newRemoteUrl, setNewRemoteUrl] = useState('')
   const [error, setError] = useState('')
   const [branches, setBranches] = useState<string[]>([])
   const [showBranchInput, setShowBranchInput] = useState(false)
   const [newBranchName, setNewBranchName] = useState('')

  useEffect(() => {
    if (workspace?.path) {
      checkGitStatus()
      loadRemoteUrl()
    }
  }, [workspace?.path])

  useEffect(() => {
    // Auto-refresh git status when workspace collections change (e.g., after save/import/delete)
    if (workspace?.path) {
      const timer = setTimeout(() => {
        checkGitStatus()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [workspace?.collections])

  useEffect(() => {
    // Close panel when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadRemoteUrl = async () => {
    const url = await window.electronAPI.gitGetRemote()
    setRemoteUrl(url)
    setNewRemoteUrl(url)
  }

  const handleSetRemote = async () => {
    const trimmedUrl = newRemoteUrl.trim()
    if (!trimmedUrl) return
    
    // Validate URL format
    if (!trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('git@') && !trimmedUrl.startsWith('http://')) {
      setError('Remote URL must start with https://, http://, or git@')
      return
    }
    
    setIsLoading(true)
    setError('')
    try {
      await window.electronAPI.gitSetRemote(trimmedUrl)
      setRemoteUrl(trimmedUrl)
      setNewRemoteUrl(trimmedUrl)
      await checkGitStatus()
    } catch (e) {
      setError('Failed to set remote: ' + String(e))
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const checkGitStatus = async () => {
    if (!workspace?.path) return
    try {
      const result = await window.electronAPI.gitInit(workspace.path)
      setIsGitRepo(result)
      if (result) {
        const statusResult = await window.electronAPI.gitStatus()
        setStatus(statusResult)
        const branchesResult = await window.electronAPI.gitListBranches()
        setBranches(branchesResult.local)
      }
    } catch {
      setIsGitRepo(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) return
    setIsLoading(true)
    try {
      const allFiles = [
        ...(status?.modified || []),
        ...(status?.not_added || []),
        ...(status?.deleted || []),
      ]
      if (allFiles.length > 0) {
        await window.electronAPI.gitAdd(allFiles)
      }
      await window.electronAPI.gitCommit(commitMessage)
      setCommitMessage('')
      await checkGitStatus()
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePull = async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.gitPull()
      if (result.success) {
        await checkGitStatus()
      } else {
        setError(result.error || 'Pull failed')
      }
    } catch (e: any) {
      setError(e.message || 'Pull failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePush = async () => {
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.gitPush()
      if (result.success) {
        await checkGitStatus()
      } else {
        setError(result.error || 'Push failed')
      }
    } catch (e: any) {
      setError(e.message || 'Push failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckoutBranch = async (branchName: string) => {
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.gitCheckout(branchName)
      if (result.success) {
        await checkGitStatus()
        setShowBranchInput(false)
      } else {
        setError(result.error || 'Checkout failed')
      }
    } catch (e: any) {
      setError(e.message || 'Checkout failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    setIsLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.gitCreateBranch(newBranchName.trim())
      if (result.success) {
        setNewBranchName('')
        await checkGitStatus()
        setShowBranchInput(false)
      } else {
        setError(result.error || 'Create branch failed')
      }
    } catch (e: any) {
      setError(e.message || 'Create branch failed')
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges = status && (
    status.modified.length > 0 ||
    status.not_added.length > 0 ||
    status.deleted.length > 0 ||
    status.untracked.length > 0 ||
    status.staged.length > 0
  )

  if (!workspace) return null

    return (
      <div className="p-2 border-t border-gray-700 relative" ref={panelRef}>
       <button
         onClick={() => setIsOpen(!isOpen)}
         className="w-full text-left px-2 py-1 text-sm text-gray-400 hover:text-white flex items-center gap-2"
       >
         <span>📂</span>
         <span>Git</span>
         {hasChanges && <span className="ml-auto text-yellow-400">●</span>}
       </button>

       {isOpen && (
         <div className="mt-2 p-2 bg-gray-800 rounded space-y-2 absolute z-50 min-w-48 shadow-lg border border-gray-600">
           <div className="flex items-center justify-between">
             <span className="text-xs text-gray-500">Git Settings</span>
             <div className="flex gap-1">
               <button
                 onClick={() => checkGitStatus()}
                 className="text-xs text-gray-400 hover:text-gray-300"
                 title="Refresh status"
               >
                 🔄
               </button>
               <button
                 onClick={onOpenConfig}
                 className="text-xs text-blue-400 hover:text-blue-300"
               >
                 ⚙️
               </button>
             </div>
           </div>
          {!isGitRepo ? (
            <div className="text-xs text-gray-500">Not a Git repository</div>
          ) : (
            <>
              <div className="text-xs text-gray-400">
                Branch: <span className="text-white">{status?.current || 'main'}</span>
                {status && status.ahead > 0 && <span className="text-yellow-400"> ↑{status.ahead} commits to push</span>}
                {status && status.behind > 0 && <span className="text-yellow-400"> ↓{status.behind} commits to pull</span>}
              </div>

              {branches.length > 0 && (
                <div className="space-y-1">
                  <button
                    onClick={() => setShowBranchInput(!showBranchInput)}
                    className="w-full text-left px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white flex items-center justify-between"
                  >
                    <span>🌿 Switch Branch</span>
                    <span>{showBranchInput ? '▼' : '▶'}</span>
                  </button>
                  {showBranchInput && (
                    <div className="space-y-1 bg-gray-700 rounded p-1">
                      {branches.map(branch => (
                        <button
                          key={branch}
                          onClick={() => handleCheckoutBranch(branch)}
                          disabled={isLoading || branch === status?.current}
                          className={`w-full text-left px-2 py-1 rounded text-xs ${
                            branch === status?.current
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-600 hover:bg-gray-500 text-gray-100'
                          } disabled:opacity-50`}
                        >
                          {branch === status?.current && '✓ '}{branch}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          if (newBranchName.trim()) {
                            handleCreateBranch()
                          } else {
                            setShowBranchInput(false)
                          }
                        }}
                        className="w-full text-left px-2 py-1 rounded text-xs bg-green-700 hover:bg-green-600 text-white mt-1"
                      >
                        + New Branch
                      </button>
                    </div>
                  )}
                  {showBranchInput && (
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="New branch name..."
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newBranchName.trim()) {
                          handleCreateBranch()
                        }
                      }}
                    />
                  )}
                </div>
              )}

               {remoteUrl && (
                 <div className="text-xs text-gray-500 truncate" title={remoteUrl}>
                   Remote: <span className="text-blue-400">{remoteUrl}</span>
                 </div>
               )}

               <div className="text-xs text-gray-600 border-t border-gray-700 pt-1 mt-1">
                 <p className="mb-1">For HTTPS push, ensure GitHub CLI is authenticated:</p>
                 <code className="text-gray-500 text-xs">gh auth login</code>
               </div>

              <div className="space-y-1">
                <input
                  type="text"
                  value={newRemoteUrl}
                  onChange={(e) => setNewRemoteUrl(e.target.value)}
                  placeholder="Remote URL (https://... or git@...)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                />
                <button
                  onClick={handleSetRemote}
                  disabled={isLoading || !newRemoteUrl.trim() || newRemoteUrl.trim() === remoteUrl}
                  className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs text-white disabled:opacity-50"
                >
                  Set Remote
                </button>
              </div>

               {hasChanges && (
                 <div className="text-xs space-y-1">
                   {status?.staged.length > 0 && (
                     <div className="text-blue-400">Staged: {status.staged.length}</div>
                   )}
                   {status?.modified.length > 0 && (
                     <div className="text-yellow-400">Modified: {status.modified.length}</div>
                   )}
                   {status?.not_added.length > 0 && (
                     <div className="text-green-400">Untracked: {status.not_added.length}</div>
                   )}
                   {status?.deleted.length > 0 && (
                     <div className="text-red-400">Deleted: {status.deleted.length}</div>
                   )}
                 </div>
               )}

               <div className="flex gap-2">
                 <button
                   onClick={handlePull}
                   disabled={isLoading || !remoteUrl}
                   className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white disabled:opacity-50"
                 >
                   Pull
                 </button>
                 <button
                   onClick={handlePush}
                   disabled={isLoading || !remoteUrl}
                   className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white disabled:opacity-50"
                 >
                   Push
                 </button>
               </div>

               {error && (
                 <div className="text-xs text-red-400 bg-red-900 bg-opacity-30 p-1 rounded">{error}</div>
               )}

               {status && status.ahead === 0 && !hasChanges && (
                 <div className="text-xs text-gray-500 italic">Everything is up to date</div>
               )}

               {status && status.ahead > 0 && (
                 <div className="text-xs text-yellow-500 bg-yellow-900 bg-opacity-20 p-1 rounded">
                   You have {status.ahead} commit{status.ahead > 1 ? 's' : ''} ready to push
                 </div>
               )}

              {hasChanges && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                  />
                  <button
                    onClick={handleCommit}
                    disabled={isLoading || !commitMessage.trim()}
                    className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white disabled:opacity-50"
                  >
                    Commit
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
