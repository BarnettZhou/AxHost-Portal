const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const axios = require('axios');
const FormData = require('form-data');

// 配置
const CONFIG = {
  maxWidth: 600,
  maxHeight: 800,
  minWidth: 400,
  minHeight: 500,
};

// 存储关联数据的文件路径
const STORE_FILE = path.join(app.getPath('userData'), 'project-links.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

let mainWindow = null;
let tray = null;

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[App] Another instance is running, quitting...');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，聚焦到第一个实例的窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 创建设置文件（如果不存在）
function initSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      serverUrl: 'http://localhost:8000',
      autoCheckUpdate: false,
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
}

// 初始化项目关联存储
function initProjectLinks() {
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({}));
    return {};
  }
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
}

// 保存项目关联
function saveProjectLink(projectId, localPath) {
  const links = initProjectLinks();
  links[projectId] = {
    path: localPath,
    linkedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(links, null, 2));
  return links[projectId];
}

// 获取项目关联
function getProjectLink(projectId) {
  const links = initProjectLinks();
  return links[projectId] || null;
}

// 获取所有项目关联
function getAllProjectLinks() {
  return initProjectLinks();
}

// 删除项目关联
function removeProjectLink(projectId) {
  const links = initProjectLinks();
  delete links[projectId];
  fs.writeFileSync(STORE_FILE, JSON.stringify(links, null, 2));
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: CONFIG.minWidth,
    minHeight: CONFIG.minHeight,
    maxWidth: CONFIG.maxWidth,
    maxHeight: CONFIG.maxHeight,
    title: 'AxHost Portal',
    icon: path.join(__dirname, '..', 'icon', 'icon.ico'),
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  // 加载页面
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 开发模式下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  // 窗口关闭时最小化到托盘（不是退出）
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      console.log('[Window] Minimized to tray');
    }
  });

  // 窗口真正关闭时清理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 阻止外部链接在窗口内打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 移除菜单栏
  Menu.setApplicationMenu(null);

  // 创建托盘图标
  createTray();
}

// 创建托盘图标
function createTray() {
  // 尝试多个可能的路径（开发环境 vs 打包环境）
  const possiblePaths = [
    path.join(__dirname, '..', 'icon', 'icon.ico'),
    path.join(__dirname, '..', '..', 'icon', 'icon.ico'),
    path.join(process.resourcesPath, 'icon', 'icon.ico'),
    path.join(app.getAppPath(), 'icon', 'icon.ico'),
  ];
  
  let iconPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      console.log('[Tray] Found icon at:', p);
      break;
    }
  }
  
  if (!iconPath) {
    console.error('[Tray] Icon not found in any path, skipping tray creation');
    return;
  }
  
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('AxHost Portal');
  } catch (err) {
    console.error('[Tray] Failed to create tray:', err.message);
    return;
  }
  
  // 右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // 左键点击显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  console.log('[Tray] Tray created');
}

// 应用准备就绪
app.whenReady().then(() => {
  initSettings();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==================== IPC 处理器 ====================

// 获取设置
ipcMain.handle('get-settings', () => {
  return initSettings();
});

// 保存设置
ipcMain.handle('save-settings', (event, settings) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
});

// 选择目录
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择 Axure 原型目录',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, path: null };
  }

  const selectedPath = result.filePaths[0];

  // 验证目录是否包含 Axure 原型文件（检查 start.html 或 index.html）
  const files = fs.readdirSync(selectedPath);
  const hasStartHtml = files.includes('start.html') || files.includes('Start.html');
  const hasIndexHtml = files.includes('index.html') || files.includes('Index.html');

  if (!hasStartHtml && !hasIndexHtml) {
    return {
      success: false,
      path: selectedPath,
      warning: '该目录未找到 start.html 或 index.html，可能不是有效的 Axure 输出目录',
    };
  }

  return { success: true, path: selectedPath };
});

// 获取项目关联
ipcMain.handle('get-project-link', (event, projectId) => {
  return getProjectLink(projectId);
});

// 获取所有项目关联
ipcMain.handle('get-all-project-links', () => {
  return getAllProjectLinks();
});

// 保存项目关联
ipcMain.handle('save-project-link', (event, projectId, localPath) => {
  return saveProjectLink(projectId, localPath);
});

// 删除项目关联
ipcMain.handle('remove-project-link', (event, projectId) => {
  removeProjectLink(projectId);
  return true;
});

// 打包目录为 ZIP
ipcMain.handle('pack-directory', async (event, dirPath) => {
  try {
    console.log('[Pack] Start packing directory:', dirPath);
    
    // 验证目录存在
    if (!fs.existsSync(dirPath)) {
      throw new Error('目录不存在: ' + dirPath);
    }

    // 生成临时文件路径
    const tempDir = path.join(app.getPath('temp'), 'axhost-plugin');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const zipPath = path.join(tempDir, `project-${Date.now()}.zip`);
    
    // 使用 archiver 创建 ZIP
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 6 } // 压缩级别
    });

    return new Promise((resolve, reject) => {
      let fileCount = 0;
      
      output.on('close', () => {
        const stats = fs.statSync(zipPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log('[Pack] ZIP 创建完成:', zipPath);
        console.log('[Pack] 文件大小:', sizeMB, 'MB');
        console.log('[Pack] 文件数量:', fileCount);
        
        // 验证 ZIP 内容
        try {
          const testZip = new AdmZip(zipPath);
          const entries = testZip.getEntries();
          console.log('[Pack] ZIP 条目数:', entries.length);
          console.log('[Pack] 包含 start.html:', entries.some(e => e.entryName.toLowerCase().includes('start.html')));
          console.log('[Pack] 包含 index.html:', entries.some(e => e.entryName.toLowerCase().includes('index.html')));
        } catch (e) {
          console.warn('[Pack] ZIP 验证警告:', e.message);
        }
        
        resolve({ 
          success: true, 
          path: zipPath, 
          size: stats.size, 
          entries: fileCount 
        });
      });

      archive.on('error', (err) => {
        console.error('[Pack] Archive error:', err);
        reject({ success: false, error: err.message });
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('[Pack] Warning:', err);
        } else {
          console.error('[Pack] Archive warning:', err);
        }
      });

      archive.on('entry', (entry) => {
        fileCount++;
        if (fileCount <= 5 || fileCount % 100 === 0) {
          console.log('[Pack] Adding file:', entry.name);
        }
      });

      archive.pipe(output);

      // 添加目录内容到 ZIP 根目录
      // 这样 ZIP 解压后，文件直接在项目目录下，而不是在一个子目录中
      archive.directory(dirPath, false);

      archive.finalize();
    });
  } catch (error) {
    console.error('[Pack] Pack failed:', error);
    return { success: false, error: error.message };
  }
});

// 清理临时文件
ipcMain.handle('cleanup-temp', (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.error('清理临时文件失败:', error);
    return false;
  }
});

// 打开目录
ipcMain.handle('open-directory', (event, dirPath) => {
  shell.openPath(dirPath);
  return true;
});

// 打开外部链接
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
  return true;
});

// 网络检测 - 尝试连接指定主机的端口
ipcMain.handle('check-network', async (event, host, port, timeout = 3000) => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    // 设置超时
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log(`[Network] Ping ${host}:${port} - Success`);
      socket.destroy();
      resolve({ success: true, host, port });
    });
    
    socket.on('timeout', () => {
      console.log(`[Network] Ping ${host}:${port} - Timeout`);
      socket.destroy();
      resolve({ success: false, host, port, error: '连接超时' });
    });
    
    socket.on('error', (err) => {
      console.log(`[Network] Ping ${host}:${port} - Error: ${err.message}`);
      socket.destroy();
      resolve({ success: false, host, port, error: err.message });
    });
    
    socket.connect(port, host);
  });
});

// HTTP 请求封装
ipcMain.handle('http-request', async (event, options) => {
  try {
    const settings = initSettings();
    const baseURL = settings.serverUrl || 'http://localhost:8000';

    console.log('[HTTP] Request:', options.method || 'GET', options.url);

    // 处理 URL 拼接，避免双斜杠
    const normalizedBaseURL = baseURL.replace(/\/$/, '');  // 去掉末尾斜杠
    const normalizedPath = options.url.startsWith('/') ? options.url : '/' + options.url;
    const fullURL = normalizedBaseURL + normalizedPath;

    const config = {
      method: options.method || 'GET',
      url: fullURL,
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };

    if (options.data) {
      if (options.isFormData) {
        // FormData 处理（文件上传）
        const formData = new FormData();
        for (const [key, value] of Object.entries(options.data)) {
          if (key === 'file') {
            console.log('[HTTP] Adding file:', value.path, 'filename:', value.name);
            if (!fs.existsSync(value.path)) {
              throw new Error('文件不存在: ' + value.path);
            }
            const fileBuffer = fs.readFileSync(value.path);
            const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2);
            console.log('[HTTP] File size:', fileSize, 'MB');
            
            formData.append('file', fileBuffer, {
              filename: value.name || 'project.zip',
              contentType: 'application/zip',
            });
          } else if (Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value);
          }
        }
        config.data = formData;
        config.headers = { ...config.headers, ...formData.getHeaders() };
        console.log('[HTTP] FormData headers:', config.headers);
      } else {
        config.data = options.data;
      }
    }

    // 添加认证头
    if (options.token) {
      config.headers.Authorization = `Bearer ${options.token}`;
    }

    console.log('[HTTP] Sending request...');
    const response = await axios(config);
    console.log('[HTTP] Response:', response.status, response.data);
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    console.error('[HTTP] Request failed:', error.message);
    if (error.response) {
      console.error('[HTTP] Response status:', error.response.status);
      console.error('[HTTP] Response data:', error.response.data);
    }
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
      status: error.response?.status || 0,
    };
  }
});
