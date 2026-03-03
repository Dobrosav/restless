import { ApiRequest } from '../types'

export function generateCurl(request: ApiRequest): string {
  let curl = 'curl'

  // Method
  if (request.method && request.method !== 'GET') {
    curl += ` -X ${request.method}`
  }

  // URL with params
  let url = request.url
  if (request.params.length > 0) {
    const enabledParams = request.params.filter(p => p.enabled && p.key)
    if (enabledParams.length > 0) {
      const queryString = enabledParams
        .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&')
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  curl += ` '${url}'`

  // Headers
  const enabledHeaders = request.headers.filter(h => h.enabled && h.key)
  for (const header of enabledHeaders) {
    curl += ` -H '${header.key}: ${header.value}'`
  }

  // Body
  if (request.body.type !== 'none' && request.body.content) {
    const bodyContent = request.body.content
    
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
    const credentials = `${request.auth.basic.username}:${request.auth.basic.password}`
    curl += ` -u '${credentials}'`
  } else if (request.auth.type === 'bearer' && request.auth.bearer) {
    curl += ` -H 'Authorization: Bearer ${request.auth.bearer.token}'`
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    const location = request.auth.apiKey.in === 'header' ? 'header' : 'query'
    if (location === 'header') {
      curl += ` -H '${request.auth.apiKey.key}: ${request.auth.apiKey.value}'`
    } else {
      const separator = url.includes('?') ? '&' : '?'
      curl = curl.replace(`'${url}'`, `'${url}${separator}${request.auth.apiKey.key}=${request.auth.apiKey.value}'`)
    }
  }

  return curl
}
