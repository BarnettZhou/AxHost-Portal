const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 设置相关
  settings: {
    get: () => ipcRenderer.invoke('get-settings'),
    save: (settings) => ipcRenderer.invoke('save-settings', settings),
  },

  // 目录操作
  directory: {
    select: () => ipcRenderer.invoke('select-directory'),
    open: (path) => ipcRenderer.invoke('open-directory', path),
  },

  // 项目关联操作
  projectLinks: {
    get: (projectId) => ipcRenderer.invoke('get-project-link', projectId),
    getAll: () => ipcRenderer.invoke('get-all-project-links'),
    save: (projectId, localPath) => ipcRenderer.invoke('save-project-link', projectId, localPath),
    remove: (projectId) => ipcRenderer.invoke('remove-project-link', projectId),
  },

  // 文件操作
  file: {
    pack: (dirPath) => ipcRenderer.invoke('pack-directory', dirPath),
    cleanup: (filePath) => ipcRenderer.invoke('cleanup-temp', filePath),
  },

  // HTTP 请求
  http: {
    request: (options) => ipcRenderer.invoke('http-request', options),
  },

  // 外部链接
  shell: {
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
  },
});
