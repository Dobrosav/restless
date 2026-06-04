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

    it('should extract bearer token from --oauth2-bearer flag', () => {
      const result = parseCurl('curl --oauth2-bearer my-token https://api.example.com/data')
      expect(result.auth?.type).toBe('bearer')
      if (result.auth?.type === 'bearer') {
        expect(result.auth.bearer?.token).toBe('my-token')
      }
    })

    it('should keep unknown auth schemes as headers', () => {
      const result = parseCurl('curl -H "Authorization: Digest abc123" https://api.example.com/data')
      expect(result.auth?.type).toBe('none')
      expect(result.headers).toContainEqual({ key: 'Authorization', value: 'Digest abc123', enabled: true })
    })
  })

  describe('Multiline and quoting', () => {
    it('should handle backslash line continuation', () => {
      const result = parseCurl(`curl \\\n  -X POST \\\n  https://api.example.com/data`)
      expect(result.method).toBe('POST')
      expect(result.url).toBe('https://api.example.com/data')
    })

    it('should handle single-quoted URL', () => {
      const result = parseCurl("curl 'https://api.example.com/data'")
      expect(result.url).toBe('https://api.example.com/data')
    })

    it('should handle double-quoted URL', () => {
      const result = parseCurl('curl "https://api.example.com/data"')
      expect(result.url).toBe('https://api.example.com/data')
    })
  })

  describe('Form fields', () => {
    it('should parse -F form fields', () => {
      const result = parseCurl('curl -F "name=test" -F "file=data" https://api.example.com/upload')
      expect(result.body?.type).toBe('form-data')
      const parsed = JSON.parse(result.body?.content || '{}')
      expect(parsed.name).toBe('test')
      expect(parsed.file).toBe('data')
    })

    it('should parse --form flag', () => {
      const result = parseCurl('curl --form "field=value" https://api.example.com/upload')
      expect(result.body?.type).toBe('form-data')
    })

    it('should set method to POST when -F is used with GET', () => {
      const result = parseCurl('curl -F "name=test" https://api.example.com/upload')
      expect(result.method).toBe('POST')
    })
  })

  describe('Data variants', () => {
    it('should parse --data-raw', () => {
      const result = parseCurl('curl --data-raw \'{"key":"value"}\' https://api.example.com/data')
      expect(result.body?.content).toBe('{"key":"value"}')
      expect(result.body?.type).toBe('json')
    })

    it('should parse --data-binary', () => {
      const result = parseCurl('curl --data-binary \'binary-data\' https://api.example.com/data')
      expect(result.body?.content).toBe('binary-data')
    })

    it('should parse --data-urlencode', () => {
      const result = parseCurl('curl --data-urlencode "name=hello world" https://api.example.com/data')
      expect(result.method).toBe('POST')
      expect(result.body?.type).toBe('x-www-form-urlencoded')
    })

    it('should set method to POST when -d is used', () => {
      const result = parseCurl('curl -d "data" https://api.example.com/data')
      expect(result.method).toBe('POST')
    })

    it('should not override explicit method when -d is used', () => {
      const result = parseCurl('curl -X PUT -d "data" https://api.example.com/data')
      expect(result.method).toBe('PUT')
    })
  })

  describe('Flags that should be silently skipped', () => {
    it('should skip -L/--location', () => {
      const result = parseCurl('curl -L https://api.example.com/redirect')
      expect(result.url).toBe('https://api.example.com/redirect')
    })

    it('should skip -s/--silent', () => {
      const result = parseCurl('curl -s https://api.example.com/data')
      expect(result.url).toBe('https://api.example.com/data')
    })

    it('should skip -k/--insecure', () => {
      const result = parseCurl('curl -k https://api.example.com/data')
      expect(result.url).toBe('https://api.example.com/data')
    })

    it('should skip --compressed', () => {
      const result = parseCurl('curl --compressed https://api.example.com/data')
      expect(result.url).toBe('https://api.example.com/data')
    })

    it('should skip flags with values like -o, --max-time', () => {
      const result = parseCurl('curl -o output.json --max-time 30 https://api.example.com/data')
      expect(result.url).toBe('https://api.example.com/data')
      expect(result.headers?.some(h => h.value === 'output.json')).toBe(false)
    })
  })

  describe('Method shorthand', () => {
    it('should parse -XPOST as POST method', () => {
      const result = parseCurl('curl -XPOST https://api.example.com/data')
      expect(result.method).toBe('POST')
    })

    it('should parse -XDELETE as DELETE method', () => {
      const result = parseCurl('curl -XDELETE https://api.example.com/data/1')
      expect(result.method).toBe('DELETE')
    })
  })

  describe('Content-Type detection', () => {
    it('should detect JSON from Content-Type header', () => {
      const result = parseCurl('curl -X POST -H "Content-Type: application/json" -d \'data\' https://api.example.com')
      expect(result.body?.type).toBe('json')
    })

    it('should detect urlencoded from Content-Type header', () => {
      const result = parseCurl('curl -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "key=value" https://api.example.com')
      expect(result.body?.type).toBe('x-www-form-urlencoded')
    })

    it('should detect JSON from body content heuristic', () => {
      const result = parseCurl('curl -d \'{"key": "value"}\' https://api.example.com')
      expect(result.body?.type).toBe('json')
    })

    it('should default to text for non-JSON body', () => {
      const result = parseCurl('curl -d "plain text" https://api.example.com')
      expect(result.body?.type).toBe('text')
    })
  })

  describe('Complex real-world curl commands', () => {
    it('should parse a full real-world curl command', () => {
      const cmd = `curl -X POST 'https://api.example.com/v2/users' -H 'Content-Type: application/json' -H 'Accept: application/json' -u admin:password -d '{"name":"John","email":"john@example.com"}'`
      const result = parseCurl(cmd)
      expect(result.method).toBe('POST')
      expect(result.url).toBe('https://api.example.com/v2/users')
      expect(result.body?.type).toBe('json')
      expect(result.auth?.type).toBe('basic')
      expect(result.headers?.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle curl with many flags', () => {
      const cmd = `curl -s -S -L -k --compressed -H "Accept: */*" https://api.example.com/data`
      const result = parseCurl(cmd)
      expect(result.url).toBe('https://api.example.com/data')
      expect(result.method).toBe('GET')
    })
  })
})

