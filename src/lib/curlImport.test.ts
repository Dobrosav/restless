import { describe, it, expect } from 'vitest'
import { parseCurl } from './curlImport'

describe('parseCurl', () => {
  describe('Basic requests', () => {
    it('should parse simple GET request', () => {
      const result = parseCurl('curl https://api.example.com/data')
      expect(result.method).toBe('GET')
      expect(result.url).toBe('https://api.example.com/data')
      expect(result.headers).toEqual([])
      expect(result.params).toEqual([])
      expect(result.body?.type).toBe('none')
    })
  })

  describe('Headers and Parameters', () => {
    it('should parse headers correctly', () => {
      const result = parseCurl('curl -H "Content-Type: application/json" -H "Accept: application/json" https://api.example.com/data')
      expect(result.headers).toContainEqual({ key: 'Content-Type', value: 'application/json', enabled: true })
      expect(result.headers).toContainEqual({ key: 'Accept', value: 'application/json', enabled: true })
    })

    it('should extract query params', () => {
      const result = parseCurl('curl "https://api.example.com/search?q=test&limit=10"')
      expect(result.url).toBe('https://api.example.com/search')
      expect(result.params).toContainEqual({ key: 'q', value: 'test', enabled: true })
      expect(result.params).toContainEqual({ key: 'limit', value: '10', enabled: true })
    })
  })

  describe('Body parsing', () => {
    it('should parse POST request with JSON body', () => {
      const result = parseCurl(`curl -X POST -H "Content-Type: application/json" -d '{"key": "value"}' https://api.example.com/data`)
      expect(result.method).toBe('POST')
      expect(result.body?.type).toBe('json')
      expect(result.body?.content).toBe('{"key": "value"}')
    })
  })

  describe('Authentication extraction', () => {
    it('should extract Bearer token from headers', () => {
      const result = parseCurl('curl -H "Authorization: Bearer secret-token" https://api.example.com/data')
      expect(result.auth?.type).toBe('bearer')
      if (result.auth?.type === 'bearer') {
        expect(result.auth.bearer?.token).toBe('secret-token')
      }
    })

    it('should extract Basic Auth from -u flag', () => {
      const result = parseCurl('curl -u admin:password https://api.example.com/data')
      expect(result.auth?.type).toBe('basic')
      if (result.auth?.type === 'basic') {
        expect(result.auth.basic?.username).toBe('admin')
        expect(result.auth.basic?.password).toBe('password')
      }
    })

    it('should extract Basic Auth from header', () => {
      const authString = btoa('user:pass')
      const result = parseCurl(`curl -H "Authorization: Basic ${authString}" https://api.example.com/data`)
      expect(result.auth?.type).toBe('basic')
      if (result.auth?.type === 'basic') {
        expect(result.auth.basic?.username).toBe('user')
        expect(result.auth.basic?.password).toBe('pass')
      }
    })
  })
})
