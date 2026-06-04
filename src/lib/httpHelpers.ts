import { ApiRequest, KeyValue, Environment } from '../types'

export function interpolateEnvVariables(text: string, environment: Environment | null): string {
  if (!environment || !text) return text
  
  let result = text
  environment.variables
    .filter(v => v.enabled && v.key)
    .forEach(v => {
      const regex = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g')
      result = result.replace(regex, v.value)
    })
  return result
}

export function buildAuthHeaders(request: ApiRequest, environment: Environment | null): Record<string, string> {
  const headers: Record<string, string> = {}
  
  if (request.auth.type === 'basic' && request.auth.basic) {
    const encoded = btoa(`${request.auth.basic.username}:${request.auth.basic.password}`)
    headers['Authorization'] = `Basic ${encoded}`
  } else if (request.auth.type === 'bearer' && request.auth.bearer) {
    headers['Authorization'] = `Bearer ${interpolateEnvVariables(request.auth.bearer.token, environment)}`
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.in === 'header') {
      headers[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment)
    }
  }
  
  return headers
}

export function buildHeaders(request: ApiRequest, environment: Environment | null): Record<string, string> {
  const headers: Record<string, string> = {}
  
  request.headers
    .filter((h: KeyValue) => h.enabled && h.key)
    .forEach((h: KeyValue) => {
      headers[interpolateEnvVariables(h.key, environment)] = interpolateEnvVariables(h.value, environment)
    })
  
  const authHeaders = buildAuthHeaders(request, environment)
  Object.assign(headers, authHeaders)
  
  if (request.body.type === 'json' && request.body.content) {
    headers['Content-Type'] = 'application/json'
  } else if (request.body.type === 'x-www-form-urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (request.body.type === 'form-data') {
    headers['Content-Type'] = 'multipart/form-data'
  } else if (request.body.type === 'graphql') {
    headers['Content-Type'] = 'application/json'
  }
  
  return headers
}

export function buildParams(request: ApiRequest, environment: Environment | null): Record<string, string> {
  const params: Record<string, string> = {}
  
  request.params
    .filter((p: KeyValue) => p.enabled && p.key)
    .forEach((p: KeyValue) => {
      params[interpolateEnvVariables(p.key, environment)] = interpolateEnvVariables(p.value, environment)
    })
  
  if (request.auth.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.in === 'query') {
      params[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment)
    }
  }
  
  return params
}

export function buildBody(request: ApiRequest, environment: Environment | null): string | FormData | URLSearchParams | undefined {
  if (request.body.type === 'graphql') {
    const query = interpolateEnvVariables(request.body.graphql?.query || '', environment)
    const variables = interpolateEnvVariables(request.body.graphql?.variables || '{}', environment)
    return JSON.stringify({ query, variables: JSON.parse(variables) })
  }
  
  if (!request.body.content) return undefined
  
  const content = interpolateEnvVariables(request.body.content, environment)
  
  switch (request.body.type) {
    case 'json':
    case 'text':
      return content
    case 'x-www-form-urlencoded':
      try {
        const obj = JSON.parse(content)
        return new URLSearchParams(obj as Record<string, string>).toString()
      } catch {
        return content
      }
    case 'form-data':
      try {
        const obj = JSON.parse(content)
        const formData = new FormData()
        Object.entries(obj).forEach(([key, value]) => {
          formData.append(key, value as string)
        })
        return formData
      } catch {
        return undefined
      }
    default:
      return undefined
  }
}

export function createScriptContext(environment: Environment | null) {
  const vars: Record<string, string> = {}
  if (environment) {
    environment.variables
      .filter(v => v.enabled && v.key)
      .forEach(v => {
        vars[v.key] = v.value
      })
  }
  
  return {
    environment: vars,
    globals: vars,
  }
}

export function runScript(script: string, context: any): { success: boolean; error?: string; logs: string[] } {
  const logs: string[] = []
  const console = {
    log: (...args: any[]) => logs.push(args.map(a => String(a)).join(' ')),
    info: (...args: any[]) => logs.push('[info] ' + args.map(a => String(a)).join(' ')),
    warn: (...args: any[]) => logs.push('[warn] ' + args.map(a => String(a)).join(' ')),
    error: (...args: any[]) => logs.push('[error] ' + args.map(a => String(a)).join(' ')),
  }
  
  try {
    const fn = new Function('context', 'console', `
      with(context) {
        ${script}
      }
    `)
    fn(context, console)
    return { success: true, logs }
  } catch (error: any) {
    return { success: false, error: error.message, logs }
  }
}
