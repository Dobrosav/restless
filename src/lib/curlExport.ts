import { ApiRequest, Environment } from '../types'

function interpolate(text: string, environment?: Environment | null): string {
  if (!text || !environment) return text
  
  return text.replace(/\{\{([^}]+)\}\}|\{([^}]+)\}/g, (match, keyDouble, keySingle) => {
    const key = keyDouble || keySingle;
    const v = environment.variables.find(v => v.enabled && v.key === key.trim())
    return v ? v.value : match
  })
}

export function generateCurl(request: ApiRequest, environment?: Environment | null): string {
  let curl = 'curl'

  // Method
  if (request.method && request.method !== 'GET') {
    curl += ` -X ${request.method}`
  }

  // URL with params
  let url = interpolate(request.url, environment)
  if (request.params.length > 0) {
    const enabledParams = request.params.filter(p => p.enabled && p.key)
    if (enabledParams.length > 0) {
      const queryString = enabledParams
        .map(p => `${encodeURIComponent(interpolate(p.key, environment))}=${encodeURIComponent(interpolate(p.value, environment))}`)
        .join('&')
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  curl += ` '${url}'`

  // Headers
  const enabledHeaders = request.headers.filter(h => h.enabled && h.key)
  for (const header of enabledHeaders) {
    curl += ` -H '${interpolate(header.key, environment)}: ${interpolate(header.value, environment)}'`
  }

  // Body
  if (request.body.type !== 'none' && request.body.content) {
    const bodyContent = interpolate(request.body.content, environment)
    
    if (request.body.type === 'json') {
      curl += ` -H 'Content-Type: application/json'`
      curl += ` -d '${bodyContent.replace(/'/g, "'\\''")}'`
    } else if (request.body.type === 'text') {
      curl += ` -d '${bodyContent.replace(/'/g, "'\\''")}'`
    } else if (request.body.type === 'form-data' || request.body.type === 'x-www-form-urlencoded') {
      try {
        const data = JSON.parse(bodyContent)
        for (const [key, value] of Object.entries(data)) {
          curl += ` -F '${key}=${value}'`
        }
      } catch {
        curl += ` -d '${bodyContent.replace(/'/g, "'\\''")}'`
      }
    }
  }

  // Auth
  if (request.auth.type === 'basic' && request.auth.basic) {
    const credentials = `${interpolate(request.auth.basic.username, environment)}:${interpolate(request.auth.basic.password, environment)}`
    curl += ` -u '${credentials}'`
  } else if (request.auth.type === 'bearer' && request.auth.bearer) {
    curl += ` -H 'Authorization: Bearer ${interpolate(request.auth.bearer.token, environment)}'`
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    const location = request.auth.apiKey.in === 'header' ? 'header' : 'query'
    if (location === 'header') {
      curl += ` -H '${interpolate(request.auth.apiKey.key, environment)}: ${interpolate(request.auth.apiKey.value, environment)}'`
    } else {
      const separator = url.includes('?') ? '&' : '?'
      curl = curl.replace(`'${url}'`, `'${url}${separator}${interpolate(request.auth.apiKey.key, environment)}=${interpolate(request.auth.apiKey.value, environment)}'`)
    }
  }

  return curl
}
