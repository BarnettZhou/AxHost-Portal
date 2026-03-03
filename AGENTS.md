# AxHost-Plugin Electron 应用

## 项目概述

AxHost-Plugin 是一个用于 AxHost 原型托管系统的桌面端插件，主要功能是将本地 Axure 生成的 HTML 目录与线上的原型项目关联，实现快捷上传更新。

## 项目结构

```
local-tool/
├── src/
│   ├── main.js                 # 主进程入口
│   ├── preload.js              # 预加载脚本（安全桥接）
│   └── renderer/
│       ├── index.html          # 主页面
│       ├── css/
│       │   └── style.css       # 样式文件
│       └── js/
│           └── app.js          # 渲染进程逻辑
├── assets/                     # 资源文件（图标等）
├── package.json                # 项目配置
└── AGENTS.md                   # 本文件
```

## 技术栈

- **Electron**: ^28.0.0 - 桌面应用框架
- **Axios**: ^1.6.2 - HTTP 请求库
- **adm-zip**: ^0.5.10 - ZIP 压缩库
- **纯 HTML/CSS/JS**: 前端界面（无框架依赖）

## 核心功能

### 1. 登录认证
- 支持工号+密码登录
- JWT Token 持久化存储
- 自动登录状态验证
- 服务器地址配置

### 2. 项目列表
- 展示当前用户的所有原型项目
- 显示项目名称、标签、更新时间
- 搜索过滤功能
- 显示本地关联状态

### 3. 本地目录关联
- 唤起系统目录选择对话框
- 验证目录是否包含 Axure 入口文件（start.html/index.html）
- 关联信息持久化存储
- 支持更改关联和取消关联

### 4. 原型上传/更新
- 本地目录自动打包为 ZIP
- 支持创建新项目并上传
- 支持更新已有项目文件
- 上传进度反馈

### 5. 项目信息管理
- 修改项目名称、备注
- 设置访问密码
- 公开/私密切换
- 标签支持（基础）

## 数据存储

### 本地存储位置
- **项目关联数据**: `userData/project-links.json`
- **应用设置**: `userData/settings.json`
- **登录 Token**: LocalStorage

### 数据格式
```json
// project-links.json
{
  "project-object-id": {
    "path": "/path/to/local/directory",
    "linkedAt": "2024-01-15T10:30:00.000Z"
  }
}

// settings.json
{
  "serverUrl": "http://localhost:8000",
  "autoCheckUpdate": false
}
```

## API 接口

应用通过 IPC 与主进程通信，调用以下后端 API：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 退出登录 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/projects` | GET | 获取项目列表 |
| `/api/projects` | POST | 创建项目 |
| `/api/projects/:id` | PUT | 更新项目信息 |
| `/api/projects/upload` | POST | 上传新项目（含文件） |
| `/api/projects/:id/update-file` | POST | 更新项目文件 |
| `/api/projects/generate-password` | POST | 生成随机密码 |
| `/api/tags` | GET | 获取标签列表 |

## 窗口配置

- **尺寸**: 默认 480x700，最大 600x800
- **最小尺寸**: 400x500
- **最大化**: 禁用
- **全屏**: 禁用
- **尺寸调整**: 允许（在限制范围内）

## 开发指南

### 安装依赖
```bash
cd local-tool
npm install
```

### 开发模式启动
```bash
npm run dev
# 或
npm start
```

### 构建应用
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# 全平台
npm run build
```

### 项目设置
首次启动时需要配置：
1. 服务器地址（默认：http://localhost:8000）
2. 使用 AxHost 系统的工号和密码登录

## 安全注意事项

1. **Token 存储**: 使用 LocalStorage 存储 JWT Token
2. **密码处理**: 登录密码仅在请求时传输，不进行本地存储
3. **IPC 通信**: 通过 preload.js 暴露有限的 API，禁用 Node.js 集成
4. **路径验证**: 上传前验证目录包含有效的 Axure 文件

## 代码规范

### JavaScript
- 使用 ES6+ 语法
- 异步操作使用 async/await
- 状态管理使用全局 state 对象
- 工具函数封装在 utils 对象中

### CSS
- 使用 CSS 变量定义颜色和尺寸
- BEM-like 命名规范
- 移动端优先的响应式设计

## 待实现功能

- [ ] 设置页面（服务器地址、自动检查更新等）
- [ ] 标签选择器（常用标签、新建标签）
- [ ] 上传进度条
- [ ] 批量操作
- [ ] 离线模式检测
- [ ] 自动更新检测
- [ ] 拖拽上传支持
- [ ] 最近更新提醒

## 故障排查

### 无法连接到服务器
- 检查服务器地址配置
- 确认 AxHost 后端服务已启动
- 检查网络连接

### 上传失败
- 验证本地目录包含 start.html 或 index.html
- 检查目录权限
- 确认网络稳定

### 登录失败
- 确认工号和密码正确
- 检查服务器地址
- 查看后端日志

## 调试指南

### 开启调试模式

在开发模式下运行应用时，可以打开开发者工具查看详细日志：

```javascript
// 在 main.js 的 createWindow 函数中添加
mainWindow.webContents.openDevTools();
```

### 查看日志

#### 主进程日志（终端输出）
运行 `npm run dev` 的终端会显示主进程日志：
```
[Pack] 开始打包目录: C:\Users\xxx\Documents\prototype
[Pack] ZIP 创建完成: ...
[HTTP] 请求: POST /api/projects/xxx/update-file
[HTTP] 响应: 200 { message: "更新成功" }
```

#### 渲染进程日志（开发者工具 Console）
按 `Ctrl+Shift+I` 打开开发者工具，查看 Console 标签：
```
[Update] 开始更新原型: abc123
[Update] 本地目录: C:\Users\xxx\Documents\prototype
[Update] 打包结果: { success: true, path: "...", size: 123456, entries: 42 }
```

### 常见问题排查

#### 问题：更新原型显示成功，但线上内容未变化

**排查步骤：**

1. **检查打包日志**
   - 查看主进程日志中的 `[Pack]` 日志
   - 确认 `ZIP 条目数` 不为 0
   - 确认包含 `start.html` 或 `index.html`

2. **检查上传日志**
   - 查看 `[HTTP]` 日志中的请求和响应
   - 确认响应状态为 200
   - 查看响应消息内容

3. **手动验证 ZIP 文件**
   ```javascript
   // 在开发者工具 Console 中执行
   const packResult = await window.electronAPI.file.pack('你的目录路径');
   console.log('ZIP 路径:', packResult.path);
   // 在文件管理器中打开该路径查看 ZIP 内容
   ```

4. **检查后端上传目录**
   - 进入后端 uploads 目录查看文件是否正确解压
   - 检查目录权限

#### 问题：打包成功但上传失败

**可能原因：**
- 文件过大（检查文件大小日志）
- 网络超时（默认 120 秒）
- 后端存储空间不足

**解决方案：**
- 减少原型文件大小（删除不必要的资源）
- 检查后端磁盘空间
- 查看后端日志

### 手动测试 API

在开发者工具 Console 中测试 API：

```javascript
// 测试打包
const result = await window.electronAPI.file.pack('C:\path\to\prototype');
console.log(result);

// 测试上传
await window.electronAPI.http.request({
  method: 'POST',
  url: '/api/projects/YOUR_PROJECT_ID/update-file',
  isFormData: true,
  data: {
    file: { path: result.path, name: 'project.zip' }
  },
  token: localStorage.getItem('token')
});
```

## 相关链接

- AxHost 主项目: ./README.md
- 后端 API 文档: ./AGENTS.md
- 版本历史: ./CHANGELOG.md

## 开发环境

当前所处的开发环境请阅读根目录下的 .local-env 文件

- cli_type: 命令行类型，powershell、macos、linux

## AGENT约束

**重要**:

- 严格遵守 Prompt 的命令执行任务
- 在尝试自行优化功能前，必须向用户确认
- 遇到较为复杂的任务，先输出任务分解，由用户确认后再执行
- 绝对禁止自行commit代码、自行推送代码到任何远程仓库的行为，除非用户明确要求AGENT执行
