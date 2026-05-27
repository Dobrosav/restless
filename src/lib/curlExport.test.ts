import { describe, it, expect } from 'vitest'
import { generateCurl } from './curlExport'
import { ApiRequest, Environment } from '../types'

describe('generateCurl', () => {
  const baseRequest: ApiRequest = {
    id: '1',
    name: 'Test',
    method: 'GET',
    url: 'https://api.example.com/data',
    headers: [],
    params: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    script: { pre: '', post: '' }
  }

  describe('Basic request generation', () => {
    it('should generate simple GET request', () => {
      const curl = generateCurl(baseRequest)
      expect(curl).toBe("curl 'https://api.example.com/data'")
    })

    it('should generate POST request with headers and body', () => {
      const req: ApiRequest = {
        ...baseRequest,
        method: 'POST',
        headers: [
          { key: 'Accept', value: 'application/json', enabled: true },
          { key: 'X-Disabled', value: 'ignore', enabled: false }
        ],
        body: { type: 'json', content: '{"key":"value"}' }
      }
      const curl = generateCurl(req)
      expect(curl).toContain('-X POST')
      expect(curl).toContain("-H 'Accept: application/json'")
      expect(curl).toContain("-H 'Content-Type: application/json'")
      expect(curl).toContain("-d '{\"key\":\"value\"}'")
    })
  })

  describe('Environment interpolation', () => {
    it('should interpolate environment variables', () => {
      const req: ApiRequest = {
        ...baseRequest,
        url: '{{baseUrl}}/data',
        headers: [{ key: 'Authorization', value: 'Bearer {{token}}', enabled: true }]
      }
      const env: Environment = {
        id: '1',
        name: 'Test Env',
        variables: [
          { key: 'baseUrl', value: 'https://api.example.com', enabled: true },
          { key: 'token', value: 'secret123', enabled: true }
        ]
      }
      const curl = generateCurl(req, env)
      expect(curl).toBe("curl 'https://api.example.com/data' -H 'Authorization: Bearer secret123'")
    })
  })

  describe('Parameters and Headers', () => {
    it('should handle query parameters', () => {
      const req: ApiRequest = {
        ...baseRequest,
        params: [
          { key: 'q', value: 'search term', enabled: true },
          { key: 'disabled', value: '1', enabled: false }
        ]
      }
      const curl = generateCurl(req)
      expect(curl).toBe("curl 'https://api.example.com/data?q=search%20term'")
    })
  })

  describe('Authentication generation', () => {
    it('should handle Basic Auth', () => {
      const req: ApiRequest = {
        ...baseRequest,
        auth: { type: 'basic', basic: { username: 'admin', password: 'password' } }
      }
      const curl = generateCurl(req)
      expect(curl).toContain("-u 'admin:password'")
    })
  })
})
