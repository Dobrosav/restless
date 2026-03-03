import simpleGit, { SimpleGit } from 'simple-git'

let git: SimpleGit | null = null

export interface GitStatus {
  isRepo: boolean
  modified: string[]
  added: string[]
  deleted: string[]
  untracked: string[]
  current: string | null
  ahead: number
  behind: number
}

export async function initGit(repoPath: string): Promise<boolean> {
  try {
    git = simpleGit(repoPath)
    const isRepo = await git.checkIsRepo()
    return isRepo
  } catch {
    return false
  }
}

export async function getStatus(): Promise<GitStatus | null> {
  if (!git) return null
  
  try {
    const status = await git.status()
    return {
      isRepo: true,
      modified: status.modified,
      added: status.not_added,
      deleted: status.deleted,
      untracked: status.not_added,
      current: status.current,
      ahead: status.ahead,
      behind: status.behind,
    }
  } catch {
    return null
  }
}

export async function gitAdd(files: string[]): Promise<boolean> {
  if (!git) return false
  
  try {
    await git.add(files)
    return true
  } catch {
    return false
  }
}

export async function gitCommit(message: string): Promise<boolean> {
  if (!git) return false
  
  try {
    await git.commit(message)
    return true
  } catch {
    return false
  }
}

export async function gitPull(): Promise<boolean> {
  if (!git) return false
  
  try {
    await git.pull()
    return true
  } catch {
    return false
  }
}

export async function gitPush(): Promise<boolean> {
  if (!git) return false
  
  try {
    await git.push()
    return true
  } catch {
    return false
  }
}

export async function gitLog(count: number = 10): Promise<any> {
  if (!git) return []
  
  try {
    const log = await git.log({ maxCount: count })
    return [...log.all]
  } catch {
    return []
  }
}

export async function gitDiff(file?: string): Promise<string> {
  if (!git) return ''
  
  try {
    if (file) {
      return await git.diff([file])
    }
    return await git.diff()
  } catch {
    return ''
  }
}
