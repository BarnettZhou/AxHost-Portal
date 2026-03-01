// ==================== 状态管理 ====================
const state = {
  user: null,
  token: localStorage.getItem('token') || null,
  projects: [],
  projectLinks: {},
  settings: null,
  currentProjectId: null,
  isLoading: false,
};

// ==================== 工具函数 ====================
const utils = {
  // 显示提示
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
    };
    
    document.getElementById('toast-icon').textContent = iconMap[type] || iconMap.info;
    document.getElementById('toast-message').textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'flex';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  },

  // 格式化时间
  formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // 生成随机密码
  generatePassword(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },

  // 显示/隐藏元素
  show(element) {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    if (element) element.style.display = '';
  },

  hide(element) {
    if (typeof element === 'string') {
      element = document.getElementById(element);
    }
    if (element) element.style.display = 'none';
  },

  // 设置按钮加载状态
  setButtonLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const loadingEl = btn.querySelector('.btn-loading');
    
    if (loading) {
      btn.disabled = true;
      if (text) text.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'inline-flex';
    } else {
      btn.disabled = false;
      if (text) text.style.display = '';
      if (loadingEl) loadingEl.style.display = 'none';
    }
  },
};

// ==================== API 封装 ====================
const api = {
  async request(url, options = {}) {
    const config = {
      method: options.method || 'GET',
      url,
      headers: options.headers || {},
      data: options.data,
      isFormData: options.isFormData || false,
      timeout: options.timeout || 30000,
      token: state.token,
    };

    const result = await window.electronAPI.http.request(config);
    
    if (!result.success) {
      if (result.status === 401) {
        // Token 过期，清除登录状态
        state.token = null;
        localStorage.removeItem('token');
        app.showLoginPage();
        throw new Error('登录已过期，请重新登录');
      }
      // 根据状态码提供更详细的错误信息
      if (result.status === 404) {
        throw new Error(`接口未找到 (404)：请检查后端服务是否正常运行，或联系管理员检查服务器配置`);
      }
      if (result.status === 500) {
        throw new Error(`服务器内部错误 (500)：请稍后重试，或联系管理员`);
      }
      if (result.status === 403) {
        throw new Error(`无权限访问 (403)：请确认您的账号有权限访问该系统`);
      }
      if (result.status === 0) {
        throw new Error(`网络请求失败：无法连接到服务器，请检查网络或服务器地址`);
      }
      throw new Error(result.error || `请求失败 (${result.status || '未知'})`);
    }
    
    return result.data;
  },

  // 登录
  async login(employeeId, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      data: { employee_id: employeeId, password },
    });
    state.token = data.access_token;
    state.user = data.user;
    localStorage.setItem('token', state.token);
    return data;
  },

  // 退出登录
  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // 忽略错误
    }
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
  },

  // 获取当前用户
  async getCurrentUser() {
    return await this.request('/api/auth/me');
  },

  // 获取项目列表
  async getProjects(search = '') {
    const params = new URLSearchParams();
    params.append('page', '1');
    params.append('per_page', '100');
    params.append('project_type', 'my');
    if (search) params.append('search', search);
    
    const data = await this.request(`/api/projects?${params.toString()}`);
    return data.items || [];
  },

  // 创建项目
  async createProject(projectData) {
    return await this.request('/api/projects', {
      method: 'POST',
      data: projectData,
    });
  },

  // 更新项目
  async updateProject(objectId, projectData) {
    return await this.request(`/api/projects/${objectId}`, {
      method: 'PUT',
      data: projectData,
    });
  },

  // 上传项目文件
  async uploadProject(filePath, formData) {
    return await this.request('/api/projects/upload', {
      method: 'POST',
      data: {
        file: { path: filePath, name: 'project.zip' },
        ...formData,
      },
      isFormData: true,
      timeout: 120000, // 2分钟超时
    });
  },

  // 更新项目文件
  async updateProjectFile(objectId, filePath) {
    return await this.request(`/api/projects/${objectId}/update-file`, {
      method: 'POST',
      data: {
        file: { path: filePath, name: 'project.zip' },
      },
      isFormData: true,
      timeout: 120000,
    });
  },

  // 生成随机密码
  async generatePassword() {
    return await this.request('/api/projects/generate-password');
  },

  // 获取标签列表
  async getTags() {
    return await this.request('/api/tags');
  },
};

// ==================== 应用逻辑 ====================
const app = {
  // 初始化
  async init() {
    // 加载设置
    state.settings = await window.electronAPI.settings.get();
    
    // 加载项目关联
    state.projectLinks = await window.electronAPI.projectLinks.getAll();

    // 如果有 token，尝试获取当前用户
    if (state.token) {
      try {
        state.user = await api.getCurrentUser();
        this.showMainPage();
        this.loadProjects();
      } catch (e) {
        console.log('Token 验证失败:', e);
        this.showLoginPage();
      }
    } else {
      this.showLoginPage();
    }

    // 绑定事件
    this.bindEvents();
  },

  // 绑定事件
  bindEvents() {
    // 登录表单
    document.getElementById('login-form').addEventListener('submit', this.handleLogin.bind(this));

    // 退出登录
    document.getElementById('btn-logout').addEventListener('click', this.handleLogout.bind(this));

    // 新增项目
    document.getElementById('btn-new-project').addEventListener('click', () => {
      this.openProjectModal();
    });
    document.getElementById('btn-empty-new').addEventListener('click', () => {
      this.openProjectModal();
    });

    // 搜索
    const searchInput = document.getElementById('search-input');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.loadProjects(e.target.value);
      }, 300);
    });

    // 项目表单
    document.getElementById('project-form').addEventListener('submit', this.handleProjectSubmit.bind(this));

    // 公开访问切换
    document.getElementById('project-public').addEventListener('change', (e) => {
      const passwordGroup = document.getElementById('password-group');
      passwordGroup.style.display = e.target.checked ? 'none' : '';
    });

    // 生成密码
    document.getElementById('btn-gen-password').addEventListener('click', async () => {
      try {
        const result = await api.generatePassword();
        document.getElementById('project-password').value = result.password;
      } catch (e) {
        // 使用本地生成
        document.getElementById('project-password').value = utils.generatePassword();
      }
    });

    // 选择目录
    document.getElementById('btn-select-dir').addEventListener('click', async () => {
      const result = await window.electronAPI.directory.select();
      if (result.success) {
        document.getElementById('project-directory').value = result.path;
      } else if (result.path) {
        // 有警告但仍然可以选择
        if (confirm(result.warning + '\n\n仍要使用该目录吗？')) {
          document.getElementById('project-directory').value = result.path;
        }
      }
    });

    // 更改关联弹窗
    document.getElementById('btn-select-new-dir').addEventListener('click', async () => {
      const result = await window.electronAPI.directory.select();
      if (result.success) {
        document.getElementById('new-link-path').value = result.path;
      } else if (result.path && confirm(result.warning + '\n\n仍要使用该目录吗？')) {
        document.getElementById('new-link-path').value = result.path;
      }
    });

    document.getElementById('btn-save-link').addEventListener('click', this.handleSaveLink.bind(this));
    document.getElementById('btn-remove-link').addEventListener('click', this.handleRemoveLink.bind(this));

    // 弹窗关闭
    document.querySelectorAll('.modal-close, .modal-cancel, .modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          this.closeAllModals();
        }
      });
    });

    // 点击外部关闭操作菜单
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.action-menu') && !e.target.closest('.btn-menu')) {
        utils.hide('action-menu');
      }
    });

    // 操作菜单项
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', this.handleMenuAction.bind(this));
    });
  },

  // 从 URL 中提取主机和端口
  parseServerUrl(url) {
    try {
      const urlObj = new URL(url);
      return {
        host: urlObj.hostname,
        port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      };
    } catch (e) {
      return null;
    }
  },

  // 处理登录
  async handleLogin(e) {
    e.preventDefault();
    
    const employeeId = document.getElementById('employee-id').value.trim();
    const password = document.getElementById('password').value;
    const serverUrl = document.getElementById('server-url').value.trim();
    
    if (!employeeId || !password) {
      document.getElementById('login-error').textContent = '请输入工号和密码';
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    utils.setButtonLoading(btn, true);

    try {
      // 网络检测
      if (serverUrl) {
        const parsed = this.parseServerUrl(serverUrl);
        if (parsed) {
          console.log(`[Login] Checking network connectivity to ${parsed.host}:${parsed.port}`);
          const networkCheck = await window.electronAPI.network.check(parsed.host, parsed.port, 5000);
          console.log('[Login] Network check result:', networkCheck);
          
          if (!networkCheck.success) {
            utils.showToast('网络错误：无法连接到服务器，请检查网络或联系网络管理员', 'error');
            utils.setButtonLoading(btn, false);
            return;
          }
        }
      }

      // 保存服务器地址
      if (serverUrl) {
        state.settings.serverUrl = serverUrl;
        await window.electronAPI.settings.save(state.settings);
      }

      await api.login(employeeId, password);
      utils.showToast('登录成功', 'success');
      this.showMainPage();
      this.loadProjects();
    } catch (e) {
      const errorEl = document.getElementById('login-error');
      errorEl.textContent = e.message;
      
      // 对于后端配置问题，显示额外的提示
      if (e.message.includes('接口未找到')) {
        utils.showToast('登录失败：后端服务配置异常', 'error');
      }
    } finally {
      utils.setButtonLoading(btn, false);
    }
  },

  // 处理退出登录
  async handleLogout() {
    try {
      await api.logout();
    } catch (e) {
      console.error('退出登录失败:', e);
    }
    this.showLoginPage();
    utils.showToast('已退出登录', 'info');
  },

  // 显示登录页面
  showLoginPage() {
    utils.hide('main-page');
    utils.show('login-page');
    document.getElementById('employee-id').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-error').textContent = '';
    
    // 恢复服务器地址
    if (state.settings?.serverUrl) {
      document.getElementById('server-url').value = state.settings.serverUrl;
    }
  },

  // 显示主页面
  showMainPage() {
    utils.hide('login-page');
    utils.show('main-page');
    document.getElementById('user-name').textContent = state.user?.name || '';
  },

  // 加载项目列表
  async loadProjects(search = '') {
    utils.show('loading-state');
    utils.hide('project-list');
    utils.hide('empty-state');

    try {
      state.projects = await api.getProjects(search);
      // 重新加载本地关联
      state.projectLinks = await window.electronAPI.projectLinks.getAll();
      this.renderProjects();
    } catch (e) {
      utils.showToast(e.message, 'error');
    } finally {
      utils.hide('loading-state');
    }
  },

  // 渲染项目列表
  renderProjects() {
    const container = document.getElementById('project-list');
    
    if (state.projects.length === 0) {
      utils.hide(container);
      utils.show('empty-state');
      return;
    }

    utils.show(container);
    utils.hide('empty-state');

    container.innerHTML = state.projects.map(project => {
      const link = state.projectLinks[project.object_id];
      const linkTag = link ? 
        `<span class="project-tag linked">📁 已关联</span>` : '';
      
      const tagsHtml = (project.tags || []).map(tag => 
        `<span class="project-tag" style="background: ${tag.color}20; color: ${tag.color};">
          ${tag.emoji || ''} ${tag.name}
        </span>`
      ).join('');

      const updateTime = utils.formatTime(project.updated_at);

      return `
        <div class="project-card" data-id="${project.object_id}">
          <div class="project-header">
            <div class="project-title">${this.escapeHtml(project.name)}</div>
            <button class="btn-icon btn-menu" data-id="${project.object_id}">⋮</button>
          </div>
          <div class="project-tags">
            ${linkTag}
            ${tagsHtml}
          </div>
          <div class="project-meta">
            <span>📝 ${this.escapeHtml(project.author_name)}</span>
            <span>🕐 ${updateTime}</span>
            ${project.is_public ? '<span>🌐 公开</span>' : '<span>🔒 私密</span>'}
          </div>
          <div class="project-actions">
            ${link ? `
              <button class="btn btn-primary btn-sm btn-update" data-id="${project.object_id}">
                🔄 更新原型
              </button>
              <button class="btn btn-secondary btn-sm btn-open-online" data-id="${project.object_id}">
                🌐 在线查看
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm btn-link" data-id="${project.object_id}">
                🔗 关联目录
              </button>
              <button class="btn btn-secondary btn-sm btn-open-online" data-id="${project.object_id}">
                🌐 在线查看
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // 绑定卡片事件
    container.querySelectorAll('.btn-menu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showActionMenu(e, btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-update').forEach(btn => {
      btn.addEventListener('click', () => this.handleUpdateProject(btn.dataset.id));
    });

    container.querySelectorAll('.btn-link').forEach(btn => {
      btn.addEventListener('click', () => this.openLinkModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-open-online').forEach(btn => {
      btn.addEventListener('click', () => this.openOnline(btn.dataset.id));
    });
  },

  // 显示操作菜单
  showActionMenu(e, projectId) {
    const menu = document.getElementById('action-menu');
    const rect = e.target.getBoundingClientRect();
    
    menu.style.left = `${rect.left - 140}px`;
    menu.style.top = `${rect.bottom + 8}px`;
    menu.dataset.projectId = projectId;
    
    utils.show(menu);
  },

  // 处理菜单操作
  handleMenuAction(e) {
    const action = e.currentTarget.dataset.action;
    const projectId = document.getElementById('action-menu').dataset.projectId;
    
    utils.hide('action-menu');

    switch (action) {
      case 'update':
        this.handleUpdateProject(projectId);
        break;
      case 'link':
        this.openLinkModal(projectId);
        break;
      case 'open-online':
        this.openOnline(projectId);
        break;
    }
  },

  // 打开项目弹窗（新增）
  openProjectModal() {
    document.getElementById('modal-title').textContent = '新增原型';
    document.getElementById('project-id').value = '';
    document.getElementById('project-name').value = '';
    document.getElementById('project-remark').value = '';
    document.getElementById('project-public').checked = false;
    document.getElementById('project-password').value = '';
    document.getElementById('project-directory').value = '';
    document.getElementById('password-group').style.display = '';
    document.getElementById('form-error').textContent = '';
    
    utils.show('project-modal');
    document.getElementById('project-name').focus();
  },

  // 在线查看项目
  openOnline(projectId) {
    const serverUrl = (state.settings?.serverUrl || 'http://localhost:8000').replace(/\/$/, '');
    window.electronAPI.shell.openExternal(`${serverUrl}/projects/${projectId}/`);
  },

  // 处理项目表单提交
  async handleProjectSubmit(e) {
    e.preventDefault();
    
    const projectId = document.getElementById('project-id').value;
    const name = document.getElementById('project-name').value.trim();
    const remark = document.getElementById('project-remark').value.trim();
    const isPublic = document.getElementById('project-public').checked;
    const password = document.getElementById('project-password').value;
    const directory = document.getElementById('project-directory').value;
    
    if (!name) {
      document.getElementById('form-error').textContent = '请输入项目名称';
      return;
    }

    if (!isPublic && password && !/^[a-zA-Z0-9]{6,18}$/.test(password)) {
      document.getElementById('form-error').textContent = '密码需为6-18位数字字母';
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    utils.setButtonLoading(btn, true);

    try {
      const projectData = {
        name,
        remark,
        is_public: isPublic,
        view_password: isPublic ? null : password,
        tag_names: [],
      };

      // 创建新项目
      let result;
      
      if (directory) {
        // 需要打包上传
        const packResult = await window.electronAPI.file.pack(directory);
        if (!packResult.success) {
          throw new Error('打包失败: ' + packResult.error);
        }

        try {
          result = await api.uploadProject(packResult.path, {
            name,
            remark,
            is_public: isPublic,
            view_password: isPublic ? null : password,
            tags: '[]',
          });
        } finally {
          // 清理临时文件
          await window.electronAPI.file.cleanup(packResult.path);
        }
      } else {
        // 仅创建项目记录
        result = await api.createProject(projectData);
      }
      
      utils.showToast('原型创建成功', 'success');
      
      // 如果有目录，保存关联
      if (directory && result.object_id) {
        await window.electronAPI.projectLinks.save(result.object_id, directory);
      }

      this.closeAllModals();
      this.loadProjects();
    } catch (e) {
      document.getElementById('form-error').textContent = e.message;
    } finally {
      utils.setButtonLoading(btn, false);
    }
  },

  // 打开关联弹窗
  openLinkModal(projectId) {
    const project = state.projects.find(p => p.object_id === projectId);
    const link = state.projectLinks[projectId];
    
    document.getElementById('current-link-info').style.display = link ? '' : 'none';
    document.getElementById('current-link-path').textContent = link?.path || '';
    document.getElementById('new-link-path').value = '';
    
    const modal = document.getElementById('link-modal');
    modal.dataset.projectId = projectId;
    utils.show(modal);
  },

  // 保存关联
  async handleSaveLink() {
    const modal = document.getElementById('link-modal');
    const projectId = modal.dataset.projectId;
    const newPath = document.getElementById('new-link-path').value;
    
    if (!newPath) {
      utils.showToast('请先选择目录', 'warning');
      return;
    }

    await window.electronAPI.projectLinks.save(projectId, newPath);
    state.projectLinks[projectId] = { path: newPath };
    
    utils.showToast('关联已更新', 'success');
    this.closeAllModals();
    this.renderProjects();
  },

  // 取消关联
  async handleRemoveLink() {
    const modal = document.getElementById('link-modal');
    const projectId = modal.dataset.projectId;
    
    await window.electronAPI.projectLinks.remove(projectId);
    delete state.projectLinks[projectId];
    
    utils.showToast('关联已取消', 'success');
    this.closeAllModals();
    this.renderProjects();
  },

  // 更新原型
  async handleUpdateProject(projectId) {
    console.log('[Update] Start updating prototype:', projectId);
    
    const link = state.projectLinks[projectId];
    if (!link) {
      utils.showToast('请先关联本地目录', 'warning');
      return;
    }
    
    console.log('[Update] Local directory:', link.path);

    if (!confirm('确定要更新原型吗？这将覆盖线上的原型文件。')) {
      return;
    }

    const card = document.querySelector(`[data-id="${projectId}"]`);
    const btn = card?.querySelector('.btn-update') || card?.querySelector('.btn-primary');
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = '打包中...';
    }

    try {
      // 打包目录
      console.log('[Update] Start packing...');
      const packResult = await window.electronAPI.file.pack(link.path);
      console.log('[Update] Pack result:', packResult);
      
      if (!packResult.success) {
        throw new Error('打包失败: ' + packResult.error);
      }
      
      // 显示打包信息
      const sizeMB = (packResult.size / 1024 / 1024).toFixed(2);
      utils.showToast(`Pack complete: ${packResult.entries} files, ${sizeMB} MB`, 'success');

      if (btn) btn.textContent = 'Uploading...';

      try {
        console.log('[Update] Start uploading file...');
        const result = await api.updateProjectFile(projectId, packResult.path);
        console.log('[Update] Upload result:', result);
        
        if (result && result.message) {
          utils.showToast(result.message, 'success');
        } else {
          utils.showToast('原型更新成功', 'success');
        }
        
        // Delay refresh list
        setTimeout(() => this.loadProjects(), 500);
      } finally {
        // Cleanup temp file
        console.log('[Update] Cleanup temp file:', packResult.path);
        await window.electronAPI.file.cleanup(packResult.path);
      }
    } catch (e) {
      console.error('[Update] Update failed:', e);
      utils.showToast('Update failed: ' + e.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 更新原型';
      }
    }
  },

  // 关闭所有弹窗
  closeAllModals() {
    utils.hide('project-modal');
    utils.hide('link-modal');
    utils.hide('action-menu');
  },

  // HTML 转义
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
