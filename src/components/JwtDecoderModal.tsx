import { useState } from 'react'

export function JwtDecoderModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [token, setToken] = useState('')
  const [decodedHeader, setDecodedHeader] = useState('')
  const [decodedPayload, setDecodedPayload] = useState('')
  const [error, setError] = useState('')

  const handleDecode = (input: string) => {
    setToken(input)
    setError('')
    if (!input.trim()) {
      setDecodedHeader('')
      setDecodedPayload('')
      return
    }

    try {
      const parts = input.trim().split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format (requires 3 parts)')
      }
      
      const decodeB64 = (str: string) => {
        let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
        while (b64.length % 4) {
          b64 += '='
        }
        return decodeURIComponent(atob(b64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
      }

      let hObj = {}, pObj = {}
      try { hObj = JSON.parse(decodeB64(parts[0])) } catch (e) { throw new Error('Invalid header format') }
      try { pObj = JSON.parse(decodeB64(parts[1])) } catch (e) { throw new Error('Invalid payload format') }

      setDecodedHeader(JSON.stringify(hObj, null, 2))
      setDecodedPayload(JSON.stringify(pObj, null, 2))
    } catch (e: any) {
      setDecodedHeader('')
      setDecodedPayload('')
      setError(e.message)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-gray-700 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-orange-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
        <span className="hidden sm:inline">JWT</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-600 flex flex-col w-[900px] max-w-full h-[600px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-orange-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                </svg>
                JWT Decoder
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none transition"
              >
                ×
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
              <div className="w-full md:w-1/2 flex flex-col p-4 border-b md:border-b-0 md:border-r border-gray-700 bg-gray-900/30">
                <label className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wide">Encoded Token</label>
                <textarea
                  value={token}
                  onChange={(e) => handleDecode(e.target.value)}
                  placeholder="Paste JWT here (ey...)"
                  className="w-full flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 leading-relaxed resize-none focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 break-all transition"
                  spellCheck={false}
                />
                {error && <p className="text-red-400 font-medium text-xs mt-3">{error}</p>}
                {!error && token && <p className="text-green-400 font-medium text-xs mt-3">Valid signature format</p>}
              </div>

              <div className="w-full md:w-1/2 flex flex-col p-4 bg-[#1e1e1e]">
                <label className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wide">Decoded</label>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                  <div className="flex flex-col">
                    <label className="text-[10px] text-pink-400 font-bold mb-1 tracking-wider uppercase">Header (Algorithm & Type)</label>
                    <pre className="text-pink-300 bg-gray-900/50 border border-pink-900/30 p-3 rounded text-xs font-mono break-all whitespace-pre-wrap">
                      {decodedHeader || ' '}
                    </pre>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-blue-400 font-bold mb-1 tracking-wider uppercase">Payload (Data)</label>
                    <pre className="text-blue-300 bg-gray-900/50 border border-blue-900/30 p-3 rounded text-xs font-mono break-all whitespace-pre-wrap min-h-[150px]">
                      {decodedPayload || ' '}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
