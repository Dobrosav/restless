import { useState, useEffect } from 'react'
import md5 from 'md5'
import { generateModels, Language } from '../utils/jsonToModels'

const LANGUAGES: Language[] = [
  'TypeScript', 'Java', 'C#', 'Go', 'Python',
  'Swift', 'Rust', 'Kotlin', 'Ruby', 'Dart',
  'PHP', 'C++', 'Scala', 'GraphQL', 'Zod'
]

type ToolType = 'json-to-model' | 'base64' | 'url-encode' | 'uuid' | 'regex-tester' | 'json-formatter' | 'epoch-converter' | 'hash-generator' | 'curl-converter';

export function DevToolsModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolType>('json-to-model')
  
  // JSON to Model State
  const [jsonInput, setJsonInput] = useState('')
  const [rootClassName, setRootClassName] = useState('Root')
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('TypeScript')
  const [generatedCode, setGeneratedCode] = useState('')
  const [jsonError, setJsonError] = useState('')

  // cURL Converter State
  const [curlInput, setCurlInput] = useState('')
  const [curlOutput, setCurlOutput] = useState('')
  const [curlTarget, setCurlTarget] = useState('toNodeFetch')
  const [curlError, setCurlError] = useState('')

  // Base64 State
  const [b64Input, setB64Input] = useState('')
  const [b64Output, setB64Output] = useState('')
  const [b64Mode, setB64Mode] = useState<'encode'|'decode'>('encode')

  // URL Encode State
  const [urlInput, setUrlInput] = useState('')
  const [urlOutput, setUrlOutput] = useState('')
  const [urlMode, setUrlMode] = useState<'encode'|'decode'>('encode')

  // UUID State
  const [uuids, setUuids] = useState<string[]>([])
  const [uuidCount, setUuidCount] = useState(5)

  // Regex State
  const [regexPattern, setRegexPattern] = useState('')
  const [regexFlags, setRegexFlags] = useState('g')
  const [regexTestString, setRegexTestString] = useState('')

  // JSON Formatter State
  const [jsonFormatterInput, setJsonFormatterInput] = useState('')
  const [jsonFormatterOutput, setJsonFormatterOutput] = useState('')
  const [jsonFormatterError, setJsonFormatterError] = useState('')

  // Epoch Converter State
  const [epochTimestampInput, setEpochTimestampInput] = useState(Math.floor(Date.now() / 1000).toString())
  const [epochDateOutput, setEpochDateOutput] = useState('')
  const [epochDateInput, setEpochDateInput] = useState(new Date().toISOString().slice(0, 16))
  const [epochTimestampOutput, setEpochTimestampOutput] = useState('')

  // Hash Generator State
  const [hashInput, setHashInput] = useState('')
  const [hashAlgo, setHashAlgo] = useState('SHA-256')
  const [hashOutput, setHashOutput] = useState('')

  // --- Handlers ---
  const handleJsonConvert = (input: string, lang: Language, rootName: string) => {
    setJsonInput(input)
    setSelectedLanguage(lang)
    setRootClassName(rootName)
    setJsonError('')
    
    if (!input.trim()) {
      setGeneratedCode('')
      return
    }

    try {
      const code = generateModels(input, rootName || 'Root', lang)
      setGeneratedCode(code)
    } catch (e: any) {
      setGeneratedCode('')
      setJsonError(e.message || 'Invalid JSON format')
    }
  }

  const handleCurlConvert = async (input: string, target: string) => {
    setCurlInput(input)
    setCurlTarget(target)
    setCurlError('')
    
    if (!input.trim()) {
      setCurlOutput('')
      return
    }

    try {
      const res = await window.electronAPI.curlConvert(input, target)
      if (res.success) {
        setCurlOutput(res.result || '')
      } else {
        setCurlError(res.error || `Target ${target} not found`)
      }
    } catch (e: any) {
      setCurlOutput('')
      setCurlError(e.message || 'Invalid cURL command')
    }
  }

  const handleBase64 = (input: string, mode: 'encode'|'decode') => {
    setB64Input(input)
    setB64Mode(mode)
    if (!input) {
      setB64Output('')
      return
    }
    try {
      if (mode === 'encode') {
        setB64Output(btoa(unescape(encodeURIComponent(input))))
      } else {
        setB64Output(decodeURIComponent(escape(atob(input))))
      }
    } catch (e) {
      setB64Output('Error: Invalid input for ' + mode)
    }
  }

  const handleUrlEncode = (input: string, mode: 'encode'|'decode') => {
    setUrlInput(input)
    setUrlMode(mode)
    if (!input) {
      setUrlOutput('')
      return
    }
    try {
      if (mode === 'encode') {
        setUrlOutput(encodeURIComponent(input))
      } else {
        setUrlOutput(decodeURIComponent(input))
      }
    } catch (e) {
      setUrlOutput('Error: Invalid input for ' + mode)
    }
  }

  const generateUUIDs = () => {
    const newUuids = Array.from({ length: uuidCount }, () => crypto.randomUUID());
    setUuids(newUuids);
  }

  const copyToClipboard = (text: string) => {
    if (text) navigator.clipboard.writeText(text)
  }

  // Regex Highlighting Helper
  const renderRegexHighlight = () => {
    if (!regexPattern) return <span className="text-gray-500 italic">Enter a pattern to see matches...</span>;
    if (!regexTestString) return <span className="text-gray-500 italic">Enter a test string...</span>;

    try {
      const re = new RegExp(regexPattern, regexFlags);
      // To prevent infinite loops with empty regex patterns
      if (re.test('') && regexPattern.trim() === '') {
        return <span className="text-gray-300">{regexTestString}</span>;
      }

      let matches: RegExpMatchArray[] = [];
      if (!re.global) {
        const m = regexTestString.match(re);
        if (m && m.index !== undefined) {
           matches.push(m as RegExpMatchArray);
        }
      } else {
        matches = Array.from(regexTestString.matchAll(re));
      }

      if (matches.length === 0) {
        return (
           <div className="flex flex-col gap-2">
             <div className="text-xs text-gray-500 mb-1">0 matches</div>
             <div className="text-gray-300 leading-relaxed font-mono whitespace-pre-wrap">{regexTestString}</div>
           </div>
        );
      }

      const parts: React.ReactNode[] = [];
      let lastIndex = 0;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        if (match.index === undefined) continue;
        
        // Add text before match
        if (match.index > lastIndex) {
          parts.push(<span key={`text-${lastIndex}`}>{regexTestString.substring(lastIndex, match.index)}</span>);
        }
        
        // Add highlighted match
        parts.push(
          <mark key={`match-${match.index}-${i}`} className="bg-purple-600/60 text-purple-100 rounded-sm px-0.5">
            {match[0]}
          </mark>
        );
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < regexTestString.length) {
        parts.push(<span key={`text-${lastIndex}`}>{regexTestString.substring(lastIndex)}</span>);
      }

      return (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-purple-400 font-bold mb-1">{matches.length} match{matches.length !== 1 ? 'es' : ''} found</div>
          <div className="text-gray-300 leading-relaxed font-mono whitespace-pre-wrap break-all">{parts}</div>
        </div>
      );
    } catch (e: any) {
      return <div className="text-red-400 text-sm font-medium bg-red-900/20 p-2 rounded border border-red-900/50">Error: {e.message}</div>;
    }
  }

  // JSON Formatter logic
  const handleJsonFormat = (mode: 'pretty' | 'minify') => {
    try {
      const parsed = JSON.parse(jsonFormatterInput);
      setJsonFormatterOutput(JSON.stringify(parsed, null, mode === 'pretty' ? 2 : 0));
      setJsonFormatterError('');
    } catch (e: any) {
      setJsonFormatterError(e.message || 'Invalid JSON format');
    }
  }

  // Epoch logic
  useEffect(() => {
    if (!epochTimestampInput) {
      setEpochDateOutput('');
      return;
    }
    const val = parseInt(epochTimestampInput, 10);
    if (!isNaN(val)) {
      const ms = val < 10000000000 ? val * 1000 : val;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        setEpochDateOutput(`${d.toString()}\nUTC: ${d.toUTCString()}`);
      } else {
        setEpochDateOutput('Invalid Date');
      }
    } else {
      setEpochDateOutput('Invalid Number');
    }
  }, [epochTimestampInput]);

  useEffect(() => {
    if (!epochDateInput) {
      setEpochTimestampOutput('');
      return;
    }
    const d = new Date(epochDateInput);
    if (!isNaN(d.getTime())) {
      setEpochTimestampOutput(`Seconds: ${Math.floor(d.getTime() / 1000)}\nMilliseconds: ${d.getTime()}`);
    } else {
      setEpochTimestampOutput('Invalid Date');
    }
  }, [epochDateInput]);

  // Hash logic
  useEffect(() => {
    if (!hashInput) {
      setHashOutput('');
      return;
    }
    
    if (hashAlgo === 'MD5') {
      setHashOutput(md5(hashInput));
    } else {
      const buffer = new TextEncoder().encode(hashInput);
      crypto.subtle.digest(hashAlgo, buffer).then(hashBuffer => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        setHashOutput(hashHex);
      }).catch(() => {
        setHashOutput('Error generating hash');
      });
    }
  }, [hashInput, hashAlgo]);

  // --- Renderers ---
  const renderSidebar = () => (
    <div className="w-48 bg-gray-900 border-r border-gray-700 flex flex-col p-2 space-y-1">
      <button 
        onClick={() => setActiveTool('json-to-model')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'json-to-model' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        JSON to Model
      </button>
      <button 
        onClick={() => setActiveTool('base64')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'base64' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        Base64
      </button>
      <button 
        onClick={() => setActiveTool('curl-converter')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'curl-converter' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        cURL Converter
      </button>
      <button 
        onClick={() => setActiveTool('url-encode')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'url-encode' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        URL Encode
      </button>
      <button 
        onClick={() => { setActiveTool('uuid'); if(uuids.length === 0) generateUUIDs(); }}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'uuid' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        UUID Generator
      </button>
      <button 
        onClick={() => setActiveTool('json-formatter')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'json-formatter' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        JSON Formatter
      </button>
      <button 
        onClick={() => setActiveTool('epoch-converter')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'epoch-converter' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        Epoch Converter
      </button>
      <button 
        onClick={() => setActiveTool('hash-generator')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'hash-generator' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        Hash Generator
      </button>
      <button 
        onClick={() => setActiveTool('regex-tester')}
        className={`text-left px-3 py-2 rounded text-sm transition ${activeTool === 'regex-tester' ? 'bg-purple-900/50 text-purple-300 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      >
        Regex Tester
      </button>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-gray-700 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-purple-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
        </svg>
        <span className="hidden sm:inline">Dev Tools</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-600 flex flex-col w-[1100px] max-w-full h-[750px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
                Developer Tools
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none transition"
              >
                ×
              </button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              {renderSidebar()}
              
              {/* Content Area */}
              <div className="flex-1 flex overflow-hidden bg-[#1e1e1e]">
                
                {activeTool === 'json-to-model' && (
                  <div className="flex flex-1 flex-col md:flex-row">
                    <div className="w-full md:w-1/2 flex flex-col p-4 border-b md:border-b-0 md:border-r border-gray-700 bg-gray-900/30">
                      <div className="flex justify-between mb-2">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">JSON Input</label>
                        <button 
                          onClick={() => handleJsonConvert('', selectedLanguage, rootClassName)}
                          className="text-[10px] text-gray-400 hover:text-gray-300"
                        >
                          Clear
                        </button>
                      </div>
                      <textarea
                        value={jsonInput}
                        onChange={(e) => handleJsonConvert(e.target.value, selectedLanguage, rootClassName)}
                        placeholder="Paste JSON here..."
                        className="w-full flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 leading-relaxed resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                        spellCheck={false}
                      />
                      {jsonError && <p className="text-red-400 font-medium text-xs mt-3">{jsonError}</p>}
                    </div>

                    <div className="w-full md:w-1/2 flex flex-col p-4">
                      <div className="flex flex-col gap-3 mb-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Generated Model</label>
                          <button 
                            onClick={() => copyToClipboard(generatedCode)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Root Name:</span>
                            <input 
                              type="text" 
                              value={rootClassName}
                              onChange={(e) => handleJsonConvert(jsonInput, selectedLanguage, e.target.value)}
                              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-purple-500 w-24"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Language:</span>
                            <select
                              value={selectedLanguage}
                              onChange={(e) => handleJsonConvert(jsonInput, e.target.value as Language, rootClassName)}
                              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
                            >
                              {LANGUAGES.map(lang => (
                                <option key={lang} value={lang}>{lang}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden flex flex-col">
                        <pre className="flex-1 overflow-y-auto text-purple-300 bg-gray-900/50 border border-purple-900/30 p-3 rounded text-sm font-mono break-all whitespace-pre-wrap custom-scrollbar">
                          {generatedCode || ' '}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === 'curl-converter' && (
                  <div className="flex flex-1 flex-col md:flex-row">
                    <div className="w-full md:w-1/2 flex flex-col p-4 border-b md:border-b-0 md:border-r border-gray-700 bg-gray-900/30">
                      <div className="flex justify-between mb-2">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">cURL Input</label>
                        <button 
                          onClick={() => handleCurlConvert('', curlTarget)}
                          className="text-[10px] text-gray-400 hover:text-gray-300"
                        >
                          Clear
                        </button>
                      </div>
                      <textarea
                        value={curlInput}
                        onChange={(e) => handleCurlConvert(e.target.value, curlTarget)}
                        placeholder="Paste cURL command here..."
                        className="w-full flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 leading-relaxed resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                        spellCheck={false}
                      />
                      {curlError && <p className="text-red-400 font-medium text-xs mt-3">{curlError}</p>}
                    </div>

                    <div className="w-full md:w-1/2 flex flex-col p-4">
                      <div className="flex flex-col gap-3 mb-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Generated Client Code</label>
                          <button 
                            onClick={() => copyToClipboard(curlOutput)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Target:</span>
                          <select
                            value={curlTarget}
                            onChange={(e) => handleCurlConvert(curlInput, e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-purple-500 max-w-xs"
                          >
                            <option value="toBrowser">Browser (fetch)</option>
                            <option value="toNodeFetch">Node (fetch)</option>
                            <option value="toNodeAxios">Node (Axios)</option>
                            <option value="toPython">Python (requests)</option>
                            <option value="toGo">Go</option>
                            <option value="toJava">Java (HttpClient)</option>
                            <option value="toJavaOkHttp">Java (OkHttp)</option>
                            <option value="toKotlin">Kotlin</option>
                            <option value="toCSharp">C# (HttpClient)</option>
                            <option value="toPhp">PHP (cURL)</option>
                            <option value="toPhpGuzzle">PHP (Guzzle)</option>
                            <option value="toRuby">Ruby (Net::HTTP)</option>
                            <option value="toRust">Rust (reqwest)</option>
                            <option value="toSwift">Swift (URLSession)</option>
                            <option value="toDart">Dart (http)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden flex flex-col">
                        <pre className="flex-1 overflow-y-auto text-purple-300 bg-gray-900/50 border border-purple-900/30 p-3 rounded text-sm font-mono break-all whitespace-pre-wrap custom-scrollbar">
                          {curlOutput || ' '}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {(activeTool === 'base64' || activeTool === 'url-encode') && (() => {
                  const inputVal = activeTool === 'base64' ? b64Input : urlInput;
                  const outputVal = activeTool === 'base64' ? b64Output : urlOutput;
                  const currentMode = activeTool === 'base64' ? b64Mode : urlMode;
                  const handler = activeTool === 'base64' ? handleBase64 : handleUrlEncode;

                  return (
                    <div className="flex flex-1 flex-col p-6 gap-4">
                      <div className="flex items-center gap-4 bg-gray-900 p-2 rounded-lg w-fit border border-gray-700">
                        <button
                          onClick={() => handler(inputVal, 'encode')}
                          className={`px-4 py-1.5 rounded text-sm font-medium transition ${currentMode === 'encode' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Encode
                        </button>
                        <button
                          onClick={() => handler(inputVal, 'decode')}
                          className={`px-4 py-1.5 rounded text-sm font-medium transition ${currentMode === 'decode' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Decode
                        </button>
                      </div>

                      <div className="flex flex-1 gap-4 flex-col md:flex-row">
                        <div className="flex-1 flex flex-col">
                          <label className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Input</label>
                          <textarea
                            value={inputVal}
                            onChange={(e) => handler(e.target.value, currentMode)}
                            placeholder={`Type text to ${currentMode}...`}
                            className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            spellCheck={false}
                          />
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Output</label>
                            <button 
                              onClick={() => copyToClipboard(outputVal)}
                              className="text-[10px] text-gray-400 hover:text-gray-200 bg-gray-800 px-2 py-0.5 rounded"
                            >
                              Copy
                            </button>
                          </div>
                          <textarea
                            value={outputVal}
                            readOnly
                            placeholder="Result..."
                            className="flex-1 bg-gray-900/50 border border-purple-900/30 rounded p-3 text-sm font-mono text-purple-300 resize-none focus:outline-none"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {activeTool === 'uuid' && (
                  <div className="flex flex-1 flex-col p-6 gap-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <label className="text-sm text-gray-400">Generate count:</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="100" 
                          value={uuidCount}
                          onChange={(e) => setUuidCount(parseInt(e.target.value) || 1)}
                          className="w-20 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-purple-500"
                        />
                        <button 
                          onClick={generateUUIDs}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded text-sm font-medium transition"
                        >
                          Generate
                        </button>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(uuids.join('\n'))}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded text-sm font-medium transition"
                      >
                        Copy All
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-2 custom-scrollbar">
                      {uuids.map((uuid, i) => (
                        <div key={i} className="flex items-center justify-between group bg-gray-800/50 p-2 rounded border border-transparent hover:border-gray-600">
                          <span className="font-mono text-gray-300 text-sm select-all">{uuid}</span>
                          <button 
                            onClick={() => copyToClipboard(uuid)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition text-xs bg-gray-700 px-2 py-1 rounded"
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTool === 'regex-tester' && (
                  <div className="flex flex-1 flex-col p-6 gap-4 overflow-hidden">
                    {/* Pattern and Flags Input */}
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 flex bg-gray-900 border border-gray-600 rounded focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition overflow-hidden">
                        <span className="text-gray-500 font-mono pl-3 py-2 select-none">/</span>
                        <input
                          type="text"
                          value={regexPattern}
                          onChange={(e) => setRegexPattern(e.target.value)}
                          placeholder="expression"
                          className="flex-1 bg-transparent border-none outline-none text-purple-300 font-mono px-1 py-2 text-sm"
                          spellCheck={false}
                        />
                        <span className="text-gray-500 font-mono pr-1 py-2 select-none">/</span>
                        <input
                          type="text"
                          value={regexFlags}
                          onChange={(e) => setRegexFlags(e.target.value)}
                          placeholder="flags"
                          className="w-20 bg-gray-800 border-l border-gray-600 outline-none text-purple-300 font-mono px-2 py-2 text-sm"
                          spellCheck={false}
                        />
                      </div>
                    </div>

                    <div className="flex flex-1 gap-4 flex-col md:flex-row min-h-0">
                      {/* Test String */}
                      <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Test String</label>
                        <textarea
                          value={regexTestString}
                          onChange={(e) => setRegexTestString(e.target.value)}
                          placeholder="Enter text to test here..."
                          className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition custom-scrollbar"
                          spellCheck={false}
                        />
                      </div>
                      
                      {/* Results */}
                      <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Results</label>
                        <div className="flex-1 bg-gray-900/50 border border-purple-900/30 rounded p-4 overflow-y-auto custom-scrollbar">
                          {renderRegexHighlight()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === 'json-formatter' && (
                  <div className="flex flex-1 flex-col md:flex-row p-6 gap-4 overflow-hidden">
                    <div className="w-full md:w-1/2 flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Raw JSON</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleJsonFormat('pretty')}
                            className="text-[10px] bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded transition"
                          >
                            Format (Pretty)
                          </button>
                          <button 
                            onClick={() => handleJsonFormat('minify')}
                            className="text-[10px] bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded transition"
                          >
                            Minify
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={jsonFormatterInput}
                        onChange={(e) => setJsonFormatterInput(e.target.value)}
                        placeholder="Paste unformatted JSON here..."
                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition custom-scrollbar"
                        spellCheck={false}
                      />
                      {jsonFormatterError && <p className="text-red-400 font-medium text-xs mt-2">{jsonFormatterError}</p>}
                    </div>

                    <div className="w-full md:w-1/2 flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Formatted Output</label>
                        <button 
                          onClick={() => copyToClipboard(jsonFormatterOutput)}
                          className="text-[10px] text-gray-400 hover:text-gray-200 bg-gray-800 px-2 py-0.5 rounded"
                        >
                          Copy
                        </button>
                      </div>
                      <textarea
                        value={jsonFormatterOutput}
                        readOnly
                        placeholder="Result will appear here..."
                        className="flex-1 bg-gray-900/50 border border-purple-900/30 rounded p-3 text-sm font-mono text-purple-300 resize-none focus:outline-none custom-scrollbar"
                        spellCheck={false}
                        wrap="off"
                      />
                    </div>
                  </div>
                )}

                {activeTool === 'epoch-converter' && (
                  <div className="flex flex-1 flex-col p-6 gap-8 overflow-y-auto custom-scrollbar">
                    {/* Timestamp to Date */}
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 flex flex-col gap-4">
                      <h3 className="text-sm text-purple-300 font-bold uppercase tracking-wide border-b border-gray-700 pb-2">Timestamp to Date</h3>
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col flex-1">
                          <label className="text-xs text-gray-400 mb-1">Enter Timestamp (s or ms)</label>
                          <input
                            type="number"
                            value={epochTimestampInput}
                            onChange={(e) => setEpochTimestampInput(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded p-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="flex flex-col flex-[2]">
                          <label className="text-xs text-gray-400 mb-1">Human Readable Date</label>
                          <textarea
                            value={epochDateOutput}
                            readOnly
                            rows={2}
                            className="bg-gray-800/50 border border-gray-700 rounded p-2 text-sm text-purple-300 font-mono resize-none focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Date to Timestamp */}
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 flex flex-col gap-4">
                      <h3 className="text-sm text-purple-300 font-bold uppercase tracking-wide border-b border-gray-700 pb-2">Date to Timestamp</h3>
                      <div className="flex gap-4 items-start">
                        <div className="flex flex-col flex-1">
                          <label className="text-xs text-gray-400 mb-1">Enter Date & Time</label>
                          <input
                            type="datetime-local"
                            value={epochDateInput}
                            onChange={(e) => setEpochDateInput(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded p-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="flex flex-col flex-[2]">
                          <label className="text-xs text-gray-400 mb-1">Unix Timestamp</label>
                          <textarea
                            value={epochTimestampOutput}
                            readOnly
                            rows={2}
                            className="bg-gray-800/50 border border-gray-700 rounded p-2 text-sm text-purple-300 font-mono resize-none focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTool === 'hash-generator' && (
                  <div className="flex flex-1 flex-col md:flex-row p-6 gap-4 overflow-hidden">
                    <div className="w-full md:w-1/2 flex flex-col min-h-0">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Input String</label>
                      <textarea
                        value={hashInput}
                        onChange={(e) => setHashInput(e.target.value)}
                        placeholder="Type text to hash..."
                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-3 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition custom-scrollbar"
                        spellCheck={false}
                      />
                    </div>
                    <div className="w-full md:w-1/2 flex flex-col min-h-0 gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Algorithm</label>
                        <select
                          value={hashAlgo}
                          onChange={(e) => setHashAlgo(e.target.value)}
                          className="bg-gray-900 border border-gray-600 rounded p-2 text-sm text-gray-200 font-medium focus:outline-none focus:border-purple-500 w-full md:w-1/2"
                        >
                          <option value="MD5">MD5</option>
                          <option value="SHA-1">SHA-1</option>
                          <option value="SHA-256">SHA-256</option>
                          <option value="SHA-384">SHA-384</option>
                          <option value="SHA-512">SHA-512</option>
                        </select>
                      </div>
                      <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-xs text-gray-400 font-bold uppercase tracking-wide">Hash Result</label>
                          <button 
                            onClick={() => copyToClipboard(hashOutput)}
                            className="text-[10px] text-gray-400 hover:text-gray-200 bg-gray-800 px-2 py-0.5 rounded"
                          >
                            Copy
                          </button>
                        </div>
                        <textarea
                          value={hashOutput}
                          readOnly
                          placeholder="Hash will appear here..."
                          className="flex-1 bg-gray-900/50 border border-purple-900/30 rounded p-3 text-sm font-mono text-purple-300 resize-none focus:outline-none break-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
                
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
