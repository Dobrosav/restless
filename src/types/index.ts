export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'WS' | 'GRAPHQL'

export interface KeyValue {
  key: string
  value: string
  enabled: boolean
}

export interface RequestBody {
  type: 'none' | 'json' | 'text' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'graphql'
  content: string
  graphql?: {
    query: string
    variables: string
  }
}

export interface Auth {
  type: 'none' | 'basic' | 'bearer' | 'api-key'
  basic?: { username: string; password: string }
  bearer?: { token: string }
  apiKey?: { key: string; value: string; in: 'header' | 'query' }
}

export interface RequestScript {
  pre: string
  post: string
}

export interface ApiRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: RequestBody
  auth: Auth
  script: RequestScript
  path?: string
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
  type: 'http' | 'websocket' | 'graphql'
  wsMessages?: string[]
}

export interface Collection {
  id: string
  name: string
  path: string
  requests: ApiRequest[]
  environments?: Environment[]
  activeEnvironmentId?: string
}

export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
}

export interface Workspace {
  path: string
  collections: Collection[]
}
