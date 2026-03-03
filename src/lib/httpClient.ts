import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiRequest, ResponseData, KeyValue, Environment } from '../types'

function interpolateEnvVariables(text: string, environment: Environment | null): string {
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

function buildAuthHeaders(request: ApiRequest, environment: Environment | null): Record<string, string> {
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

function buildHeaders(request: ApiRequest, environment: Environment | null): Record<string, string> {
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

function buildParams(request: ApiRequest, environment: Environment | null): Record<string, string> {
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

function buildBody(request: ApiRequest, environment: Environment | null): string | FormData | URLSearchParams | undefined {
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

function createScriptContext(environment: Environment | null) {
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

function runScript(script: string, context: any): { success: boolean; error?: string; logs: string[] } {
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

export async function sendWsRequest(request: ApiRequest, environment: Environment | null): Promise<ResponseData> {
  const url = interpolateEnvVariables(request.url, environment)
  const messages: string[] = []
  
  return new Promise((resolve) => {
    const startTime = performance.now()
    
    try {
      const ws = new WebSocket(url)
      
      ws.onopen = () => {
        messages.push('[Connected]')
      }
      
      ws.onmessage = (event) => {
        messages.push(`[Received] ${event.data}`)
      }
      
      ws.onerror = (error) => {
        messages.push(`[Error] ${error}`)
      }
      
      ws.onclose = () => {
        const endTime = performance.now()
        resolve({
          status: 0,
          statusText: 'WebSocket',
          headers: {},
          body: messages.join('\n'),
          time: Math.round(endTime - startTime),
          size: new Blob([messages.join('\n')]).size,
          type: 'websocket',
          wsMessages: messages,
        })
      }
      
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }, 5000)
    } catch (error: any) {
      const endTime = performance.now()
      resolve({
        status: 0,
        statusText: 'WebSocket Error',
        headers: {},
        body: error.message,
        time: Math.round(endTime - startTime),
        size: 0,
        type: 'websocket',
        wsMessages: [error.message],
      })
    }
  })
}

export async function sendRequest(
  request: ApiRequest, 
  environment: Environment | null = null
): Promise<ResponseData> {
  if (request.method === 'WS') {
    return sendWsRequest(request, environment)
  }
  
  const context = createScriptContext(environment)
  
  if (request.script.pre) {
    const result = runScript(request.script.pre, context)
    if (!result.success) {
      return {
        status: 0,
        statusText: 'Pre-script Error',
        headers: {},
        body: result.error || 'Script failed',
        time: 0,
        size: 0,
        type: 'http',
      }
    }
  }
  
  const startTime = performance.now()
  const url = interpolateEnvVariables(request.url, environment)
  
  const config: AxiosRequestConfig = {
    method: request.method,
    url,
    headers: buildHeaders(request, environment),
    params: buildParams(request, environment),
    data: buildBody(request, environment),
    timeout: 30000,
    validateStatus: () => true,
  }
  
  try {
    const axiosResponse: AxiosResponse = await axios(config)
    const endTime = performance.now()
    
    const responseHeaders: Record<string, string> = {}
    Object.entries(axiosResponse.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        responseHeaders[key] = value
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(', ')
      }
    })
    
    let responseBody: string
    if (typeof axiosResponse.data === 'object') {
      responseBody = JSON.stringify(axiosResponse.data, null, 2)
    } else {
      responseBody = String(axiosResponse.data)
    }
    
    const response: ResponseData = {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: responseHeaders,
      body: responseBody,
      time: Math.round(endTime - startTime),
      size: new Blob([responseBody]).size,
      type: 'http',
    }
    
    if (request.script.post) {
      const postContext = {
        ...context,
        response: {
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          body: axiosResponse.data,
          headers: responseHeaders,
        },
      }
      const result = runScript(request.script.post, postContext)
      if (!result.success) {
        response.body = `Post-script Error: ${result.error}\n\n${response.body}`
      }
    }
    
    return response
  } catch (error: any) {
    const endTime = performance.now()
    
    return {
      status: 0,
      statusText: error.message || 'Network Error',
      headers: {},
      body: error.message || 'Request failed',
      time: Math.round(endTime - startTime),
      size: 0,
      type: 'http',
    }
  }
}
