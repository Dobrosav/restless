export interface FileItem {
  name: string
  isDirectory: boolean
  path: string
}

export interface GitStatus {
  modified: string[]
  not_added: string[]
  deleted: string[]
  untracked: string[]
  staged: string[]
  current: string | null
  ahead: number
  behind: number
}

export interface GitLog {
  hash: string
  date: string
  message: string
  author_name: string
  author_email: string
}

export interface PostmanImportResult {
  success: boolean
  collectionDir?: string
  collectionName?: string
  error?: string
}

export interface ElectronAPI {
  openDirectory: () => Promise<string | null>
  getDefaultWorkspace: () => Promise<string>
  openWorkspace: () => Promise<string>
  readDir: (dirPath: string) => Promise<FileItem[]>
  readFile: (filePath: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  exists: (filePath: string) => Promise<boolean>
  mkdir: (dirPath: string) => Promise<boolean>
  delete: (filePath: string) => Promise<boolean>
  rename: (oldPath: string, newPath: string) => Promise<boolean>
  gitInit: (repoPath: string) => Promise<boolean>
  gitStatus: () => Promise<GitStatus | null>
  gitAdd: (files: string[]) => Promise<boolean>
  gitCommit: (message: string) => Promise<boolean>
  gitPull: () => Promise<{ success: boolean; error?: string }>
  gitPush: () => Promise<{ success: boolean; error?: string }>
  gitLog: (count?: number) => Promise<GitLog[]>
  gitDiff: (file?: string) => Promise<string>
  gitGetConfig: () => Promise<{ userName: string; userEmail: string }>
  gitSetConfig: (config: { userName: string; userEmail: string }) => Promise<boolean>
  gitIsConfigSet: () => Promise<boolean>
  gitSetRemote: (remoteUrl: string) => Promise<boolean>
  gitGetRemote: () => Promise<string>
  gitListBranches: () => Promise<{ local: string[]; remote: string[]; current: string }>
  gitCheckout: (branchName: string) => Promise<{ success: boolean; error?: string }>
  gitCreateBranch: (branchName: string) => Promise<{ success: boolean; error?: string }>
  postmanImport: (collectionPath: string, postmanJson: string) => Promise<PostmanImportResult>
  httpSendRequest: (request: any, environment: any) => Promise<any>
  httpCancelRequest: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
