import { describe, it, expect, vi } from 'vitest'
import { importPostmanCollection, exportToPostman } from './postmanImport'
import { ApiRequest, Collection } from '../types'

// Mock crypto.randomUUID since it's used in import
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
})

describe('importPostmanCollection', () => {
  it('should import a simple Postman collection', () => {
    const postman = {
      info: {
        name: 'My API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [
        {
          name: 'Get Users',
          request: {
            method: 'GET',
            url: 'https://api.example.com/users',
          }
        }
      ]
    }

    const result = importPostmanCollection(JSON.stringify(postman))
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('My API')
    expect(result[0].requests).toHaveLength(1)
    expect(result[0].requests[0].name).toBe('Get Users')
    expect(result[0].requests[0].method).toBe('GET')
    expect(result[0].requests[0].url).toBe('https://api.example.com/users')
  })

  it('should handle string URL format', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Test',
        request: { method: 'POST', url: 'https://example.com/api' }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    expect(result[0].requests[0].url).toBe('https://example.com/api')
  })

  it('should handle object URL format with query params', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Search',
        request: {
          method: 'GET',
          url: {
            raw: 'https://api.example.com/search',
            query: [
              { key: 'q', value: 'test' },
              { key: 'limit', value: '10', disabled: true },
            ]
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.url).toBe('https://api.example.com/search')
    expect(req.params).toHaveLength(2)
    expect(req.params[0]).toEqual({ key: 'q', value: 'test', enabled: true })
    expect(req.params[1]).toEqual({ key: 'limit', value: '10', enabled: false })
  })

  it('should parse headers', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Test',
        request: {
          method: 'GET',
          url: 'https://example.com',
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Disabled', value: 'skip', disabled: true },
          ]
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.headers).toHaveLength(2)
    expect(req.headers[0]).toEqual({ key: 'Content-Type', value: 'application/json', enabled: true })
    expect(req.headers[1]).toEqual({ key: 'X-Disabled', value: 'skip', enabled: false })
  })

  it('should parse raw JSON body', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Create',
        request: {
          method: 'POST',
          url: 'https://example.com/create',
          body: {
            mode: 'raw',
            raw: '{"name": "test"}'
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.body.type).toBe('json')
    expect(req.body.content).toBe('{"name": "test"}')
  })

  it('should parse raw text body', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Send Text',
        request: {
          method: 'POST',
          url: 'https://example.com',
          body: {
            mode: 'raw',
            raw: 'plain text content'
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.body.type).toBe('text')
    expect(req.body.content).toBe('plain text content')
  })

  it('should parse formdata body', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Upload',
        request: {
          method: 'POST',
          url: 'https://example.com/upload',
          body: {
            mode: 'formdata',
            formdata: [
              { key: 'file', value: 'data' },
              { key: 'name', value: 'test' },
            ]
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.body.type).toBe('form-data')
    const parsed = JSON.parse(req.body.content)
    expect(parsed.file).toBe('data')
    expect(parsed.name).toBe('test')
  })

  it('should parse urlencoded body', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Form',
        request: {
          method: 'POST',
          url: 'https://example.com/form',
          body: {
            mode: 'urlencoded',
            urlencoded: [
              { key: 'username', value: 'admin' },
              { key: 'password', value: 'secret' },
            ]
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.body.type).toBe('x-www-form-urlencoded')
    const parsed = JSON.parse(req.body.content)
    expect(parsed.username).toBe('admin')
    expect(parsed.password).toBe('secret')
  })

  it('should parse basic auth', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Auth Test',
        request: {
          method: 'GET',
          url: 'https://example.com',
          auth: {
            type: 'basic',
            basic: [
              { key: 'username', value: 'admin' },
              { key: 'password', value: 's3cret' },
            ]
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.auth.type).toBe('basic')
    expect(req.auth.basic?.username).toBe('admin')
    expect(req.auth.basic?.password).toBe('s3cret')
  })

  it('should parse bearer auth', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'Bearer Test',
        request: {
          method: 'GET',
          url: 'https://example.com',
          auth: {
            type: 'bearer',
            bearer: [
              { key: 'token', value: 'my-jwt-token' },
            ]
          }
        }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    const req = result[0].requests[0]
    expect(req.auth.type).toBe('bearer')
    expect(req.auth.bearer?.token).toBe('my-jwt-token')
  })

  it('should parse nested folders', () => {
    const postman = {
      info: { name: 'Nested API', schema: '' },
      item: [
        {
          name: 'Users Folder',
          item: [
            {
              name: 'Get User',
              request: { method: 'GET', url: 'https://example.com/users/1' }
            },
            {
              name: 'Posts Folder',
              item: [
                {
                  name: 'Get Posts',
                  request: { method: 'GET', url: 'https://example.com/posts' }
                }
              ]
            }
          ]
        }
      ]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    expect(result[0].requests).toHaveLength(2)
    expect(result[0].requests[0].name).toBe('Get User')
    expect(result[0].requests[1].name).toBe('Get Posts')
  })

  it('should skip items without request', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [
        { name: 'Folder Only' },
        { name: 'Real Request', request: { method: 'GET', url: 'https://example.com' } },
      ]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    expect(result[0].requests).toHaveLength(1)
    expect(result[0].requests[0].name).toBe('Real Request')
  })

  it('should return empty array for invalid JSON', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = importPostmanCollection('not valid json')
    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should handle missing info/item gracefully', () => {
    const result = importPostmanCollection(JSON.stringify({ foo: 'bar' }))
    expect(result).toEqual([])
  })

  it('should default method to GET when missing', () => {
    const postman = {
      info: { name: 'Test', schema: '' },
      item: [{
        name: 'No Method',
        request: { url: 'https://example.com' }
      }]
    }
    const result = importPostmanCollection(JSON.stringify(postman))
    expect(result[0].requests[0].method).toBe('GET')
  })
})

describe('exportToPostman', () => {
  const baseReq: ApiRequest = {
    id: '1',
    name: 'Test Request',
    method: 'GET',
    url: 'https://api.example.com/data',
    headers: [],
    params: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    script: { pre: '', post: '' }
  }

  it('should export a basic collection', () => {
    const collection: Collection = {
      id: '1',
      name: 'My API',
      path: '',
      requests: [baseReq],
      collections: [],
    }
    const json = exportToPostman(collection)
    const parsed = JSON.parse(json)

    expect(parsed.info.name).toBe('My API')
    expect(parsed.info.schema).toContain('postman')
    expect(parsed.item).toHaveLength(1)
    expect(parsed.item[0].name).toBe('Test Request')
    expect(parsed.item[0].request.method).toBe('GET')
  })

  it('should export headers (only enabled with key)', () => {
    const req: ApiRequest = {
      ...baseReq,
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'X-Disabled', value: 'skip', enabled: false },
        { key: '', value: 'empty-key', enabled: true },
      ]
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.header).toHaveLength(1)
    expect(parsed.item[0].request.header[0].key).toBe('Accept')
  })

  it('should export query params', () => {
    const req: ApiRequest = {
      ...baseReq,
      params: [
        { key: 'q', value: 'test', enabled: true },
        { key: 'skip', value: 'me', enabled: false },
      ]
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.url.query).toHaveLength(1)
    expect(parsed.item[0].request.url.query[0].key).toBe('q')
  })

  it('should export JSON body', () => {
    const req: ApiRequest = {
      ...baseReq,
      method: 'POST',
      body: { type: 'json', content: '{"key":"value"}' },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.body.mode).toBe('raw')
    expect(parsed.item[0].request.body.raw).toBe('{"key":"value"}')
  })

  it('should export form-data body', () => {
    const req: ApiRequest = {
      ...baseReq,
      method: 'POST',
      body: { type: 'form-data', content: '{"file":"data","name":"test"}' },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.body.mode).toBe('formdata')
    expect(parsed.item[0].request.body.formdata).toHaveLength(2)
  })

  it('should export urlencoded body', () => {
    const req: ApiRequest = {
      ...baseReq,
      method: 'POST',
      body: { type: 'x-www-form-urlencoded', content: '{"user":"admin"}' },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.body.mode).toBe('urlencoded')
    expect(parsed.item[0].request.body.urlencoded).toHaveLength(1)
  })

  it('should handle invalid JSON in form-data body gracefully', () => {
    const req: ApiRequest = {
      ...baseReq,
      method: 'POST',
      body: { type: 'form-data', content: 'not json' },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.body.formdata).toEqual([])
  })

  it('should export basic auth', () => {
    const req: ApiRequest = {
      ...baseReq,
      auth: { type: 'basic', basic: { username: 'admin', password: 'pass' } },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.auth.type).toBe('basic')
    expect(parsed.item[0].request.auth.basic).toContainEqual({ key: 'username', value: 'admin' })
    expect(parsed.item[0].request.auth.basic).toContainEqual({ key: 'password', value: 'pass' })
  })

  it('should export bearer auth', () => {
    const req: ApiRequest = {
      ...baseReq,
      auth: { type: 'bearer', bearer: { token: 'my-token' } },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.auth.type).toBe('bearer')
    expect(parsed.item[0].request.auth.bearer).toContainEqual({ key: 'token', value: 'my-token' })
  })

  it('should export api-key auth', () => {
    const req: ApiRequest = {
      ...baseReq,
      auth: { type: 'api-key', apiKey: { key: 'X-API-Key', value: 'abc', in: 'header' } },
    }
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [req], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.auth.type).toBe('api-key')
    expect(parsed.item[0].request.auth.apikey).toContainEqual({ key: 'key', value: 'X-API-Key' })
    expect(parsed.item[0].request.auth.apikey).toContainEqual({ key: 'value', value: 'abc' })
  })

  it('should not include auth when type is none', () => {
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [baseReq], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.auth).toBeUndefined()
  })

  it('should export nested sub-collections', () => {
    const subCollection: Collection = {
      id: '2',
      name: 'Sub Folder',
      path: '',
      requests: [{ ...baseReq, name: 'Sub Request' }],
      collections: [],
    }
    const collection: Collection = {
      id: '1', name: 'Parent', path: '',
      requests: [baseReq],
      collections: [subCollection],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    // Sub-collection should be a folder item
    expect(parsed.item).toHaveLength(2) // sub-folder + request
    const folder = parsed.item.find((i: any) => i.item)
    expect(folder).toBeDefined()
    expect(folder.name).toBe('Sub Folder')
    expect(folder.item).toHaveLength(1)
    expect(folder.item[0].name).toBe('Sub Request')
  })

  it('should not include body when type is none', () => {
    const collection: Collection = {
      id: '1', name: 'Test', path: '', requests: [baseReq], collections: [],
    }
    const parsed = JSON.parse(exportToPostman(collection))
    expect(parsed.item[0].request.body).toBeUndefined()
  })
})
