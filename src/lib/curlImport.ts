import { ApiRequest, HttpMethod, KeyValue } from '../types'

/**
 * Tokenize a curl command string in a shell-aware manner:
 * handles single-quoted, double-quoted, and bare arguments,
 * as well as line-continuation backslashes.
 */
function tokenize(input: string): string[] {
  // Normalise line continuations (backslash + newline)
  const normalised = input.replace(/\\\n/g, ' ')

  const tokens: string[] = []
  let i = 0

  while (i < normalised.length) {
    // Skip whitespace
    while (i < normalised.length && /\s/.test(normalised[i])) i++
    if (i >= normalised.length) break

    const ch = normalised[i]

    if (ch === "'") {
      // Single-quoted: take everything until the closing '
      i++
      let token = ''
      while (i < normalised.length && normalised[i] !== "'") {
        token += normalised[i++]
      }
      i++ // consume closing '
      tokens.push(token)
    } else if (ch === '"') {
      // Double-quoted: handle backslash escapes
      i++
      let token = ''
      while (i < normalised.length && normalised[i] !== '"') {
        if (normalised[i] === '\\' && i + 1 < normalised.length) {
          i++
          token += normalised[i++]
        } else {
          token += normalised[i++]
        }
      }
      i++ // consume closing "
      tokens.push(token)
    } else {
      // Bare token: read until whitespace
      let token = ''
      while (i < normalised.length && !/\s/.test(normalised[i])) {
        token += normalised[i++]
      }
      tokens.push(token)
    }
  }

  return tokens
}

function detectBodyType(
  content: string,
  contentTypeHeader: string
): 'json' | 'text' | 'x-www-form-urlencoded' | 'form-data' {
  const ct = contentTypeHeader.toLowerCase()
  if (ct.includes('application/json')) return 'json'
  if (ct.includes('application/x-www-form-urlencoded')) return 'x-www-form-urlencoded'
  if (ct.includes('multipart/form-data')) return 'form-data'

  // Heuristic: looks like JSON?
  const trimmed = content.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'

  return 'text'
}

export function parseCurl(curlCommand: string): Partial<ApiRequest> {
  const tokens = tokenize(curlCommand)

  // Strip the leading "curl" token
  const start = tokens.findIndex(t => t === 'curl' || t.endsWith('/curl'))
  const args = start >= 0 ? tokens.slice(start + 1) : tokens

  let method: HttpMethod = 'GET'
  let url = ''
  const rawHeaders: { key: string; value: string }[] = []
  const formFields: { key: string; value: string }[] = []
  let dataBody = ''
  let dataMode: 'raw' | 'form' | 'urlencoded' = 'raw'
  let basicUser = ''
  let basicPass = ''
  let bearerToken = ''
  let hasWebSocketUpgrade = false
  let hasGraphQLContentType = false

  let i = 0
  while (i < args.length) {
    const tok = args[i]

    // ── Method ──────────────────────────────────────────────────────────────
    if (tok === '-X' || tok === '--request') {
      method = (args[++i] || 'GET').toUpperCase() as HttpMethod
    } else if (tok.startsWith('-X') && tok.length > 2) {
      method = tok.slice(2).toUpperCase() as HttpMethod

    // ── Headers ─────────────────────────────────────────────────────────────
    } else if (tok === '-H' || tok === '--header') {
      const header = args[++i] || ''
      const colonIdx = header.indexOf(':')
      if (colonIdx > 0) {
        const key = header.slice(0, colonIdx).trim()
        const value = header.slice(colonIdx + 1).trim()
        rawHeaders.push({ key, value })
        if (key.toLowerCase() === 'upgrade' && value.toLowerCase() === 'websocket') {
          hasWebSocketUpgrade = true
        }
        if (key.toLowerCase() === 'content-type' && value.toLowerCase().includes('graphql')) {
          hasGraphQLContentType = true
        }
      }

    // ── Data / Body ──────────────────────────────────────────────────────────
    } else if (
      tok === '-d' ||
      tok === '--data' ||
      tok === '--data-raw' ||
      tok === '--data-ascii' ||
      tok === '--data-binary'
    ) {
      dataBody = args[++i] || ''
      dataMode = 'raw'
      if (method === 'GET') method = 'POST'

    } else if (tok === '--data-urlencode') {
      // value may be name=value or just value
      const val = args[++i] || ''
      const eqIdx = val.indexOf('=')
      if (eqIdx > 0) {
        formFields.push({ key: val.slice(0, eqIdx), value: val.slice(eqIdx + 1) })
      } else {
        dataBody = val
      }
      dataMode = 'urlencoded'
      if (method === 'GET') method = 'POST'

    // ── Form / Multipart ─────────────────────────────────────────────────────
    } else if (tok === '-F' || tok === '--form') {
      const field = args[++i] || ''
      const eqIdx = field.indexOf('=')
      formFields.push({
        key: eqIdx >= 0 ? field.slice(0, eqIdx) : field,
        value: eqIdx >= 0 ? field.slice(eqIdx + 1) : '',
      })
      dataMode = 'form'
      if (method === 'GET') method = 'POST'

    // ── Basic Auth ───────────────────────────────────────────────────────────
    } else if (tok === '-u' || tok === '--user') {
      const creds = args[++i] || ''
      const colonIdx = creds.indexOf(':')
      if (colonIdx >= 0) {
        basicUser = creds.slice(0, colonIdx)
        basicPass = creds.slice(colonIdx + 1)
      } else {
        basicUser = creds
      }

    // ── OAuth2 Bearer ────────────────────────────────────────────────────────
    } else if (tok === '--oauth2-bearer') {
      bearerToken = args[++i] || ''

    // ── Flags to silently skip (no value after them) ─────────────────────────
    } else if (
      tok === '-L' || tok === '--location' ||
      tok === '-s' || tok === '--silent' ||
      tok === '-S' || tok === '--show-error' ||
      tok === '-v' || tok === '--verbose' ||
      tok === '-k' || tok === '--insecure' ||
      tok === '-i' || tok === '--include' ||
      tok === '-g' || tok === '--globoff' ||
      tok === '--compressed'
    ) {
      // skip, no value
    } else if (
      tok === '-o' || tok === '--output' ||
      tok === '-m' || tok === '--max-time' ||
      tok === '--connect-timeout' ||
      tok === '-A' || tok === '--user-agent' ||
      tok === '--proxy' ||
      tok === '--cacert' || tok === '--cert' || tok === '--key'
    ) {
      // skip flag + its value
      i++
    // ── URL (bare argument) ──────────────────────────────────────────────────
    } else if (!tok.startsWith('-')) {
      if (!url) url = tok
    }

    i++
  }

  // ── Parse URL → base + query params ────────────────────────────────────────
  let baseUrl = url
  const params: KeyValue[] = []

  try {
    // Handle URLs that may lack protocol for URL parsing
    const parseTarget = url.startsWith('http') ? url : `http://${url}`
    const parsed = new URL(parseTarget)

    // Reconstruct clean base URL (without search)
    baseUrl = url.startsWith('http')
      ? `${parsed.protocol}//${parsed.host}${parsed.pathname}`
      : `${parsed.host}${parsed.pathname}`

    parsed.searchParams.forEach((value, key) => {
      params.push({ key, value, enabled: true })
    })
  } catch {
    // Fallback: manual split on '?'
    const qIdx = url.indexOf('?')
    if (qIdx >= 0) {
      baseUrl = url.slice(0, qIdx)
      const qs = url.slice(qIdx + 1)
      qs.split('&').forEach(pair => {
        const eqIdx = pair.indexOf('=')
        params.push({
          key: decodeURIComponent(eqIdx >= 0 ? pair.slice(0, eqIdx) : pair),
          value: decodeURIComponent(eqIdx >= 0 ? pair.slice(eqIdx + 1) : ''),
          enabled: true,
        })
      })
    }
  }

  // ── Resolve auth from headers ───────────────────────────────────────────────
  const headers: KeyValue[] = []
  let contentTypeHeader = ''

  for (const h of rawHeaders) {
    if (h.key.toLowerCase() === 'authorization') {
      const val = h.value
      if (val.toLowerCase().startsWith('bearer ')) {
        bearerToken = val.slice(7).trim()
      } else if (val.toLowerCase().startsWith('basic ')) {
        try {
          const decoded = atob(val.slice(6).trim())
          const colonIdx = decoded.indexOf(':')
          basicUser = decoded.slice(0, colonIdx)
          basicPass = decoded.slice(colonIdx + 1)
        } catch {
          // ignore decode errors
        }
      } else {
        // Unknown auth – keep as header
        headers.push({ key: h.key, value: h.value, enabled: true })
      }
    } else if (h.key.toLowerCase() === 'content-type') {
      contentTypeHeader = h.value
      headers.push({ key: h.key, value: h.value, enabled: true })
    } else {
      headers.push({ key: h.key, value: h.value, enabled: true })
    }
  }

  // ── Resolve auth object ─────────────────────────────────────────────────────
  let auth: ApiRequest['auth'] = { type: 'none' }

  if (bearerToken) {
    auth = { type: 'bearer', bearer: { token: bearerToken } }
  } else if (basicUser) {
    auth = { type: 'basic', basic: { username: basicUser, password: basicPass } }
  }

  // ── Resolve body ───────────────────────────────────────────────────────────
  let body: ApiRequest['body'] = { type: 'none', content: '' }

  if (dataMode === 'form' || formFields.length > 0) {
    const obj = formFields.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {} as Record<string, string>)
    body = {
      type: dataMode === 'urlencoded' ? 'x-www-form-urlencoded' : 'form-data',
      content: JSON.stringify(obj, null, 2),
    }
  } else if (dataMode === 'urlencoded') {
    body = { type: 'x-www-form-urlencoded', content: dataBody }
  } else if (dataBody) {
    const resolved = detectBodyType(dataBody, contentTypeHeader)
    body = { type: resolved, content: dataBody }
  }

  const isWebSocket = url.startsWith('ws://') || url.startsWith('wss://') || hasWebSocketUpgrade
  
  const isGraphQL = 
    url.toLowerCase().includes('graphql') || 
    hasGraphQLContentType ||
    (dataBody && (dataBody.includes('query') || dataBody.includes('mutation') || dataBody.includes('subscription')))

  const graphqlBody = isGraphQL ? parseGraphQLBody(dataBody) : null

  return {
    method: isWebSocket ? 'WS' : isGraphQL ? 'GRAPHQL' : method,
    url: baseUrl,
    params: isWebSocket || isGraphQL ? [] : params,
    headers: isWebSocket ? headers.filter(h => h.key.toLowerCase() !== 'upgrade') : headers,
    body: isGraphQL && graphqlBody ? graphqlBody : body,
    auth,
  }
}

function parseGraphQLBody(dataBody: string): ApiRequest['body'] | null {
  if (!dataBody) return null
  
  try {
    const parsed = JSON.parse(dataBody)
    if (parsed.query) {
      return {
        type: 'graphql',
        content: dataBody,
        graphql: {
          query: parsed.query,
          variables: typeof parsed.variables === 'string' ? parsed.variables : JSON.stringify(parsed.variables || {}, null, 2),
        },
      }
    }
  } catch {}
  
  if (dataBody.trim().startsWith('{') || dataBody.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(dataBody)
      return {
        type: 'graphql',
        content: dataBody,
        graphql: {
          query: parsed.query || parsed.queryString || dataBody,
          variables: parsed.variables ? JSON.stringify(parsed.variables, null, 2) : '{}',
        },
      }
    } catch {}
  }
  
  if (dataBody.includes('query') || dataBody.includes('mutation') || dataBody.includes('subscription')) {
    return {
      type: 'graphql',
      content: dataBody,
      graphql: {
        query: dataBody,
        variables: '{}',
      },
    }
  }
  
  return null
}
