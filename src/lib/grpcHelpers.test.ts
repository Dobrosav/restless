import { describe, it, expect } from 'vitest'
import {
  interpolateGrpc,
  parseGrpcMessage,
  buildGrpcMetadata,
  validateGrpcConfig,
  resolveService,
} from './grpcHelpers'
import { Environment, GrpcConfig } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const testEnv: Environment = {
  id: 'env-1',
  name: 'Test',
  variables: [
    { key: 'host', value: 'localhost:50051', enabled: true },
    { key: 'token', value: 'secret-token', enabled: true },
    { key: 'disabled', value: 'should-not-appear', enabled: false },
    { key: 'name', value: 'Restless', enabled: true },
  ],
}

const baseGrpcConfig: GrpcConfig = {
  proto: 'syntax = "proto3";\npackage hello;\nservice Greeter { rpc SayHello(HelloRequest) returns (HelloReply); }\nmessage HelloRequest { string name = 1; }\nmessage HelloReply { string message = 1; }',
  service: 'hello.Greeter',
  method: 'SayHello',
  message: '{}',
  metadata: [],
  callType: 'unary',
  tls: false,
}

// ─── interpolateGrpc ───────────────────────────────────────────────────────────

describe('interpolateGrpc', () => {
  it('replaces {{variable}} with environment value', () => {
    expect(interpolateGrpc('{{host}}/path', testEnv)).toBe('localhost:50051/path')
  })

  it('replaces multiple variables in one string', () => {
    expect(interpolateGrpc('grpc://{{host}}?token={{token}}', testEnv)).toBe(
      'grpc://localhost:50051?token=secret-token'
    )
  })

  it('does not replace disabled variables', () => {
    expect(interpolateGrpc('{{disabled}}', testEnv)).toBe('{{disabled}}')
  })

  it('does not replace unknown variables', () => {
    expect(interpolateGrpc('{{unknown}}', testEnv)).toBe('{{unknown}}')
  })

  it('returns text as-is when environment is null', () => {
    expect(interpolateGrpc('{{host}}', null)).toBe('{{host}}')
  })

  it('returns empty string unchanged', () => {
    expect(interpolateGrpc('', testEnv)).toBe('')
  })

  it('handles variables with whitespace around key', () => {
    expect(interpolateGrpc('{{ name }}', testEnv)).toBe('Restless')
  })

  it('leaves string without placeholders unchanged', () => {
    expect(interpolateGrpc('hello world', testEnv)).toBe('hello world')
  })
})

// ─── parseGrpcMessage ─────────────────────────────────────────────────────────

describe('parseGrpcMessage', () => {
  it('parses a valid JSON string', () => {
    const result = parseGrpcMessage('{"name": "Alice"}', null)
    expect(result).toEqual({ ok: true, data: { name: 'Alice' } })
  })

  it('interpolates environment variables before parsing', () => {
    const result = parseGrpcMessage('{"name": "{{name}}"}', testEnv)
    expect(result).toEqual({ ok: true, data: { name: 'Restless' } })
  })

  it('defaults to {} for empty message', () => {
    const result = parseGrpcMessage('', null)
    expect(result).toEqual({ ok: true, data: {} })
  })

  it('returns ok:false for invalid JSON', () => {
    const result = parseGrpcMessage('{name: Alice}', null)
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toMatch(/Invalid JSON/)
  })

  it('parses nested objects', () => {
    const result = parseGrpcMessage('{"user": {"id": 1, "role": "admin"}}', null)
    expect(result).toEqual({ ok: true, data: { user: { id: 1, role: 'admin' } } })
  })

  it('parses array values', () => {
    const result = parseGrpcMessage('{"ids": [1, 2, 3]}', null)
    expect(result).toEqual({ ok: true, data: { ids: [1, 2, 3] } })
  })

  it('handles number and boolean values', () => {
    const result = parseGrpcMessage('{"count": 5, "active": true}', null)
    expect(result).toEqual({ ok: true, data: { count: 5, active: true } })
  })
})

// ─── buildGrpcMetadata ────────────────────────────────────────────────────────

describe('buildGrpcMetadata', () => {
  it('returns empty array for empty metadata', () => {
    expect(buildGrpcMetadata([], null)).toEqual([])
  })

  it('filters out disabled entries', () => {
    const metadata = [
      { key: 'x-token', value: 'abc', enabled: true },
      { key: 'x-skip', value: 'xyz', enabled: false },
    ]
    expect(buildGrpcMetadata(metadata, null)).toEqual([{ key: 'x-token', value: 'abc' }])
  })

  it('filters out entries with empty key', () => {
    const metadata = [
      { key: '', value: 'val', enabled: true },
      { key: '   ', value: 'val2', enabled: true },
      { key: 'x-valid', value: 'ok', enabled: true },
    ]
    expect(buildGrpcMetadata(metadata, null)).toEqual([{ key: 'x-valid', value: 'ok' }])
  })

  it('interpolates key and value with environment variables', () => {
    const metadata = [{ key: 'authorization', value: 'Bearer {{token}}', enabled: true }]
    expect(buildGrpcMetadata(metadata, testEnv)).toEqual([
      { key: 'authorization', value: 'Bearer secret-token' },
    ])
  })

  it('handles multiple valid entries', () => {
    const metadata = [
      { key: 'x-request-id', value: '123', enabled: true },
      { key: 'x-tenant', value: 'acme', enabled: true },
    ]
    expect(buildGrpcMetadata(metadata, null)).toEqual([
      { key: 'x-request-id', value: '123' },
      { key: 'x-tenant', value: 'acme' },
    ])
  })
})

// ─── validateGrpcConfig ───────────────────────────────────────────────────────

describe('validateGrpcConfig', () => {
  it('returns null for a valid config', () => {
    expect(validateGrpcConfig(baseGrpcConfig)).toBeNull()
  })

  it('returns error when proto is empty', () => {
    const config = { ...baseGrpcConfig, proto: '' }
    expect(validateGrpcConfig(config)).toBe('Proto definition is empty')
  })

  it('returns error when proto is only whitespace', () => {
    const config = { ...baseGrpcConfig, proto: '   ' }
    expect(validateGrpcConfig(config)).toBe('Proto definition is empty')
  })

  it('returns error when service is empty', () => {
    const config = { ...baseGrpcConfig, service: '' }
    expect(validateGrpcConfig(config)).toBe('Service name is required')
  })

  it('returns error when method is empty', () => {
    const config = { ...baseGrpcConfig, method: '' }
    expect(validateGrpcConfig(config)).toBe('Method name is required')
  })

  it('proto error takes priority over service/method errors', () => {
    const config = { ...baseGrpcConfig, proto: '', service: '', method: '' }
    expect(validateGrpcConfig(config)).toBe('Proto definition is empty')
  })
})

// ─── resolveService ───────────────────────────────────────────────────────────

describe('resolveService', () => {
  class MockService {}

  const descriptor = {
    hello: {
      Greeter: MockService,
      NotAService: 'string-not-a-class',
    },
    TopLevel: MockService,
  }

  it('resolves a package-qualified service name', () => {
    expect(resolveService(descriptor as any, 'hello.Greeter')).toBe(MockService)
  })

  it('resolves a top-level service name (no package)', () => {
    expect(resolveService(descriptor as any, 'TopLevel')).toBe(MockService)
  })

  it('returns null for unknown service', () => {
    expect(resolveService(descriptor as any, 'hello.Unknown')).toBeNull()
  })

  it('returns null when intermediate package does not exist', () => {
    expect(resolveService(descriptor as any, 'pkg.does.not.Exist')).toBeNull()
  })

  it('returns null when resolved value is not a function', () => {
    expect(resolveService(descriptor as any, 'hello.NotAService')).toBeNull()
  })

  it('returns null for empty descriptor', () => {
    expect(resolveService({}, 'hello.Greeter')).toBeNull()
  })
})
