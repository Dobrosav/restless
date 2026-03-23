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
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2'
  basic?: { username: string; password: string }
  bearer?: { token: string }
  apiKey?: { key: string; value: string; in: 'header' | 'query' }
  oauth2?: {
    grantType: 'client_credentials' | 'password' | 'refresh_token'
    tokenUrl: string
    clientId: string
    clientSecret: string
    scope: string
    username?: string
    password?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    autoRefresh: boolean
  }
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
  oauth2?: {
    accessToken: string
    refreshToken?: string
    expiresAt: number
  }
}

export interface SavedOAuth2Token {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenType: string
  createdAt: number
}

export interface Collection {
  id: string
  name: string
  path: string
  requests: ApiRequest[]
  environments?: Environment[]
  activeEnvironmentId?: string
  savedTokens?: Record<string, SavedOAuth2Token>
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
