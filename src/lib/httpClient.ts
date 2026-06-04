import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiRequest, ResponseData, Environment } from '../types'
import {
  interpolateEnvVariables,
  buildHeaders,
  buildParams,
  buildBody,
  createScriptContext,
  runScript,
} from './httpHelpers'


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
