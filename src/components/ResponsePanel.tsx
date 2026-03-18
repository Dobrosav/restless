import { useState } from 'react'
import { useApp } from '../stores/AppContext'
import Editor from '@monaco-editor/react'

export function ResponsePanel() {
  const { response, setResponse, isLoading } = useApp()
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'cookies'>('body')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="w-1/2 flex items-center justify-center">
        <div className="text-gray-400">Sending request...</div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="w-1/2 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <p>No response yet</p>
          <p className="text-xs mt-1">Enter a URL and click Send</p>
        </div>
      </div>
    )
  }

  const statusColor = response.status >= 200 && response.status < 300
    ? 'text-green-400'
    : response.status >= 300 && response.status < 400
    ? 'text-yellow-400'
    : 'text-red-400'

  return (
    <div className="w-1/2 flex flex-col h-full border-l border-gray-700">
      <div className="p-3 border-b border-gray-700 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${statusColor}`}>
            {response.status}
          </span>
          <span className="text-gray-400 text-sm">
            {response.statusText}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>Time: {response.time}ms</span>
          <span>Size: {formatSize(response.size)}</span>
        </div>
      </div>

      <div className="border-b border-gray-700 flex justify-between items-center pr-2">
        <div className="flex">
          {(['body', 'headers', 'cookies'] as const).map((tab) => (
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
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
            title="Copy Response Body"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            onClick={() => setResponse(null)}
            className="text-xs px-2 py-1 text-gray-400 hover:text-red-400 rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
            title="Clear Response"
          >
            ✕ Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <Editor
            height="100%"
            defaultLanguage="json"
            value={response.body}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        )}

        {activeTab === 'headers' && (
          <div className="p-3 overflow-y-auto h-full">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-b border-gray-700">
                    <td className="py-1 text-blue-400 font-mono text-xs w-1/3">{key}</td>
                    <td className="py-1 text-gray-300 text-xs break-all">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cookies' && (
          <div className="p-3 text-gray-500 text-sm">
            {response.headers['set-cookie'] ? (
              <pre className="text-xs">{response.headers['set-cookie']}</pre>
            ) : (
              'No cookies in response'
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
