# AxHost Plugin

AxHost 原型管理桌面插件 - 将本地 Axure 原型与线上项目快速关联和同步。

## 功能特性

- 🔐 **安全登录** - 使用 AxHost 账号登录，JWT Token 认证
- 📂 **目录关联** - 将本地 Axure 输出目录与线上项目关联
- 🚀 **一键更新** - 快速打包并上传原型到服务器
- ➕ **新建项目** - 在应用内直接创建新项目并上传
- ✏️ **信息管理** - 修改项目名称、密码、公开状态等
- 🔍 **搜索过滤** - 快速查找项目

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装

```bash
cd local-tool
npm install
```

### 开发运行

```bash
npm run dev
```

### 构建

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建后的文件位于 `dist/` 目录。

## 使用说明

### 首次使用

1. 启动应用后，配置服务器地址（默认：http://localhost:8000）
2. 使用 AxHost 系统的工号和密码登录
3. 进入主界面查看项目列表

### 关联本地目录

1. 点击项目卡片的「关联目录」按钮
2. 在弹出的文件对话框中选择 Axure 输出的 HTML 目录
3. 目录需要包含 `start.html` 或 `index.html`

### 更新原型

1. 确保项目已关联本地目录
2. 点击「更新原型」按钮
3. 应用会自动打包并上传

### 新建项目

1. 点击「新增原型」按钮
2. 填写项目信息
3. 可选择立即关联本地目录并上传

## 项目配置

配置信息存储在用户数据目录：

- **Windows**: `%APPDATA%/AxHost-Plugin/`
- **macOS**: `~/Library/Application Support/AxHost-Plugin/`
- **Linux**: `~/.config/AxHost-Plugin/`

## 与 AxHost 后端配合

本插件需要配合 AxHost 后端服务使用：

```bash
# 启动后端服务（在 AxHost 根目录）
docker compose -f docker-compose.dev.yml up -d
```

确保后端服务运行在配置的地址上。

## 技术栈

- Electron 28
- 原生 HTML/CSS/JS
- Axios（HTTP 请求）
- adm-zip（ZIP 压缩）

## 项目结构

```
local-tool/
├── src/
│   ├── main.js          # Electron 主进程
│   ├── preload.js       # 预加载脚本
│   └── renderer/        # 渲染进程
│       ├── index.html
│       ├── css/
│       └── js/
├── package.json
└── README.md
```

## 许可证

MIT
