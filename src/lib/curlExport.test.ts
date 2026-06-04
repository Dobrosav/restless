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

    it('should handle Bearer Auth', () => {
      const req: ApiRequest = {
        ...baseRequest,
        auth: { type: 'bearer', bearer: { token: 'my-jwt-token' } }
      }
      const curl = generateCurl(req)
      expect(curl).toContain("-H 'Authorization: Bearer my-jwt-token'")
    })

    it('should handle API Key auth in header', () => {
      const req: ApiRequest = {
        ...baseRequest,
        auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'abc123', in: 'header' } }
      }
      const curl = generateCurl(req)
      expect(curl).toContain("-H 'X-API-Key: abc123'")
    })

    it('should handle API Key auth in query string', () => {
      const req: ApiRequest = {
        ...baseRequest,
        auth: { type: 'api-key', apiKey: { key: 'api_key', value: 'secret', in: 'query' } }
      }
      const curl = generateCurl(req)
      expect(curl).toContain('api_key=secret')
    })

    it('should not add auth for none type', () => {
      const curl = generateCurl(baseRequest)
      expect(curl).not.toContain('-u ')
      expect(curl).not.toContain('Authorization')
    })
  })

  describe('Body types', () => {
    it('should handle text body', () => {
      const req: ApiRequest = {
        ...baseRequest,
        method: 'POST',
        body: { type: 'text', content: 'plain text here' }
      }
      const curl = generateCurl(req)
      expect(curl).toContain("-d 'plain text here'")
      expect(curl).not.toContain('Content-Type')
    })

    it('should handle form-data body', () => {
      const req: ApiRequest = {
        ...baseRequest,
        method: 'POST',
        body: { type: 'form-data', content: '{"name":"test","file":"data"}' }
      }
      const curl = generateCurl(req)
      expect(curl).toContain("-F 'name=test'")
      expect(curl).toContain("-F 'file=data'")
    })

    it('should fallback for invalid form-data JSON', () => {
      const req: ApiRequest = {
        ...baseRequest,
        method: 'POST',
        body: { type: 'form-data', content: 'not-json' }
      }
      const curl = generateCurl(req)
      expect(curl).toContain("-d 'not-json'")
    })

    it('should not include body for none type', () => {
      const curl = generateCurl(baseRequest)
      expect(curl).not.toContain('-d ')
      expect(curl).not.toContain('-F ')
    })
  })

  describe('Multiple query parameters', () => {
    it('should combine multiple enabled params', () => {
      const req: ApiRequest = {
        ...baseRequest,
        params: [
          { key: 'page', value: '1', enabled: true },
          { key: 'limit', value: '20', enabled: true },
          { key: 'sort', value: 'name', enabled: true },
        ]
      }
      const curl = generateCurl(req)
      expect(curl).toContain('page=1')
      expect(curl).toContain('limit=20')
      expect(curl).toContain('sort=name')
    })
  })

  describe('Environment variable edge cases', () => {
    it('should keep unresolved variables as-is', () => {
      const req: ApiRequest = {
        ...baseRequest,
        url: '{{baseUrl}}/data',
      }
      const env: Environment = {
        id: '1', name: 'Empty',
        variables: []
      }
      const curl = generateCurl(req, env)
      expect(curl).toContain('{{baseUrl}}/data')
    })

    it('should skip disabled environment variables', () => {
      const req: ApiRequest = {
        ...baseRequest,
        url: '{{baseUrl}}/data',
      }
      const env: Environment = {
        id: '1', name: 'Test',
        variables: [
          { key: 'baseUrl', value: 'https://resolved.com', enabled: false }
        ]
      }
      const curl = generateCurl(req, env)
      expect(curl).toContain('{{baseUrl}}/data')
      expect(curl).not.toContain('resolved.com')
    })

    it('should work without an environment', () => {
      const curl = generateCurl(baseRequest)
      expect(curl).toBe("curl 'https://api.example.com/data'")
    })

    it('should work with null environment', () => {
      const curl = generateCurl(baseRequest, null)
      expect(curl).toBe("curl 'https://api.example.com/data'")
    })
  })

  describe('HTTP methods', () => {
    it('should not include -X for GET', () => {
      const curl = generateCurl(baseRequest)
      expect(curl).not.toContain('-X')
    })

    it('should include -X for PUT', () => {
      const req: ApiRequest = { ...baseRequest, method: 'PUT' }
      const curl = generateCurl(req)
      expect(curl).toContain('-X PUT')
    })

    it('should include -X for PATCH', () => {
      const req: ApiRequest = { ...baseRequest, method: 'PATCH' }
      const curl = generateCurl(req)
      expect(curl).toContain('-X PATCH')
    })

    it('should include -X for DELETE', () => {
      const req: ApiRequest = { ...baseRequest, method: 'DELETE' }
      const curl = generateCurl(req)
      expect(curl).toContain('-X DELETE')
    })
  })
})
