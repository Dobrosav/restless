import { ApiRequest, HttpMethod, Collection, KeyValue } from '../types'

interface PostmanCollection {
  info: {
    name: string
    schema: string
  }
  item: PostmanItem[]
}

interface PostmanItem {
  name: string
  request?: PostmanRequest
  item?: PostmanItem[]
}

interface PostmanRequest {
  method: string
  header?: Array<{ key: string; value: string; disabled?: boolean }>
  url: string | {
    raw: string
    query?: Array<{ key: string; value: string; disabled?: boolean }>
  }
  body?: {
    mode: string
    raw?: string
    formdata?: Array<{ key: string; value: string; disabled?: boolean }>
    urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>
  }
  auth?: {
    type: string
    basic?: Array<{ key: string; value: string }>
    bearer?: Array<{ key: string; value: string }>
    apikey?: Array<{ key: string; value: string; in?: string }>
  }
}

export function importPostmanCollection(json: string): Collection[] {
  try {
    const postman: PostmanCollection = JSON.parse(json)
    const collections: Collection[] = []

    const parseItem = (item: PostmanItem): ApiRequest | null => {
      if (!item.request) return null

      const req = item.request
      const method = (req.method || 'GET').toUpperCase() as HttpMethod

      let url = ''
      if (typeof req.url === 'string') {
        url = req.url
      } else if (req.url) {
        url = req.url.raw || ''
      }

      const headers: KeyValue[] = (req.header || []).map(h => ({
        key: h.key,
        value: h.value,
        enabled: !h.disabled,
      }))

      let params: KeyValue[] = []
      if (typeof req.url === 'object' && req.url.query) {
        params = req.url.query.map(p => ({
          key: p.key,
          value: p.value,
          enabled: !p.disabled,
        }))
      }

      let bodyType: 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded' = 'none'
      let bodyContent = ''

      if (req.body) {
        if (req.body.mode === 'raw') {
          bodyType = 'text'
          bodyContent = req.body.raw || ''
          if (req.body.raw && (req.body.raw.startsWith('{') || req.body.raw.startsWith('['))) {
            bodyType = 'json'
          }
        } else if (req.body.mode === 'formdata' && req.body.formdata) {
          bodyType = 'form-data'
          bodyContent = JSON.stringify(
            req.body.formdata.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {})
          )
        } else if (req.body.mode === 'urlencoded' && req.body.urlencoded) {
          bodyType = 'x-www-form-urlencoded'
          bodyContent = JSON.stringify(
            req.body.urlencoded.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {})
          )
        }
      }

      let auth: ApiRequest['auth'] = { type: 'none' }
      if (req.auth) {
        if (req.auth.type === 'basic') {
          const username = req.auth.basic?.find(k => k.key === 'username')?.value || ''
          const password = req.auth.basic?.find(k => k.key === 'password')?.value || ''
          auth = { type: 'basic', basic: { username, password } }
        } else if (req.auth.type === 'bearer') {
          const token = req.auth.bearer?.find(k => k.key === 'token')?.value || ''
          auth = { type: 'bearer', bearer: { token } }
        } else if (req.auth.type === 'apikey') {
          const key = req.auth.apikey?.find(k => k.key === 'key')?.value || ''
          const value = req.auth.apikey?.find(k => k.key === 'value')?.value || ''
          const inHeader = req.auth.apikey?.find(k => k.in === 'header')?.in || 'query'
          auth = { type: 'api-key', apiKey: { key, value, in: inHeader as 'header' | 'query' } }
        }
      }

      return {
        id: crypto.randomUUID(),
        name: item.name,
        method,
        url,
        params,
        headers,
        body: { type: bodyType, content: bodyContent },
        auth,
        script: { pre: '', post: '' },
      }
    }

    const parseFolder = (items: PostmanItem[], _folderName: string): ApiRequest[] => {
      const requests: ApiRequest[] = []
      for (const item of items) {
        if (item.item) {
          requests.push(...parseFolder(item.item, item.name))
        } else if (item.request) {
          const req = parseItem(item)
          if (req) requests.push(req)
        }
      }
      return requests
    }

    if (postman.info && postman.item) {
      const collectionName = postman.info.name || 'Imported'
      const requests = parseFolder(postman.item, collectionName)

      collections.push({
        id: crypto.randomUUID(),
        name: collectionName,
        path: '',
        requests,
      })
    }

    return collections
  } catch (error) {
    console.error('Failed to parse Postman collection:', error)
    return []
  }
}

export function exportToPostman(collection: Collection): string {
  const postmanCollection: PostmanCollection = {
    info: {
      name: collection.name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: collection.requests.map(req => {
      const request: PostmanRequest = {
        method: req.method,
        url: req.url,
        header: req.headers.filter(h => h.enabled && h.key).map(h => ({
          key: h.key,
          value: h.value,
        })),
      }

      request.url = {
        raw: req.url,
        query: req.params.filter(p => p.enabled && p.key).map(p => ({
          key: p.key,
          value: p.value,
        })),
      }

      if (req.body.type !== 'none' && req.body.content) {
        const body: PostmanRequest['body'] = {
          mode: req.body.type === 'form-data' ? 'formdata' : req.body.type === 'x-www-form-urlencoded' ? 'urlencoded' : 'raw',
        }

        if (req.body.type === 'json' || req.body.type === 'text') {
          body.raw = req.body.content
        } else if (req.body.type === 'form-data') {
          try {
            const obj = JSON.parse(req.body.content)
            body.formdata = Object.entries(obj).map(([key, value]) => ({
              key,
              value: value as string,
            }))
          } catch {
            body.formdata = []
          }
        } else if (req.body.type === 'x-www-form-urlencoded') {
          try {
            const obj = JSON.parse(req.body.content)
            body.urlencoded = Object.entries(obj).map(([key, value]) => ({
              key,
              value: value as string,
            }))
          } catch {
            body.urlencoded = []
          }
        }

        request.body = body
      }

      if (req.auth.type !== 'none') {
        request.auth = { type: req.auth.type }

        if (req.auth.type === 'basic' && req.auth.basic) {
          request.auth.basic = [
            { key: 'username', value: req.auth.basic.username },
            { key: 'password', value: req.auth.basic.password },
          ]
        } else if (req.auth.type === 'bearer' && req.auth.bearer) {
          request.auth.bearer = [
            { key: 'token', value: req.auth.bearer.token },
          ]
        } else if (req.auth.type === 'api-key' && req.auth.apiKey) {
          request.auth.apikey = [
            { key: 'key', value: req.auth.apiKey.key },
            { key: 'value', value: req.auth.apiKey.value },
            { key: 'in', value: req.auth.apiKey.in },
          ]
        }
      }

      return { name: req.name, request }
    }),
  }

  return JSON.stringify(postmanCollection, null, 2)
}
