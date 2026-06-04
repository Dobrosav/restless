import { describe, it, expect } from 'vitest'
import {
  interpolateEnvVariables,
  buildAuthHeaders,
  buildHeaders,
  buildParams,
  buildBody,
  createScriptContext,
  runScript,
} from './httpHelpers'
import { ApiRequest, Environment } from '../types'

const baseRequest: ApiRequest = {
  id: '1',
  name: 'Test',
  method: 'GET',
  url: 'https://api.example.com',
  headers: [],
  params: [],
  body: { type: 'none', content: '' },
  auth: { type: 'none' },
  script: { pre: '', post: '' },
}

const testEnv: Environment = {
  id: 'env-1',
  name: 'Test Env',
  variables: [
    { key: 'baseUrl', value: 'https://api.example.com', enabled: true },
    { key: 'token', value: 'secret-jwt', enabled: true },
    { key: 'disabled', value: 'should-not-appear', enabled: false },
    { key: 'apiKey', value: 'key-123', enabled: true },
  ],
}

// ─── interpolateEnvVariables ─────────────────────────────────────────────────

describe('interpolateEnvVariables', () => {
  it('should replace {{variable}} with environment value', () => {
    const result = interpolateEnvVariables('{{baseUrl}}/users', testEnv)
    expect(result).toBe('https://api.example.com/users')
  })

  it('should replace multiple variables', () => {
    const result = interpolateEnvVariables('{{baseUrl}}/auth?key={{apiKey}}', testEnv)
    expect(result).toBe('https://api.example.com/auth?key=key-123')
  })

  it('should not replace disabled variables', () => {
    const result = interpolateEnvVariables('{{disabled}}', testEnv)
    expect(result).toBe('{{disabled}}')
  })

  it('should not replace unknown variables', () => {
    const result = interpolateEnvVariables('{{unknownVar}}', testEnv)
    expect(result).toBe('{{unknownVar}}')
  })

  it('should return text as-is when environment is null', () => {
    const result = interpolateEnvVariables('{{baseUrl}}', null)
    expect(result).toBe('{{baseUrl}}')
  })

  it('should return empty string as-is', () => {
    const result = interpolateEnvVariables('', testEnv)
    expect(result).toBe('')
  })

  it('should return text without variables unchanged', () => {
    const result = interpolateEnvVariables('plain text', testEnv)
    expect(result).toBe('plain text')
  })

  it('should replace same variable used multiple times', () => {
    const result = interpolateEnvVariables('{{baseUrl}} and {{baseUrl}}', testEnv)
    expect(result).toBe('https://api.example.com and https://api.example.com')
  })

  it('should handle variables with empty keys', () => {
    const env: Environment = {
      id: '1', name: 'Test',
      variables: [{ key: '', value: 'nope', enabled: true }],
    }
    const result = interpolateEnvVariables('{{test}}', env)
    expect(result).toBe('{{test}}')
  })
})

// ─── buildAuthHeaders ────────────────────────────────────────────────────────

describe('buildAuthHeaders', () => {
  it('should return empty object for no auth', () => {
    const result = buildAuthHeaders(baseRequest, null)
    expect(result).toEqual({})
  })

  it('should build Basic Auth header', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'basic', basic: { username: 'admin', password: 'pass' } },
    }
    const result = buildAuthHeaders(req, null)
    expect(result['Authorization']).toBe(`Basic ${btoa('admin:pass')}`)
  })

  it('should build Bearer Auth header', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'bearer', bearer: { token: 'my-token' } },
    }
    const result = buildAuthHeaders(req, null)
    expect(result['Authorization']).toBe('Bearer my-token')
  })

  it('should interpolate Bearer token from environment', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'bearer', bearer: { token: '{{token}}' } },
    }
    const result = buildAuthHeaders(req, testEnv)
    expect(result['Authorization']).toBe('Bearer secret-jwt')
  })

  it('should build API Key header when in=header', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'abc', in: 'header' } },
    }
    const result = buildAuthHeaders(req, null)
    expect(result['X-API-Key']).toBe('abc')
  })

  it('should NOT add API Key header when in=query', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'api-key', apiKey: { key: 'api_key', value: 'abc', in: 'query' } },
    }
    const result = buildAuthHeaders(req, null)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should interpolate API Key from environment', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'api-key', apiKey: { key: 'X-Key', value: '{{apiKey}}', in: 'header' } },
    }
    const result = buildAuthHeaders(req, testEnv)
    expect(result['X-Key']).toBe('key-123')
  })
})

// ─── buildHeaders ────────────────────────────────────────────────────────────

describe('buildHeaders', () => {
  it('should include enabled headers', () => {
    const req: ApiRequest = {
      ...baseRequest,
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'X-Custom', value: 'value', enabled: true },
      ],
    }
    const result = buildHeaders(req, null)
    expect(result['Accept']).toBe('application/json')
    expect(result['X-Custom']).toBe('value')
  })

  it('should skip disabled headers', () => {
    const req: ApiRequest = {
      ...baseRequest,
      headers: [
        { key: 'X-Enabled', value: 'yes', enabled: true },
        { key: 'X-Disabled', value: 'no', enabled: false },
      ],
    }
    const result = buildHeaders(req, null)
    expect(result['X-Enabled']).toBe('yes')
    expect(result['X-Disabled']).toBeUndefined()
  })

  it('should skip headers with empty keys', () => {
    const req: ApiRequest = {
      ...baseRequest,
      headers: [{ key: '', value: 'val', enabled: true }],
    }
    const result = buildHeaders(req, null)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should interpolate header values from environment', () => {
    const req: ApiRequest = {
      ...baseRequest,
      headers: [{ key: 'Authorization', value: 'Bearer {{token}}', enabled: true }],
    }
    const result = buildHeaders(req, testEnv)
    expect(result['Authorization']).toBe('Bearer secret-jwt')
  })

  it('should include auth headers', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'bearer', bearer: { token: 'jwt' } },
    }
    const result = buildHeaders(req, null)
    expect(result['Authorization']).toBe('Bearer jwt')
  })

  it('should set Content-Type for JSON body', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'json', content: '{}' },
    }
    const result = buildHeaders(req, null)
    expect(result['Content-Type']).toBe('application/json')
  })

  it('should set Content-Type for x-www-form-urlencoded body', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'x-www-form-urlencoded', content: '{}' },
    }
    const result = buildHeaders(req, null)
    expect(result['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('should set Content-Type for form-data body', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'form-data', content: '{}' },
    }
    const result = buildHeaders(req, null)
    expect(result['Content-Type']).toBe('multipart/form-data')
  })

  it('should set Content-Type for graphql body', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'graphql', content: '', graphql: { query: '{ users }', variables: '{}' } },
    }
    const result = buildHeaders(req, null)
    expect(result['Content-Type']).toBe('application/json')
  })

  it('should NOT set Content-Type for none body', () => {
    const result = buildHeaders(baseRequest, null)
    expect(result['Content-Type']).toBeUndefined()
  })

  it('should NOT set Content-Type for json body with empty content', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'json', content: '' },
    }
    const result = buildHeaders(req, null)
    expect(result['Content-Type']).toBeUndefined()
  })
})

// ─── buildParams ─────────────────────────────────────────────────────────────

describe('buildParams', () => {
  it('should include enabled params', () => {
    const req: ApiRequest = {
      ...baseRequest,
      params: [
        { key: 'page', value: '1', enabled: true },
        { key: 'limit', value: '20', enabled: true },
      ],
    }
    const result = buildParams(req, null)
    expect(result['page']).toBe('1')
    expect(result['limit']).toBe('20')
  })

  it('should skip disabled params', () => {
    const req: ApiRequest = {
      ...baseRequest,
      params: [
        { key: 'active', value: 'true', enabled: true },
        { key: 'hidden', value: 'false', enabled: false },
      ],
    }
    const result = buildParams(req, null)
    expect(result['active']).toBe('true')
    expect(result['hidden']).toBeUndefined()
  })

  it('should skip params with empty keys', () => {
    const req: ApiRequest = {
      ...baseRequest,
      params: [{ key: '', value: 'val', enabled: true }],
    }
    const result = buildParams(req, null)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should interpolate param values from environment', () => {
    const req: ApiRequest = {
      ...baseRequest,
      params: [{ key: 'url', value: '{{baseUrl}}', enabled: true }],
    }
    const result = buildParams(req, testEnv)
    expect(result['url']).toBe('https://api.example.com')
  })

  it('should add API Key to query params when in=query', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'api-key', apiKey: { key: 'api_key', value: 'secret', in: 'query' } },
    }
    const result = buildParams(req, null)
    expect(result['api_key']).toBe('secret')
  })

  it('should NOT add API Key to query params when in=header', () => {
    const req: ApiRequest = {
      ...baseRequest,
      auth: { type: 'api-key', apiKey: { key: 'X-Key', value: 'val', in: 'header' } },
    }
    const result = buildParams(req, null)
    expect(result['X-Key']).toBeUndefined()
  })

  it('should return empty object when no params', () => {
    const result = buildParams(baseRequest, null)
    expect(result).toEqual({})
  })
})

// ─── buildBody ───────────────────────────────────────────────────────────────

describe('buildBody', () => {
  it('should return undefined for none body type', () => {
    const result = buildBody(baseRequest, null)
    expect(result).toBeUndefined()
  })

  it('should return JSON content as string', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'json', content: '{"key":"value"}' },
    }
    const result = buildBody(req, null)
    expect(result).toBe('{"key":"value"}')
  })

  it('should return text content as string', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'text', content: 'plain text' },
    }
    const result = buildBody(req, null)
    expect(result).toBe('plain text')
  })

  it('should interpolate body content from environment', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'json', content: '{"url":"{{baseUrl}}"}' },
    }
    const result = buildBody(req, testEnv)
    expect(result).toBe('{"url":"https://api.example.com"}')
  })

  it('should return undefined when content is empty', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'json', content: '' },
    }
    const result = buildBody(req, null)
    expect(result).toBeUndefined()
  })

  it('should convert x-www-form-urlencoded JSON to URLSearchParams string', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'x-www-form-urlencoded', content: '{"user":"admin","pass":"secret"}' },
    }
    const result = buildBody(req, null) as string
    expect(result).toContain('user=admin')
    expect(result).toContain('pass=secret')
  })

  it('should fallback to raw content for invalid x-www-form-urlencoded JSON', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'x-www-form-urlencoded', content: 'not-json' },
    }
    const result = buildBody(req, null)
    expect(result).toBe('not-json')
  })

  it('should return FormData for form-data type', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'form-data', content: '{"file":"data","name":"test"}' },
    }
    const result = buildBody(req, null)
    expect(result).toBeInstanceOf(FormData)
    const fd = result as FormData
    expect(fd.get('file')).toBe('data')
    expect(fd.get('name')).toBe('test')
  })

  it('should return undefined for invalid form-data JSON', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'form-data', content: 'not-json' },
    }
    const result = buildBody(req, null)
    expect(result).toBeUndefined()
  })

  it('should build graphql body from query and variables', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: {
        type: 'graphql',
        content: '',
        graphql: { query: '{ users { id name } }', variables: '{"limit": 10}' },
      },
    }
    const result = buildBody(req, null) as string
    const parsed = JSON.parse(result)
    expect(parsed.query).toBe('{ users { id name } }')
    expect(parsed.variables).toEqual({ limit: 10 })
  })

  it('should handle graphql with empty variables', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: {
        type: 'graphql',
        content: '',
        graphql: { query: '{ users }', variables: '' },
      },
    }
    const result = buildBody(req, null) as string
    const parsed = JSON.parse(result)
    expect(parsed.query).toBe('{ users }')
    expect(parsed.variables).toEqual({})
  })

  it('should interpolate graphql query from environment', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: {
        type: 'graphql',
        content: '',
        graphql: { query: '{ user(url: "{{baseUrl}}") }', variables: '{}' },
      },
    }
    const result = buildBody(req, testEnv) as string
    const parsed = JSON.parse(result)
    expect(parsed.query).toContain('https://api.example.com')
  })

  it('should return undefined for unknown body type', () => {
    const req: ApiRequest = {
      ...baseRequest,
      body: { type: 'binary' as any, content: 'something' },
    }
    const result = buildBody(req, null)
    expect(result).toBeUndefined()
  })
})

// ─── createScriptContext ─────────────────────────────────────────────────────

describe('createScriptContext', () => {
  it('should build context from environment variables', () => {
    const ctx = createScriptContext(testEnv)
    expect(ctx.environment['baseUrl']).toBe('https://api.example.com')
    expect(ctx.environment['token']).toBe('secret-jwt')
    expect(ctx.globals['baseUrl']).toBe('https://api.example.com')
  })

  it('should skip disabled variables', () => {
    const ctx = createScriptContext(testEnv)
    expect(ctx.environment['disabled']).toBeUndefined()
  })

  it('should return empty context when environment is null', () => {
    const ctx = createScriptContext(null)
    expect(ctx.environment).toEqual({})
    expect(ctx.globals).toEqual({})
  })

  it('should skip variables with empty keys', () => {
    const env: Environment = {
      id: '1', name: 'Test',
      variables: [
        { key: '', value: 'ignored', enabled: true },
        { key: 'valid', value: 'ok', enabled: true },
      ],
    }
    const ctx = createScriptContext(env)
    expect(Object.keys(ctx.environment)).toEqual(['valid'])
  })

  it('should have same reference for environment and globals', () => {
    const ctx = createScriptContext(testEnv)
    expect(ctx.environment).toBe(ctx.globals)
  })
})

// ─── runScript ───────────────────────────────────────────────────────────────

describe('runScript', () => {
  it('should execute a simple script successfully', () => {
    const result = runScript('var x = 1;', {})
    expect(result.success).toBe(true)
    expect(result.logs).toEqual([])
  })

  it('should capture console.log output', () => {
    const result = runScript('console.log("hello", "world")', {})
    expect(result.success).toBe(true)
    expect(result.logs).toEqual(['hello world'])
  })

  it('should capture console.info output', () => {
    const result = runScript('console.info("info msg")', {})
    expect(result.logs).toEqual(['[info] info msg'])
  })

  it('should capture console.warn output', () => {
    const result = runScript('console.warn("warning")', {})
    expect(result.logs).toEqual(['[warn] warning'])
  })

  it('should capture console.error output', () => {
    const result = runScript('console.error("error!")', {})
    expect(result.logs).toEqual(['[error] error!'])
  })

  it('should capture multiple log calls', () => {
    const result = runScript(
      'console.log("one"); console.log("two"); console.log("three")',
      {}
    )
    expect(result.logs).toEqual(['one', 'two', 'three'])
  })

  it('should handle script errors gracefully', () => {
    const result = runScript('throw new Error("test error")', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('test error')
  })

  it('should handle syntax errors', () => {
    const result = runScript('if (', {})
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should have access to context variables', () => {
    const context = { environment: { baseUrl: 'https://example.com' } }
    const result = runScript('console.log(environment.baseUrl)', context)
    expect(result.success).toBe(true)
    expect(result.logs).toEqual(['https://example.com'])
  })

  it('should handle empty script', () => {
    const result = runScript('', {})
    expect(result.success).toBe(true)
    expect(result.logs).toEqual([])
  })

  it('should preserve logs even when script throws', () => {
    const result = runScript('console.log("before"); throw new Error("oops")', {})
    expect(result.success).toBe(false)
    expect(result.logs).toEqual(['before'])
    expect(result.error).toBe('oops')
  })

  it('should convert non-string values in console.log', () => {
    const result = runScript('console.log(42, true, null)', {})
    expect(result.logs).toEqual(['42 true null'])
  })

  it('should access context with "with" statement', () => {
    const context = { myVar: 'hello' }
    const result = runScript('console.log(myVar)', context)
    expect(result.success).toBe(true)
    expect(result.logs).toEqual(['hello'])
  })
})
