import { contextBridge, ipcRenderer } from 'electron'

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

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  getDefaultWorkspace: () => ipcRenderer.invoke('dialog:getDefaultWorkspace'),
  openWorkspace: () => ipcRenderer.invoke('dialog:openWorkspace'),
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath) as Promise<FileItem[]>,
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath) as Promise<string | null>,
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content) as Promise<boolean>,
  exists: (filePath: string) => ipcRenderer.invoke('fs:exists', filePath) as Promise<boolean>,
  mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath) as Promise<boolean>,
  delete: (filePath: string) => ipcRenderer.invoke('fs:delete', filePath) as Promise<boolean>,
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath) as Promise<boolean>,
  gitInit: (repoPath: string) => ipcRenderer.invoke('git:init', repoPath) as Promise<boolean>,
  gitStatus: () => ipcRenderer.invoke('git:status') as Promise<GitStatus | null>,
  gitAdd: (files: string[]) => ipcRenderer.invoke('git:add', files) as Promise<boolean>,
  gitCommit: (message: string) => ipcRenderer.invoke('git:commit', message) as Promise<boolean>,
  gitPull: () => ipcRenderer.invoke('git:pull') as Promise<{ success: boolean; error?: string }>,
  gitPush: () => ipcRenderer.invoke('git:push') as Promise<{ success: boolean; error?: string }>,
  gitLog: (count?: number) => ipcRenderer.invoke('git:log', count) as Promise<GitLog[]>,
  gitDiff: (file?: string) => ipcRenderer.invoke('git:diff', file) as Promise<string>,
  gitGetConfig: () => ipcRenderer.invoke('git:getConfig') as Promise<{ userName: string; userEmail: string }>,
  gitSetConfig: (config: { userName: string; userEmail: string }) => ipcRenderer.invoke('git:setConfig', config) as Promise<boolean>,
  gitIsConfigSet: () => ipcRenderer.invoke('git:isConfigSet') as Promise<boolean>,
  gitSetRemote: (remoteUrl: string) => ipcRenderer.invoke('git:setRemote', remoteUrl) as Promise<boolean>,
  gitGetRemote: () => ipcRenderer.invoke('git:getRemote') as Promise<string>,
  gitListBranches: () => ipcRenderer.invoke('git:listBranches') as Promise<{ local: string[]; remote: string[]; current: string }>,
  gitCheckout: (branchName: string) => ipcRenderer.invoke('git:checkout', branchName) as Promise<{ success: boolean; error?: string }>,
  gitCreateBranch: (branchName: string) => ipcRenderer.invoke('git:createBranch', branchName) as Promise<{ success: boolean; error?: string }>,
  postmanImport: (collectionPath: string, postmanJson: string) => ipcRenderer.invoke('postman:import', collectionPath, postmanJson) as Promise<{ success: boolean; collectionDir?: string; collectionName?: string; error?: string }>,
  httpSendRequest: (request: any, environment: any) => ipcRenderer.invoke('http:sendRequest', request, environment) as Promise<any>,
  httpCancelRequest: () => ipcRenderer.invoke('http:cancelRequest') as Promise<void>,
})
