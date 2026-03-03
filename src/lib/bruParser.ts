import { ApiRequest, HttpMethod } from '../types'

export interface BruFile {
  version: string
  name: string
  type: string
  script: {
    pre: string
    test: string
  }
  request: {
    method: HttpMethod
    url: string
    auth: {
      type: string
      basic?: { username: string; password: string }
      bearer?: { token: string }
      apiKey?: { key: string; value: string; in: 'header' | 'query' }
    }
    header: Array<{ key: string; value: string }>
    query: Array<{ key: string; value: string }>
    body: {
      type: string
      raw?: string
      form?: Array<{ key: string; value: string }>
    }
  }
}

export function requestToBru(request: ApiRequest): string {
  const bru: BruFile = {
    version: '1',
    name: request.name,
    type: 'http',
    script: {
      pre: request.script.pre,
      test: request.script.post,
    },
    request: {
      method: request.method,
      url: request.url,
      auth: {
        type: request.auth.type,
        ...(request.auth.type === 'basic' && { basic: request.auth.basic }),
        ...(request.auth.type === 'bearer' && { bearer: request.auth.bearer }),
        ...(request.auth.type === 'api-key' && { apiKey: request.auth.apiKey }),
      },
      header: request.headers.filter(h => h.enabled && h.key).map(h => ({ key: h.key, value: h.value })),
      query: request.params.filter(p => p.enabled && p.key).map(p => ({ key: p.key, value: p.value })),
      body: {
        type: request.body.type,
        ...(request.body.type !== 'none' && { raw: request.body.content }),
      },
    },
  }

  let content = ''
  content += `version: "${bru.version}"\n`
  content += `name: "${bru.name}"\n`
  content += `type: "${bru.type}"\n`
  content += `\n`
  content += `script:\n`
  content += `  pre: |-\n`
  content += bru.script.pre.split('\n').map(l => '    ' + l).join('\n') + '\n'
  content += `  test: |-\n`
  content += bru.script.test.split('\n').map(l => '    ' + l).join('\n') + '\n'
  content += `\n`
  content += `request:\n`
  content += `  method: ${bru.request.method}\n`
  content += `  url: "${bru.request.url}"\n`
  content += `\n`
  content += `  auth:\n`
  content += `    type: ${bru.request.auth.type}\n`
  if (bru.request.auth.type === 'basic' && bru.request.auth.basic) {
    content += `    basic:\n`
    content += `      username: "${bru.request.auth.basic.username}"\n`
    content += `      password: "${bru.request.auth.basic.password}"\n`
  }
  if (bru.request.auth.type === 'bearer' && bru.request.auth.bearer) {
    content += `    bearer:\n`
    content += `      token: "${bru.request.auth.bearer.token}"\n`
  }
  if (bru.request.auth.type === 'api-key' && bru.request.auth.apiKey) {
    content += `    apiKey:\n`
    content += `      key: "${bru.request.auth.apiKey.key}"\n`
    content += `      value: "${bru.request.auth.apiKey.value}"\n`
    content += `      in: ${bru.request.auth.apiKey.in}\n`
  }
  content += `\n`
  content += `  header:\n`
  for (const h of bru.request.header) {
    content += `    - key: "${h.key}"\n`
    content += `      value: "${h.value}"\n`
  }
  content += `\n`
  content += `  query:\n`
  for (const q of bru.request.query) {
    content += `    - key: "${q.key}"\n`
    content += `      value: "${q.value}"\n`
  }
  content += `\n`
  content += `  body:\n`
  content += `    type: ${bru.request.body.type}\n`
  if (bru.request.body.raw) {
    content += `    raw: |-\n`
    content += bru.request.body.raw.split('\n').map(l => '      ' + l).join('\n') + '\n'
  }

  return content
}

export function bruToRequest(content: string, id: string): ApiRequest {
  const lines = content.split('\n')
  const request: Partial<ApiRequest> = {
    id,
    name: 'Untitled',
    method: 'GET' as HttpMethod,
    url: '',
    params: [],
    headers: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    script: { pre: '', post: '' },
  }

  let inScript = false
  let inAuth = false
  let inHeader = false
  let inQuery = false
  let inBody = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('name:')) {
      request.name = trimmed.replace('name:', '').trim().replace(/^["']|["']$/g, '')
    } else if (trimmed.startsWith('method:')) {
      request.method = trimmed.replace('method:', '').trim().toUpperCase() as HttpMethod
    } else if (trimmed.startsWith('url:')) {
      request.url = trimmed.replace('url:', '').trim().replace(/^["']|["']$/g, '')
    } else if (trimmed === 'script:') {
      inScript = true
    } else if (trimmed === 'auth:') {
      inAuth = true
    } else if (trimmed === 'header:') {
      inHeader = true
      inAuth = false
    } else if (trimmed === 'query:') {
      inQuery = true
      inHeader = false
    } else if (trimmed === 'body:') {
      inBody = true
      inQuery = false
    } else if (inScript && trimmed.startsWith('pre:')) {
      let preLines = ''
      i++
      while (i < lines.length && lines[i].trim().startsWith('    ')) {
        preLines += lines[i].trim().substring(4) + '\n'
        i++
      }
      i--
      request.script = { ...request.script!, pre: preLines.trim() }
    } else if (inScript && trimmed.startsWith('test:')) {
      let testLines = ''
      i++
      while (i < lines.length && lines[i].trim().startsWith('    ')) {
        testLines += lines[i].trim().substring(4) + '\n'
        i++
      }
      i--
      request.script = { ...request.script!, post: testLines.trim() }
    } else if (inAuth && trimmed.startsWith('type:')) {
      const authType = trimmed.replace('type:', '').trim()
      request.auth = { type: authType as any }
    } else if (inAuth && trimmed.startsWith('username:')) {
      if (!request.auth!.basic) request.auth!.basic = { username: '', password: '' }
      request.auth!.basic.username = trimmed.replace('username:', '').trim().replace(/^["']|["']$/g, '')
    } else if (inAuth && trimmed.startsWith('password:')) {
      if (!request.auth!.basic) request.auth!.basic = { username: '', password: '' }
      request.auth!.basic.password = trimmed.replace('password:', '').trim().replace(/^["']|["']$/g, '')
    } else if (inAuth && trimmed.startsWith('token:')) {
      request.auth!.bearer = { token: trimmed.replace('token:', '').trim().replace(/^["']|["']$/g, '') }
    } else if (inAuth && trimmed.startsWith('key:') && !trimmed.startsWith('key:')) {
      if (!request.auth!.apiKey) request.auth!.apiKey = { key: '', value: '', in: 'header' }
      request.auth!.apiKey.key = trimmed.replace('key:', '').trim().replace(/^["']|["']$/g, '')
    } else if (inAuth && trimmed.startsWith('value:')) {
      if (!request.auth!.apiKey) request.auth!.apiKey = { key: '', value: '', in: 'header' }
      request.auth!.apiKey.value = trimmed.replace('value:', '').trim().replace(/^["']|["']$/g, '')
    } else if (inAuth && trimmed.startsWith('in:')) {
      if (!request.auth!.apiKey) request.auth!.apiKey = { key: '', value: '', in: 'header' }
      request.auth!.apiKey.in = trimmed.replace('in:', '').trim() as 'header' | 'query'
    } else if (inHeader && trimmed.startsWith('- key:')) {
      const key = trimmed.replace('- key:', '').trim().replace(/^["']|["']$/g, '')
      let value = ''
      i++
      while (i < lines.length && !lines[i].trim().startsWith('value:')) {
        i++
      }
      if (i < lines.length) {
        value = lines[i].trim().replace('value:', '').trim().replace(/^["']|["']$/g, '')
      }
      request.headers!.push({ key, value, enabled: true })
    } else if (inQuery && trimmed.startsWith('- key:')) {
      const key = trimmed.replace('- key:', '').trim().replace(/^["']|["']$/g, '')
      let value = ''
      i++
      while (i < lines.length && !lines[i].trim().startsWith('value:')) {
        i++
      }
      if (i < lines.length) {
        value = lines[i].trim().replace('value:', '').trim().replace(/^["']|["']$/g, '')
      }
      request.params!.push({ key, value, enabled: true })
    } else if (inBody && trimmed.startsWith('type:')) {
      request.body = { ...request.body!, type: trimmed.replace('type:', '').trim() as any }
    } else if (inBody && trimmed.startsWith('raw:')) {
      let rawLines = ''
      i++
      while (i < lines.length && lines[i].trim().startsWith('    ')) {
        rawLines += lines[i].trim() + '\n'
        i++
      }
      i--
      request.body = { ...request.body!, content: rawLines.trim() }
    }
  }

  return request as ApiRequest
}
