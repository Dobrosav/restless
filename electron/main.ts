import { app, BrowserWindow, ipcMain, dialog, nativeImage, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import simpleGit, { SimpleGit } from 'simple-git'
import axios from 'axios'
import { autoUpdater } from 'electron-updater'

interface Config {
  gitUserName: string
  gitUserEmail: string
  gitRemoteUrl: string
}

function getConfigPath(): string {
  try {
    return path.join(app.getPath('userData'), 'config.json')
  } catch (e) {
    return path.join(process.env.HOME || '/tmp', '.config', 'api-client', 'config.json')
  }
}

function loadConfig(): Config {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (e) {
    console.error('Failed to load config:', e)
  }
  return { gitUserName: '', gitUserEmail: '', gitRemoteUrl: '' }
}

function saveConfig(config: Config): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
}

let config: Config | null = null

function getConfig(): Config {
  if (!config) {
    config = loadConfig()
  }
  return config
}

let mainWindow: BrowserWindow | null = null
let git: SimpleGit | null = null
let currentRepoPath: string | null = null
let workspacePath: string = ''

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function getWorkspacePath(): string {
  if (workspacePath) return workspacePath
  
  const userDataPath = app.getPath('userData')
  workspacePath = path.join(userDataPath, 'collections')
  
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true })
  }
  
  return workspacePath
}

function createWindow() {
  Menu.setApplicationMenu(null)
  
  // Try multiple icon paths - prioritize .ico on Windows
  const possibleIconPaths = isDev
    ? [
        path.join(__dirname, '../public/logo.png'),
        path.join(__dirname, '../public/logo.ico'),
      ]
    : [
        path.join(process.resourcesPath, 'logo.png'),
        path.join(process.resourcesPath, 'logo.ico'),
      ]

  let appIcon: Electron.NativeImage | undefined
  for (const iconPath of possibleIconPaths) {
    if (fs.existsSync(iconPath)) {
      try {
        appIcon = nativeImage.createFromPath(iconPath)
        if (!appIcon.isEmpty()) {
          break
        }
      } catch (error) {
        console.error('Error loading icon:', error)
      }
    }
  }

  mainWindow = new BrowserWindow({
    title: 'Restless',
    icon: appIcon,
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (appIcon && !appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupAutoUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', async (info) => {
    console.log('Update available:', info.version);
    const response = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: 'Would you like to download and install the update?',
      buttons: ['Download & Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available. Current version is latest:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    console.log('Update downloaded:', info.version);
    const response = await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the application to apply the update.',
      buttons: ['Restart & Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdates();
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
  setupAutoUpdater();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:getDefaultWorkspace', async () => {
  return getWorkspacePath()
})

ipcMain.handle('dialog:openWorkspace', async () => {
  return getWorkspacePath()
})

ipcMain.handle('fs:readDir', async (_, dirPath: string) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name),
    }))
  } catch (error) {
    return []
  }
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    return null
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('fs:exists', async (_, filePath: string) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('fs:delete', async (_, filePath: string) => {
  try {
    fs.rmSync(filePath, { recursive: true })
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  try {
    fs.renameSync(oldPath, newPath)
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('postman:import', async (_, collectionPath: string, postmanJsonString: string) => {
  try {
    // Parse Postman collection
    const postman = JSON.parse(postmanJsonString)
    const collectionName = postman.info?.name || 'Imported Collection'
    const collectionDir = path.join(collectionPath, collectionName.replace(/[^a-zA-Z0-9]/g, '_'))
    
    // Create collection directory
    fs.mkdirSync(collectionDir, { recursive: true })
    
    // Helper function to save requests recursively
    const saveRequests = (items: any[], folderPath: string, baseFolderName: string = '') => {
      for (const item of items || []) {
        if (item.item && Array.isArray(item.item)) {
          // It's a folder
          const folderDir = path.join(folderPath, item.name.replace(/[^a-zA-Z0-9]/g, '_'))
          fs.mkdirSync(folderDir, { recursive: true })
          saveRequests(item.item, folderDir, item.name)
        } else if (item.request) {
          // It's a request
          const req = item.request
          const method = (req.method || 'GET').toUpperCase()
          
          let url = ''
          if (typeof req.url === 'string') {
            url = req.url
          } else if (req.url) {
            url = req.url.raw || ''
          }
          
          const headers = (req.header || []).map((h: any) => ({
            key: h.key,
            value: h.value,
            enabled: !h.disabled,
          }))
          
          let params: any[] = []
          if (typeof req.url === 'object' && req.url.query) {
            params = req.url.query.map((p: any) => ({
              key: p.key,
              value: p.value,
              enabled: !p.disabled,
            }))
          }
          
          let bodyType: string = 'none'
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
                req.body.formdata.reduce((acc: any, f: any) => ({ ...acc, [f.key]: f.value }), {})
              )
            } else if (req.body.mode === 'urlencoded' && req.body.urlencoded) {
              bodyType = 'x-www-form-urlencoded'
              bodyContent = JSON.stringify(
                req.body.urlencoded.reduce((acc: any, f: any) => ({ ...acc, [f.key]: f.value }), {})
              )
            }
          }
          
          let auth: any = { type: 'none' }
          if (req.auth) {
            if (req.auth.type === 'basic') {
              const username = req.auth.basic?.find((k: any) => k.key === 'username')?.value || ''
              const password = req.auth.basic?.find((k: any) => k.key === 'password')?.value || ''
              auth = { type: 'basic', basic: { username, password } }
            } else if (req.auth.type === 'bearer') {
              const token = req.auth.bearer?.find((k: any) => k.key === 'token')?.value || ''
              auth = { type: 'bearer', bearer: { token } }
            } else if (req.auth.type === 'apikey') {
              const key = req.auth.apikey?.find((k: any) => k.key === 'key')?.value || ''
              const value = req.auth.apikey?.find((k: any) => k.key === 'value')?.value || ''
              const inLocation = req.auth.apikey?.find((k: any) => k.in === 'header')?.in || 'query'
              auth = { type: 'api-key', apiKey: { key, value, in: inLocation } }
            }
          }
          
          const requestObj = {
            id: randomUUID(),
            name: item.name,
            method,
            url,
            params,
            headers,
            body: { type: bodyType, content: bodyContent },
            auth,
            script: { pre: '', post: '' },
          }
          
          // Save request to file
          const fileName = `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`
          const filePath = path.join(folderPath, fileName)
          fs.writeFileSync(filePath, JSON.stringify(requestObj, null, 2))
        }
      }
    }
    
    // Save all requests
    saveRequests(postman.item || [], collectionDir)
    
    // Stage changes with git add . (non-blocking)
    if (git && currentRepoPath) {
      try {
        await git.add(['.'])
      } catch (gitError) {
        console.warn('Failed to auto-stage postman import:', gitError)
      }
    }
    
    return {
      success: true,
      collectionDir,
      collectionName,
    }
  } catch (error) {
    console.error('Failed to import Postman collection:', error)
    return {
      success: false,
      error: String(error),
    }
  }
})

ipcMain.handle('git:init', async (_, repoPath: string) => {
  try {
    git = simpleGit(repoPath)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      await git.init()
    }
    const userName = getConfig().gitUserName || 'Restless User'
    const userEmail = getConfig().gitUserEmail || 'api-client@local'
    await git.addConfig('user.email', userEmail)
    await git.addConfig('user.name', userName)
    currentRepoPath = repoPath
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('git:getConfig', async () => {
  try {
    const cfg = getConfig()
    return {
      userName: cfg.gitUserName,
      userEmail: cfg.gitUserEmail
    }
  } catch (error) {
    console.error('Error getting config:', error)
    return { userName: '', userEmail: '' }
  }
})

ipcMain.handle('git:setConfig', async (_, newConfig: { userName?: string; userEmail?: string; gitUserName?: string; gitUserEmail?: string }) => {
  try {
    const currentConfig = getConfig()
    const updatedConfig: Config = {
      gitUserName: newConfig.gitUserName || newConfig.userName || currentConfig.gitUserName,
      gitUserEmail: newConfig.gitUserEmail || newConfig.userEmail || currentConfig.gitUserEmail,
      gitRemoteUrl: currentConfig.gitRemoteUrl
    }
    config = updatedConfig
    saveConfig(config)
    if (git) {
      await git.addConfig('user.email', updatedConfig.gitUserEmail)
      await git.addConfig('user.name', updatedConfig.gitUserName)
    }
    return true
  } catch (error) {
    console.error('Error setting config:', error)
    return false
  }
})

ipcMain.handle('git:isConfigSet', async () => {
  try {
    const cfg = getConfig()
    return !!(cfg.gitUserName && cfg.gitUserEmail)
  } catch (error) {
    console.error('Error checking config:', error)
    return false
  }
})

ipcMain.handle('git:setRemote', async (_, remoteUrl: string) => {
  try {
    // Trim and validate URL
    const cleanUrl = remoteUrl.trim()
    console.log('Setting remote URL, raw:', JSON.stringify(remoteUrl))
    console.log('Setting remote URL, trimmed:', JSON.stringify(cleanUrl))
    
    if (!cleanUrl) {
      console.log('Empty URL provided')
      return false
    }
    
    config = { ...getConfig(), gitRemoteUrl: cleanUrl }
    console.log('Saving config with URL:', JSON.stringify(cleanUrl))
    saveConfig(config)
    
    if (git) {
      try {
        const remotes = await git.getRemotes()
        console.log('Current remotes:', remotes)
        const hasOrigin = remotes.some(r => r.name === 'origin')
        
        if (hasOrigin) {
          console.log('Setting remote URL:', JSON.stringify(cleanUrl))
          await git.remote(['set-url', 'origin', cleanUrl])
        } else {
          console.log('Adding remote origin:', JSON.stringify(cleanUrl))
          await git.remote(['add', 'origin', cleanUrl])
        }
      } catch (gitError) {
        console.error('Git remote error:', gitError)
        // Continue anyway, the URL is saved in config
      }
    }
    console.log('Remote set successfully')
    return true
  } catch (error) {
    console.error('Error setting remote:', error)
    return false
  }
})

ipcMain.handle('git:getRemote', async () => {
  try {
    return getConfig().gitRemoteUrl
  } catch (error) {
    console.error('Error getting remote:', error)
    return ''
  }
})

ipcMain.handle('git:status', async () => {
  if (!git) return null
  try {
    const status = await git.status()
    return {
      modified: status.modified,
      not_added: status.not_added,
      deleted: status.deleted,
      untracked: status.not_added,
      staged: status.staged || [],
      current: status.current,
      ahead: status.ahead,
      behind: status.behind,
    }
  } catch (error) {
    return null
  }
})

ipcMain.handle('git:add', async (_, files: string[]) => {
  if (!git) return false
  try {
    await git.add(files)
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('git:commit', async (_, message: string) => {
  if (!git) return false
  try {
    await git.commit(message)
    return true
  } catch (error) {
    return false
  }
})

ipcMain.handle('git:pull', async () => {
  if (!git) return { success: false, error: 'Git not initialized' }
  try {
    const remoteUrl = getConfig().gitRemoteUrl
    if (!remoteUrl) {
      return { success: false, error: 'No remote URL configured' }
    }
    console.log('Pulling from remote:', remoteUrl)
    
    // Get current branch
    const status = await git.status()
    const currentBranch = status.current || 'main'
    
    console.log('Current branch:', currentBranch)
    const pullResult = await git.pull('origin', currentBranch)
    console.log('Pull result:', pullResult)
    return { success: true }
  } catch (error: any) {
    console.error('Pull error:', error.message, error.stderr || '', error.stdout || '')
    return { success: false, error: error.message || 'Pull failed' }
  }
})

ipcMain.handle('git:push', async () => {
  if (!git) return { success: false, error: 'Git not initialized' }
  try {
    const remoteUrl = getConfig().gitRemoteUrl
    if (!remoteUrl) {
      return { success: false, error: 'No remote URL configured' }
    }
    console.log('Pushing to remote:', remoteUrl)
    
    // Get current branch
    const status = await git.status()
    const currentBranch = status.current || 'main'
    
    console.log('Current branch:', currentBranch)
    // Push with explicit branch
    const pushResult = await git.push('origin', currentBranch)
    console.log('Push result:', pushResult)
    return { success: true }
  } catch (error: any) {
    console.error('Push error:', error.message, error.stderr || '', error.stdout || '')
    return { success: false, error: error.message || 'Push failed' }
  }
})

ipcMain.handle('git:log', async (_, count: number = 10) => {
  if (!git) return []
  try {
    const log = await git.log({ maxCount: count })
    return log.all
  } catch (error) {
    return []
  }
})

ipcMain.handle('git:diff', async (_, file?: string) => {
  if (!git) return ''
  try {
    if (file) {
      return await git.diff([file])
    }
    return await git.diff()
  } catch (error) {
    return ''
  }
})

ipcMain.handle('git:listBranches', async () => {
  if (!git) return { local: [], remote: [], current: 'master' }
  try {
    const branches = await git.branch()
    return {
      local: branches.all || [],
      remote: [],
      current: branches.current || 'master'
    }
  } catch (error) {
    console.error('Error listing branches:', error)
    return { local: [], remote: [], current: 'master' }
  }
})

ipcMain.handle('git:checkout', async (_, branchName: string) => {
  if (!git) return { success: false, error: 'Git not initialized' }
  try {
    console.log('Checking out branch:', branchName)
    await git.checkout(branchName)
    return { success: true }
  } catch (error: any) {
    console.error('Checkout error:', error)
    return { success: false, error: error.message || 'Checkout failed' }
  }
})

ipcMain.handle('git:createBranch', async (_, branchName: string) => {
  if (!git) return { success: false, error: 'Git not initialized' }
  try {
    console.log('Creating branch:', branchName)
    await git.checkoutLocalBranch(branchName)
    return { success: true }
  } catch (error: any) {
    console.error('Create branch error:', error)
    return { success: false, error: error.message || 'Create branch failed' }
  }
})

// Helper function to interpolate environment variables
function interpolateEnvVariables(text: string, environment: any): string {
  if (!text) return text
  
  // Match both {{var}} and {var}
  return text.replace(/\{\{([^}]+)\}\}|\{([^}]+)\}/g, (match, keyDouble, keySingle) => {
    const key = keyDouble || keySingle;
    
    // 1. Try to find in environment variables
    if (environment && environment.variables) {
      const v = environment.variables.find((v: any) => v.enabled && v.key === key.trim())
      if (v) return v.value
    }
    
    // 2. Unresolved variable
    return match
  })
}

// Helper function to build auth headers
function buildAuthHeaders(request: any, environment: any): Record<string, string> {
  const headers: Record<string, string> = {}
  
  if (request.auth.type === 'basic' && request.auth.basic) {
    const encoded = Buffer.from(`${request.auth.basic.username}:${request.auth.basic.password}`).toString('base64')
    headers['Authorization'] = `Basic ${encoded}`
  } else if (request.auth.type === 'bearer' && request.auth.bearer) {
    headers['Authorization'] = `Bearer ${interpolateEnvVariables(request.auth.bearer.token, environment)}`
  } else if (request.auth.type === 'api-key' && request.auth.apiKey) {
    if (request.auth.apiKey.in === 'header') {
      headers[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment)
    }
  }
  
  return headers
}

// Helper function to build headers
function buildHeaders(request: any, environment: any): Record<string, string> {
  const headers: Record<string, string> = {}
  
  request.headers
    .filter((h: any) => h.enabled && h.key)
    .forEach((h: any) => {
      headers[interpolateEnvVariables(h.key, environment)] = interpolateEnvVariables(h.value, environment)
    })
  
  const authHeaders = buildAuthHeaders(request, environment)
  Object.assign(headers, authHeaders)
  
  if (request.body.type === 'json' && request.body.content) {
    headers['Content-Type'] = 'application/json'
  } else if (request.body.type === 'x-www-form-urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (request.body.type === 'form-data') {
    headers['Content-Type'] = 'multipart/form-data'
  } else if (request.body.type === 'graphql') {
    headers['Content-Type'] = 'application/json'
  }
  
  return headers
}

const httpAbortControllers = new Map<number, AbortController>();

ipcMain.handle('http:sendRequest', async (event, request: any, environment: any) => {
  const requestId = Date.now();
  const abortController = new AbortController();
  httpAbortControllers.set(requestId, abortController);

  try {
    const startTime = performance.now()
    let url = interpolateEnvVariables(request.url, environment) || ''
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'http://' + url
    }
    
    const axiosParams: Record<string, string> = {}
    if (Array.isArray(request.params)) {
      request.params
        .filter((p: any) => p.enabled && p.key)
        .forEach((p: any) => {
          axiosParams[interpolateEnvVariables(p.key, environment)] = interpolateEnvVariables(p.value, environment)
        })
    }
    
    if (request.auth?.type === 'api-key' && request.auth?.apiKey?.in === 'query') {
      axiosParams[interpolateEnvVariables(request.auth.apiKey.key, environment)] = interpolateEnvVariables(request.auth.apiKey.value, environment)
    }

    let data: any = undefined
    if (request.body?.type === 'json' && request.body.content) {
      try {
        data = JSON.parse(interpolateEnvVariables(request.body.content, environment))
      } catch (e) {
        data = interpolateEnvVariables(request.body.content, environment)
      }
    } else if (['text'].includes(request.body?.type) && request.body.content) {
      data = interpolateEnvVariables(request.body.content, environment)
    } else if (request.body?.type === 'x-www-form-urlencoded' && request.body.content) {
      const parsedBody = interpolateEnvVariables(request.body.content, environment)
      try {
        const obj = JSON.parse(parsedBody)
        data = new URLSearchParams(obj).toString()
      } catch (e) {
        data = parsedBody
      }
    } else if (request.body?.type === 'graphql' && request.body.graphql) {
      const query = interpolateEnvVariables(request.body.graphql.query, environment)
      let variables = {}
      try { 
        variables = JSON.parse(interpolateEnvVariables(request.body.graphql.variables, environment)) 
      } catch(e) {}
      data = { query, variables }
    }

    const axiosConfig: any = {
      method: request.method,
      url,
      headers: buildHeaders(request, environment),
      params: axiosParams,
      data,
      timeout: 30000,
      validateStatus: () => true,
      signal: abortController.signal,
    }
    
    const axiosResponse = await axios(axiosConfig)
    const endTime = performance.now()
    httpAbortControllers.delete(requestId)
    
    const responseHeaders: Record<string, string> = {}
    Object.entries(axiosResponse.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        responseHeaders[key] = value
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(', ')
      }
    })
    
    let responseBody: string
    if (typeof axiosResponse.data === 'object') {
      responseBody = JSON.stringify(axiosResponse.data, null, 2)
    } else {
      responseBody = String(axiosResponse.data)
    }
    
    return {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: responseHeaders,
      body: responseBody,
      time: Math.round(endTime - startTime),
      size: Buffer.byteLength(responseBody),
      type: 'http',
    }
  } catch (error: any) {
    httpAbortControllers.delete(requestId)
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return {
        status: 0,
        statusText: 'Cancelled',
        headers: {},
        body: 'Request cancelled by user',
        time: 0,
        size: 0,
        type: 'http',
        cancelled: true,
      }
    }
    const endTime = performance.now()
    console.error('HTTP request error:', error)
    return {
      status: 0,
      statusText: error.message || 'Network Error',
      headers: {},
      body: error.message || 'Request failed',
      time: Math.round(performance.now() - endTime),
      size: 0,
      type: 'http',
    }
  }
})

ipcMain.handle('http:cancelRequest', async () => {
  httpAbortControllers.forEach((controller) => {
    controller.abort()
  })
  httpAbortControllers.clear()
})
