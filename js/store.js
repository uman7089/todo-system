/**
 * 精益项目待办管理系统 v3.0 — 数据存储层
 * 统一管理：公司、用户、项目、待办、证据、基础数据(部门/人员)
 */

var Store = {
  STORAGE_KEY: 'lean_mpms_v3',

  // ── 云端同步配置 ──
  SYNC_INTERVAL: 30000,         // 定时同步间隔：30秒
  SYNC_DEBOUNCE: 2000,          // 写入后延迟 2 秒再推送（防抖）
  _syncApiUrl: null,            // API 地址（自动检测）
  _syncTimer: null,             // 定时同步计时器
  _syncDebounceTimer: null,     // 防抖计时器
  _syncStatus: 'offline',       // offline | syncing | synced | error
  _lastSyncTime: null,          // 上次成功同步时间
  _isSyncing: false,            // 是否正在同步
  _syncCallbacks: [],           // 同步状态变更回调列表
  _serverAvailable: false,      // 服务器是否可用

  /** 初始化 */
  async init() {
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      await initDemoPasswords();
      this._write({
        companies: DEMO_COMPANIES,
        users: DEMO_USERS,
        currentUserId: null,
        currentCompanyId: null,
        projects: DEMO_PROJECTS,
        currentProjectId: null,
        todos: generateDemoData(),
        settings: {},
        notifications: [],
        operationLogs: [],
        projectApprovals: []
      });
    }
    // 确保 superadmin 始终存在
    this._ensureSuperadmin();
    // 确保 projectApprovals 字段存在（向前兼容）
    this._ensureProjectApprovals();
    // 确保 projectNo 字段存在（向前兼容）
    this._ensureProjectNo();
    // 确保 isMilestone 字段存在（向前兼容）
    this._ensureMilestoneField();
    // 确保 extensionRequests 字段存在（向前兼容）
    this._ensureExtensionRequests();
    // 确保 weeklyReports 字段存在（向前兼容）
    this._ensureWeeklyReports();

    // ── 初始化云端同步 ──
    this._initSync();
  },

  /* ========== 云端同步层 ========== */

  /** 初始化同步：检测服务器可用性，拉取最新数据，启动定时同步 */
  _initSync: function() {
    var self = this;
    // 自动检测 API 地址（与前端同目录下的 api.php）
    var loc = window.location;
    self._syncApiUrl = loc.protocol + '//' + loc.host + loc.pathname.replace(/[^/]*$/, '') + 'api.php';

    // 检测服务器是否可用（发 ping 请求）
    self._detectServer().then(function(available) {
      self._serverAvailable = available;
      if (available) {
        // 服务器可用：从服务器拉取最新数据
        self._syncFromServer().then(function() {
          // 拉取完成后，启动定时同步
          self._startPeriodicSync();
        });
      } else {
        // 服务器不可用：纯本地模式（GitHub Pages / 本地打开）
        self._setSyncStatus('offline');
      }
    });
  },

  /** 检测服务器是否可用 */
  _detectServer: function() {
    var self = this;
    return fetch(self._syncApiUrl + '?ping', { method: 'GET', cache: 'no-cache' })
      .then(function(res) {
        if (!res.ok) return false;
        return res.json().then(function(data) { return data && data.ok === true; });
      })
      .catch(function() { return false; });
  },

  /** 从服务器拉取最新数据到 localStorage */
  _syncFromServer: function() {
    var self = this;
    if (self._isSyncing) return Promise.resolve();
    self._isSyncing = true;
    self._setSyncStatus('syncing');

    return fetch(self._syncApiUrl, { method: 'GET', cache: 'no-cache' })
      .then(function(res) { return res.json(); })
      .then(function(serverData) {
        if (serverData && serverData !== null) {
          // 服务器有数据：用服务器数据覆盖本地缓存
          self._migrateData(serverData);
          localStorage.setItem(self.STORAGE_KEY, JSON.stringify(serverData));
          self._lastSyncTime = Date.now();
          self._setSyncStatus('synced');
          // 通知 UI 刷新
          self._notifyDataChange();
        } else {
          // 服务器无数据：把本地数据推上去（首次部署）
          self._syncToServer();
        }
        self._isSyncing = false;
      })
      .catch(function(err) {
        self._isSyncing = false;
        self._setSyncStatus('error');
        console.warn('Sync from server failed:', err);
      });
  },

  /** 将本地 localStorage 数据推送到服务器 */
  _syncToServer: function() {
    var self = this;
    if (!self._serverAvailable) return;
    if (self._isSyncing) return;

    var raw = localStorage.getItem(self.STORAGE_KEY);
    if (!raw) return;

    self._setSyncStatus('syncing');

    fetch(self._syncApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw
    })
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result && result.ok) {
          self._lastSyncTime = Date.now();
          self._setSyncStatus('synced');
        } else {
          self._setSyncStatus('error');
        }
      })
      .catch(function(err) {
        self._setSyncStatus('error');
        console.warn('Sync to server failed:', err);
      });
  },

  /** 防抖推送：写入后延迟 2 秒再推送，避免频繁请求 */
  _scheduleSync: function() {
    var self = this;
    if (self._syncDebounceTimer) clearTimeout(self._syncDebounceTimer);
    self._syncDebounceTimer = setTimeout(function() {
      self._syncToServer();
    }, self.SYNC_DEBOUNCE);
  },

  /** 启动定时同步 */
  _startPeriodicSync: function() {
    var self = this;
    if (self._syncTimer) clearInterval(self._syncTimer);
    self._syncTimer = setInterval(function() {
      if (!self._isSyncing && self._serverAvailable) {
        self._syncFromServer();
      }
    }, self.SYNC_INTERVAL);
  },

  /** 设置同步状态并通知回调 */
  _setSyncStatus: function(status) {
    this._syncStatus = status;
    this._syncCallbacks.forEach(function(cb) {
      try { cb(status); } catch (e) {}
    });
  },

  /** 注册同步状态变更回调 */
  onSyncStatusChange: function(callback) {
    this._syncCallbacks.push(callback);
    // 立即通知当前状态
    try { callback(this._syncStatus); } catch (e) {}
  },

  /** 获取同步状态 */
  getSyncStatus: function() {
    return {
      status: this._syncStatus,
      serverAvailable: this._serverAvailable,
      lastSyncTime: this._lastSyncTime,
      apiUrl: this._serverAvailable ? this._syncApiUrl : null
    };
  },

  /** 手动触发同步（用户点"立即同步"按钮时调用） */
  manualSync: function() {
    if (this._serverAvailable) {
      return this._syncFromServer().then(function() {
        return this._syncToServer();
      }.bind(this));
    }
    return Promise.resolve();
  },

  /** 通知 UI 数据已变更（触发页面重新渲染） */
  _notifyDataChange: function() {
    if (typeof Router !== 'undefined' && Router.handleHash) {
      try { Router.handleHash(); } catch (e) {}
    }
  },

  /** 确保超级管理员账号始终存在 */
  _ensureSuperadmin: async function() {
    var data = this._read();
    if (!data) return;
    var hasSuperadmin = (data.users || []).some(function(u) { return u.username === 'superadmin'; });
    if (!hasSuperadmin) {
      var hash = await hashPassword('123456');
      var superadmin = {
        id: (data.users || []).length > 0 ? Math.max.apply(null, data.users.map(function(u) { return u.id; })) + 1 : 1,
        username: 'superadmin',
        passwordHash: hash,
        displayName: '超级管理员',
        department: '系统',
        position: '',
        employeeId: '',
        role: 'super_admin',
        companyId: 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      data.users = (data.users || []).concat([superadmin]);
      this._write(data);
    }
  },

  /** 确保 projectApprovals 字段存在（向前兼容） */
  _ensureProjectApprovals: function() {
    var data = this._read();
    if (!data) return;
    if (!data.projectApprovals) {
      data.projectApprovals = [];
      this._write(data);
    }
  },

  /** 确保 projectNo 字段存在（向前兼容） */
  _ensureProjectNo: function() {
    var data = this._read();
    if (!data) return;
    var migrated = false;
    (data.projects || []).forEach(function(p) {
      if (!p.projectNo) {
        var year = (p.createdAt || '').slice(2, 4);
        if (!year || year.length < 2) year = String(new Date().getFullYear()).slice(2);
        var cid = p.companyId || 0;
        var sameCompany = (data.projects || []).filter(function(x) { return x.companyId === cid && x.id <= p.id; });
        var seq = sameCompany.length;
        p.projectNo = 'XM' + year + '-' + String(seq).padStart(4, '0');
        migrated = true;
      }
    });
    if (migrated) this._write(data);
  },

  /** 确保 isMilestone 字段存在（向前兼容） */
  _ensureMilestoneField: function() {
    var data = this._read();
    if (!data) return;
    var migrated = false;
    (data.todos || []).forEach(function(t) {
      if (t.isMilestone === undefined) { t.isMilestone = false; migrated = true; }
    });
    if (migrated) this._write(data);
  },

  _read() {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      // 数据迁移：将旧格式的字符串数组转为对象数组
      this._migrateData(data);
      return data;
    } catch (e) { return null; }
  },

  /** 数据迁移：旧版字符串格式 → 新版对象格式 */
  _migrateData: function(data) {
    if (!data) return;
    var migrated = false;
    (data.companies || []).forEach(function(c) {
      // 迁移 departments
      if (c.departments && c.departments.length > 0 && typeof c.departments[0] === 'string') {
        c.departments = c.departments.map(function(name, i) {
          return { id: i + 1, name: name, code: '' };
        });
        migrated = true;
      }
      // 迁移 personnel (旧字段名 staff)
      var personnel = c.personnel || c.staff;
      if (personnel && personnel.length > 0 && typeof personnel[0] === 'string') {
        c.personnel = personnel.map(function(name, i) {
          return { id: i + 1, name: name, position: '', employeeId: '', department: '', role: 'project_member' };
        });
        delete c.staff;
        migrated = true;
      } else if (c.staff && !c.personnel) {
        // 字段名迁移
        c.personnel = c.staff;
        delete c.staff;
      }
      // 迁移 consultants
      if (c.consultants && c.consultants.length > 0 && typeof c.consultants[0] === 'string') {
        c.consultants = c.consultants.map(function(name, i) {
          return { id: i + 1, name: name, title: '' };
        });
        migrated = true;
      }
      // 确保字段名统一
      if (!c.personnel && c.staff) { c.personnel = c.staff; delete c.staff; }
    });
    // 迁移 users — 添加新字段
    (data.users || []).forEach(function(u) {
      if (u.position === undefined) { u.position = ''; migrated = true; }
      if (u.employeeId === undefined) { u.employeeId = ''; migrated = true; }
    });
    // 迁移 companies — 添加新字段
    (data.companies || []).forEach(function(c) {
      if (c.address === undefined) { c.address = ''; migrated = true; }
      if (c.taxId === undefined) { c.taxId = ''; migrated = true; }
      if (c.website === undefined) { c.website = ''; migrated = true; }
    });
    // 迁移 notifications 和 operationLogs
    if (!data.notifications) { data.notifications = []; migrated = true; }
    if (!data.operationLogs) { data.operationLogs = []; migrated = true; }
    if (migrated) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }
  },

  _write(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    this._scheduleSync();  // 触发防抖推送到 NAS 服务器
  },

  _update(fn) {
    var data = this._read();
    if (!data) return;
    fn(data);
    this._write(data);
  },

  /* ========== 公司管理 ========== */

  getAllCompanies() {
    var data = this._read();
    return data ? (data.companies || []) : [];
  },

  getCompanyById(id) {
    return this.getAllCompanies().find(function(c) { return c.id === id; });
  },

  getCurrentCompany() {
    var data = this._read();
    if (!data || !data.currentCompanyId) return null;
    return (data.companies || []).find(function(c) { return c.id === data.currentCompanyId; }) || null;
  },

  getCurrentCompanyId() {
    var data = this._read();
    return data ? data.currentCompanyId : null;
  },

  setCurrentCompany(companyId) {
    this._update(function(data) { data.currentCompanyId = companyId; });
  },

  addCompany(company) {
    var self = this;
    return new Promise(function(resolve) {
      self._update(function(data) {
        if (!data.companies) data.companies = [];
        // 深拷贝默认数据，给新的ID
        var deptCopy = CONFIG.defaultDepartments.map(function(d) { return { id: d.id, name: d.name, code: d.code }; });
        var personnelCopy = CONFIG.defaultPersonnel.map(function(p) {
          return { id: data.companies.reduce(function(s,c) { return s + (c.personnel||[]).length; }, 0) + p.id, name: p.name, position: p.position, employeeId: p.employeeId, department: p.department, role: p.role };
        });
        var consultantCopy = CONFIG.defaultConsultants.map(function(c) { return { id: c.id, name: c.name, title: c.title }; });
        var newCompany = {
          id: data.companies.length > 0 ? Math.max.apply(null, data.companies.map(function(c) { return c.id; })) + 1 : 1,
          name: company.name,
          abbreviation: company.abbreviation || company.name,
          address: company.address || '',
          taxId: company.taxId || '',
          website: company.website || '',
          departments: deptCopy,
          personnel: personnelCopy,
          consultants: consultantCopy,
          createdAt: new Date().toISOString().split('T')[0]
        };
        data.companies.push(newCompany);
        resolve(newCompany);
      });
    });
  },

  updateCompany(id, updates) {
    this._update(function(data) {
      if (!data.companies) return;
      var idx = data.companies.findIndex(function(c) { return c.id === id; });
      if (idx >= 0) data.companies[idx] = Object.assign({}, data.companies[idx], updates);
    });
  },

  deleteCompany(id) {
    this._update(function(data) {
      data.companies = (data.companies || []).filter(function(c) { return c.id !== id; });
      data.users = (data.users || []).filter(function(u) { return u.companyId !== id; });
      data.projects = (data.projects || []).filter(function(p) { return p.companyId !== id; });
      data.todos = (data.todos || []).filter(function(t) { return t.companyId !== id; });
    });
  },

  /** 获取公司的部门列表（对象数组） */
  getCompanyDepts(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    var company = this.getCompanyById(cid);
    return company ? (company.departments || []) : CONFIG.defaultDepartments.slice();
  },

  /** 获取公司部门名称列表（用于select下拉） */
  getCompanyDeptNames(companyId) {
    return this.getCompanyDepts(companyId).map(function(d) { return d.name; });
  },

  /** 获取公司的人员列表（对象数组） */
  getCompanyPersonnel(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    var company = this.getCompanyById(cid);
    return company ? (company.personnel || company.staff || []) : CONFIG.defaultPersonnel.slice();
  },

  /**
   * 构建人员选择下拉框的 options HTML（从人员表+用户表融合）
   * @param {number} companyId - 公司ID
   * @param {string} roleFilter - 可选的角色过滤，如 'project_lead'
   * @param {object} opts - { placeholder, includeUsers }
   * @returns {string} options HTML 字符串
   */
  buildStaffOptions: function(companyId, roleFilter, opts) {
    opts = opts || {};
    var placeholder = opts.placeholder || '-- 请选择 --';
    var includeUsers = opts.includeUsers !== false;
    var html = '<option value="">' + placeholder + '</option>';
    var seenNames = {};
    var hasAny = false;

    // 1) 人员表（基础数据）
    var personnel = this.getCompanyPersonnel(companyId);
    var personnelHtml = '';
    personnel.forEach(function(p) {
      var name = p.name || (typeof p === 'string' ? p : '');
      if (!name || seenNames[name]) return;
      if (roleFilter && p.role !== roleFilter) return;
      seenNames[name] = true;
      hasAny = true;
      var info = '（' + (p.department || '') + (p.position ? ' ' + p.position : '') + '）';
      personnelHtml += '<option value="p_' + name.replace(/"/g, '&quot;') + '">' + name + info + '</option>';
    });

    // 2) 系统用户表（有账号的人员）
    if (includeUsers) {
      var users = this.getCompanyUsers(companyId);
      users.forEach(function(u) {
        if (roleFilter && u.role !== roleFilter) return;
        if (seenNames[u.displayName]) return; // 跳过已在人员表中的同名
        seenNames[u.displayName] = true;
        hasAny = true;
        personnelHtml += '<option value="u_' + u.id + '">' + u.displayName + '（有账号，' + (u.department || '') + '）</option>';
      });
    }

    html += personnelHtml;

    // 如果一个人都没有，显示提示
    if (!hasAny) {
      html += '<option value="" disabled style="color:var(--color-red)">⚠️ 暂无可用人员，请先在"基础数据→人员管理"中添加</option>';
    }

    return html;
  },

  /** 获取公司人员姓名列表（用于select下拉） */
  getCompanyPersonnelNames(companyId) {
    return this.getCompanyPersonnel(companyId).map(function(p) {
      return typeof p === 'string' ? p : p.name;
    });
  },

  /** 获取公司的顾问列表（对象数组） */
  getCompanyConsultants(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    var company = this.getCompanyById(cid);
    return company ? (company.consultants || []) : CONFIG.defaultConsultants.slice();
  },

  /** 获取公司顾问姓名列表 */
  getCompanyConsultantNames(companyId) {
    return this.getCompanyConsultants(companyId).map(function(c) {
      return typeof c === 'string' ? c : c.name;
    });
  },

  /** 更新公司的部门/人员/顾问 */
  updateCompanyResources(companyId, type, items) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (company) {
        if (type === 'staff' || type === 'personnel') {
          company.personnel = items; delete company.staff;
        } else {
          company[type] = items;
        }
      }
    });
  },

  /** 添加部门 */
  addCompanyDept: function(companyId, dept) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (!company) return;
      if (!company.departments) company.departments = [];
      var maxId = company.departments.reduce(function(m, d) { return Math.max(m, d.id || 0); }, 0);
      company.departments.push({ id: maxId + 1, name: dept.name, code: dept.code || '' });
    });
  },

  /** 更新部门 */
  updateCompanyDept: function(companyId, deptId, updates) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (!company || !company.departments) return;
      var dept = company.departments.find(function(d) { return d.id === deptId; });
      if (dept) Object.assign(dept, updates);
    });
  },

  /** 删除部门 */
  deleteCompanyDept: function(companyId, deptId) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (!company) return;
      company.departments = (company.departments || []).filter(function(d) { return d.id !== deptId; });
    });
  },

  /** 添加人员 */
  addCompanyPersonnel: function(companyId, person) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (!company) return;
      if (!company.personnel) company.personnel = [];
      var maxId = company.personnel.reduce(function(m, p) { return Math.max(m, p.id || 0); }, 0);
      company.personnel.push({
        id: maxId + 1,
        name: person.name,
        position: person.position || '',
        employeeId: person.employeeId || '',
        department: person.department || '',
        role: person.role || 'project_member'
      });
    });
  },

  /** 更新人员 */
  updateCompanyPersonnel: function(companyId, personId, updates) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (!company || !company.personnel) return;
      var person = company.personnel.find(function(p) { return p.id === personId; });
      if (person) Object.assign(person, updates);
    });
  },

  /** 删除人员 */
  deleteCompanyPersonnel: function(companyId, personId) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (!company) return;
      company.personnel = (company.personnel || []).filter(function(p) { return p.id !== personId; });
    });
  },

  /** 清空公司所有人员（覆盖导入用） */
  clearCompanyPersonnel: function(companyId) {
    this._update(function(data) {
      var company = (data.companies || []).find(function(c) { return c.id === companyId; });
      if (company) company.personnel = [];
    });
  },

  /** 扩展：getCompanyStaff（兼容旧代码） */
  getCompanyStaff: function(companyId) {
    return this.getCompanyPersonnelNames(companyId);
  },

  /* ========== 用户管理 ========== */

  getAllUsers() {
    var data = this._read();
    return data ? (data.users || []) : [];
  },

  getUserById(id) {
    return this.getAllUsers().find(function(u) { return u.id === id; });
  },

  getCurrentUser() {
    var data = this._read();
    if (!data || !data.currentUserId) return null;
    return (data.users || []).find(function(u) { return u.id === data.currentUserId; }) || null;
  },

  /** 获取当前公司下的用户 */
  getCompanyUsers(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    return this.getAllUsers().filter(function(u) { return u.companyId === cid; });
  },

  login(username, passwordHash, companyId) {
    var data = this._read();
    var user;
    // 超级管理员忽略公司选择，直接匹配
    if (username === 'superadmin' || username === 'super_admin') {
      user = (data.users || []).find(function(u) {
        return (u.username === 'superadmin' || u.role === 'super_admin') && u.passwordHash === passwordHash;
      });
    } else if (companyId) {
      user = (data.users || []).find(function(u) {
        return u.username === username && u.passwordHash === passwordHash && u.companyId === parseInt(companyId);
      });
    } else {
      user = (data.users || []).find(function(u) {
        return u.username === username && u.passwordHash === passwordHash;
      });
    }
    if (user) {
      data.currentUserId = user.id;
      if (user.role !== 'super_admin') data.currentCompanyId = user.companyId;
      this._write(data);
      return user;
    }
    return null;
  },

  logout() {
    this._update(function(data) {
      data.currentUserId = null;
      data.currentCompanyId = null;
      data.currentProjectId = null;
    });
  },

  register(userData) {
    var data = this._read();
    if (!data.users) data.users = [];
    // 全局用户名去重（不区分公司）
    if (data.users.find(function(u) { return u.username === userData.username; })) {
      return { error: '该用户名已被注册，请更换' };
    }
    // 自动分配公司：有指定用指定，否则用第一个公司，没有公司则创建默认公司
    var companyId = userData.companyId;
    if (!companyId) {
      if (data.companies && data.companies.length > 0) {
        companyId = data.companies[0].id;
      } else {
        // 自动创建默认公司
        if (!data.companies) data.companies = [];
        var deptCopy = CONFIG.defaultDepartments.map(function(d) { return { id: d.id, name: d.name, code: d.code }; });
        companyId = 1;
        data.companies.push({
          id: companyId, name: CONFIG.defaultCompanyName, abbreviation: CONFIG.defaultCompanyName,
          address: '', taxId: '', website: '', departments: deptCopy,
          personnel: [], consultants: [], createdAt: new Date().toISOString().split('T')[0]
        });
      }
    }
    var newUser = {
      id: data.users.length > 0 ? Math.max.apply(null, data.users.map(function(u) { return u.id; })) + 1 : 1,
      username: userData.username,
      passwordHash: userData.passwordHash,
      displayName: userData.displayName,
      department: userData.department || '',
      position: userData.position || '',
      employeeId: userData.employeeId || '',
      role: userData.role || 'project_member',
      companyId: companyId,
      createdAt: new Date().toISOString().split('T')[0]
    };
    data.users.push(newUser);
    if (userData.role !== 'super_admin') {
      data.currentCompanyId = companyId;
    }
    data.currentUserId = newUser.id;
    this._write(data);
    return { user: newUser };
  },

  /** 按用户名查找用户（全局唯一），用于登录时自动匹配公司 */
  findUserByUsername: function(username) {
    var data = this._read();
    if (!data || !data.users) return null;
    return data.users.find(function(u) { return u.username === username; }) || null;
  },

  /** 检查用户名是否全局唯一（注册时实时校验） */
  isUsernameTaken: function(username) {
    var data = this._read();
    if (!data || !data.users) return false;
    return data.users.some(function(u) { return u.username === username; });
  },

  addUser(userData) {
    var data = this._read();
    if (!data.users) data.users = [];
    // 全局用户名去重
    if (data.users.find(function(u) { return u.username === userData.username; })) {
      return { error: '该用户名已被注册，请更换' };
    }
    var newUser = {
      id: data.users.length > 0 ? Math.max.apply(null, data.users.map(function(u) { return u.id; })) + 1 : 1,
      username: userData.username,
      passwordHash: userData.passwordHash,
      displayName: userData.displayName,
      department: userData.department || '',
      position: userData.position || '',
      employeeId: userData.employeeId || '',
      role: userData.role || 'project_member',
      companyId: userData.companyId,
      createdAt: new Date().toISOString().split('T')[0]
    };
    data.users.push(newUser);
    this._write(data);
    return { user: newUser };
  },

  updateUser(id, updates) {
    this._update(function(data) {
      var idx = (data.users || []).findIndex(function(u) { return u.id === id; });
      if (idx >= 0) data.users[idx] = Object.assign({}, data.users[idx], updates);
    });
  },

  deleteUser(id) {
    this._update(function(data) {
      data.users = (data.users || []).filter(function(u) { return u.id !== id; });
      (data.projects || []).forEach(function(p) {
        p.memberIds = p.memberIds.filter(function(mid) { return mid !== id; });
      });
    });
  },

  /* ========== 项目管理 ========== */

  getAllProjects() { var data = this._read(); return data ? (data.projects || []) : []; },

  getProjectById(id) { return this.getAllProjects().find(function(p) { return p.id === id; }); },

  getCurrentProject() {
    var data = this._read();
    if (!data || !data.currentProjectId) return null;
    return (data.projects || []).find(function(p) { return p.id === data.currentProjectId; }) || null;
  },

  getCurrentProjectId() { var data = this._read(); return data ? data.currentProjectId : null; },

  setCurrentProject(projectId) { this._update(function(data) { data.currentProjectId = projectId; }); },

  /** 获取当前用户有权限查看的项目 */
  getMyProjects() {
    var user = this.getCurrentUser();
    var projects = this.getAllProjects();
    if (!user) return [];
    if (user.role === 'super_admin') return projects;
    if (user.role === 'admin' || user.role === 'lean_office' || user.role === 'leader' || user.role === 'consultant') {
      return projects.filter(function(p) { return p.companyId === user.companyId; });
    }
    // project_lead: 返回公司全部项目（项目经理需要查看和管理公司所有项目）
    if (user.role === 'project_lead') {
      return projects.filter(function(p) { return p.companyId === user.companyId; });
    }
    // project_member: 返回公司全部项目（项目成员需要查看公司所有项目的待办和周报）
    return projects.filter(function(p) { return p.companyId === user.companyId; });
  },

  /** 获取当前公司下的项目 */
  getCompanyProjects(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    return this.getAllProjects().filter(function(p) { return p.companyId === cid; });
  },

  /** 生成项目编号: XM{年}-{公司内序号,4位} */
  _generateProjectNo: function(companyId) {
    var data = this._read();
    var year = String(new Date().getFullYear()).slice(2);
    var companyProjects = (data.projects || []).filter(function(p) { return p.companyId === companyId; });
    var seq = companyProjects.length + 1;
    return 'XM' + year + '-' + String(seq).padStart(4, '0');
  },

  addProject(project) {
    var user = this.getCurrentUser();
    var self = this;
    return new Promise(function(resolve) {
      self._update(function(data) {
        if (!data.projects) data.projects = [];
        var companyId = project.companyId || user.companyId;
        var projectNo = self._generateProjectNo(companyId);
        var newProject = {
          id: data.projects.length > 0 ? Math.max.apply(null, data.projects.map(function(p) { return p.id; })) + 1 : 1,
          projectNo: projectNo,
          name: project.name,
          description: project.description || '',
          manager: project.manager || '',
          leader: project.leader || '',
          startDate: project.startDate || '',
          initiatorId: user.id,
          memberIds: [user.id],
          companyId: companyId,
          createdAt: new Date().toISOString().split('T')[0]
        };
        data.projects.push(newProject);
        data.currentProjectId = newProject.id;
        resolve(newProject);
      });
    });
  },

  updateProject(id, updates) {
    this._update(function(data) {
      var idx = (data.projects || []).findIndex(function(p) { return p.id === id; });
      if (idx >= 0) data.projects[idx] = Object.assign({}, data.projects[idx], updates);
    });
  },

  /** 获取项目里程碑统计 */
  getMilestoneStats: function(projectId) {
    var todos = this.getProjectTodos(projectId).filter(function(t) { return t.status !== '已删除' && t.isMilestone; });
    var total = todos.length;
    var completed = todos.filter(function(t) { return t.status === '已完成'; }).length;
    return {
      total: total,
      completed: completed,
      pending: total - completed,
      completionRate: total > 0 ? (completed / total * 100) : 0,
      items: todos
    };
  },

  deleteProject(id) {
    this._update(function(data) {
      data.projects = (data.projects || []).filter(function(p) { return p.id !== id; });
      data.todos = (data.todos || []).filter(function(t) { return t.projectId !== id; });
      if (data.currentProjectId === id) {
        data.currentProjectId = data.projects.length > 0 ? data.projects[0].id : null;
      }
    });
  },

  /* ===== 项目审批（结案/删除需高管审核） ===== */

  /** 发起项目操作审批请求 */
  requestProjectAction(projectId, actionType) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var user = self.getCurrentUser();
      if (!user) return reject('请先登录');
      var project = self.getProjectById(projectId);
      if (!project) return reject('项目不存在');
      if (project.closed) return reject('该项目已结案，无法操作');

      // 检查是否已有待审批的同类请求
      var data = self._read();
      var existing = (data.projectApprovals || []).find(function(a) {
        return a.projectId === projectId && a.actionType === actionType && a.status === 'pending';
      });
      if (existing) return reject('该项目已有待审批的' + (actionType === 'close' ? '结案' : '删除') + '申请，请等待审批');

      self._update(function(d) {
        if (!d.projectApprovals) d.projectApprovals = [];
        var newId = d.projectApprovals.length > 0 ? Math.max.apply(null, d.projectApprovals.map(function(a) { return a.id; })) + 1 : 1;
        var approval = {
          id: newId,
          projectId: projectId,
          projectName: project.name,
          actionType: actionType,   // 'close' | 'delete'
          requestedBy: user.id,
          requestedByName: user.displayName,
          requestedAt: new Date().toISOString(),
          status: 'pending',
          reviewedBy: '',
          reviewedAt: '',
          rejectedReason: '',
          companyId: project.companyId
        };
        d.projectApprovals.push(approval);
        // 添加日志
        if (!d.operationLogs) d.operationLogs = [];
        d.operationLogs.push({
          id: d.operationLogs.length + 1,
          userId: user.id,
          userName: user.displayName,
          action: 'request',
          target: 'project',
          targetId: projectId,
          targetName: project.name,
          detail: '申请项目' + (actionType === 'close' ? '结案' : '删除') + '（待高管审批）',
          createdAt: new Date().toISOString()
        });
        // 通知所有高管（leader / super_admin）
        var actionLabel = actionType === 'close' ? '结案' : '删除';
        var leaders = (d.users || []).filter(function(u) {
          return u.companyId === project.companyId && (u.role === 'leader' || u.role === 'super_admin');
        });
        if (!d.notifications) d.notifications = [];
        leaders.forEach(function(leader) {
          d.notifications.push({
            id: d.notifications.length > 0 ? Math.max.apply(null, d.notifications.map(function(x) { return x.id; })) + 1 : 1,
            fromUserId: user.id,
            fromUserName: user.displayName,
            toUserId: leader.id,
            type: 'project_approval',
            title: '项目' + actionLabel + '审批',
            message: user.displayName + ' 申请对项目「' + project.name + '」进行' + actionLabel + '，请前往审批',
            projectId: projectId,
            projectName: project.name,
            todoId: null,
            todoSubject: '',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        resolve(approval);
      });
    });
  },

  /** 获取项目审批列表 */
  getPendingProjectApprovals(filter) {
    var data = this._read();
    var companyId = this.getCurrentCompanyId();
    var all = (data.projectApprovals || []).filter(function(a) {
      return a.companyId === companyId;
    });
    // 需要刷新项目名称（可能已改名）
    all.forEach(function(a) {
      var p = (data.projects || []).find(function(x) { return x.id === a.projectId; });
      if (p) a.projectName = p.name;
    });
    if (!filter || filter === 'all') return all;
    return all.filter(function(a) { return a.status === filter; });
  },

  /** 审批通过 — 执行对应的项目操作 */
  approveProjectAction(requestId) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var user = self.getCurrentUser();
      if (!user) return reject('请先登录');
      var data = self._read();
      var approval = (data.projectApprovals || []).find(function(a) { return a.id === requestId; });
      if (!approval) return reject('审批记录不存在');
      if (approval.status !== 'pending') return reject('该审批已处理');

      // 更新审批状态
      self._update(function(d) {
        var a = (d.projectApprovals || []).find(function(x) { return x.id === requestId; });
        if (!a) return;
        a.status = 'approved';
        a.reviewedBy = user.displayName;
        a.reviewedAt = new Date().toISOString();

        if (a.actionType === 'delete') {
          // 执行删除
          d.projects = (d.projects || []).filter(function(p) { return p.id !== a.projectId; });
          d.todos = (d.todos || []).filter(function(t) { return t.projectId !== a.projectId; });
          if (d.currentProjectId === a.projectId) {
            d.currentProjectId = d.projects.length > 0 ? d.projects[0].id : null;
          }
        } else if (a.actionType === 'close') {
          // 执行结案
          var proj = (d.projects || []).find(function(p) { return p.id === a.projectId; });
          if (proj) proj.closed = true;
        }
        // 日志
        if (!d.operationLogs) d.operationLogs = [];
        d.operationLogs.push({
          id: d.operationLogs.length + 1,
          userId: user.id,
          userName: user.displayName,
          action: 'approve',
          target: 'project',
          targetId: a.projectId,
          targetName: a.projectName,
          detail: '审批通过：项目' + (a.actionType === 'close' ? '结案' : '删除'),
          createdAt: new Date().toISOString()
        });
        // 通知发起人
        if (!d.notifications) d.notifications = [];
        d.notifications.push({
          id: d.notifications.length > 0 ? Math.max.apply(null, d.notifications.map(function(x) { return x.id; })) + 1 : 1,
          fromUserId: user.id,
          fromUserName: user.displayName,
          toUserId: a.requestedBy,
          type: 'project_approval_result',
          title: '项目' + (a.actionType === 'close' ? '结案' : '删除') + '审批通过',
          message: '你对项目「' + a.projectName + '」的' + (a.actionType === 'close' ? '结案' : '删除') + '申请已通过审批',
          projectId: a.projectId,
          projectName: a.projectName,
          todoId: null,
          todoSubject: '',
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        resolve();
      });
    });
  },

  /** 审批驳回 */
  rejectProjectAction(requestId, reason) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var user = self.getCurrentUser();
      if (!user) return reject('请先登录');
      self._update(function(d) {
        var a = (d.projectApprovals || []).find(function(x) { return x.id === requestId; });
        if (!a) return reject('审批记录不存在');
        if (a.status !== 'pending') return reject('该审批已处理');
        a.status = 'rejected';
        a.reviewedBy = user.displayName;
        a.reviewedAt = new Date().toISOString();
        a.rejectedReason = reason || '未说明原因';
        // 日志
        if (!d.operationLogs) d.operationLogs = [];
        d.operationLogs.push({
          id: d.operationLogs.length + 1,
          userId: user.id,
          userName: user.displayName,
          action: 'reject',
          target: 'project',
          targetId: a.projectId,
          targetName: a.projectName,
          detail: '驳回项目' + (a.actionType === 'close' ? '结案' : '删除') + '申请：' + (reason || '未说明原因'),
          createdAt: new Date().toISOString()
        });
        // 通知发起人
        if (!d.notifications) d.notifications = [];
        d.notifications.push({
          id: d.notifications.length > 0 ? Math.max.apply(null, d.notifications.map(function(x) { return x.id; })) + 1 : 1,
          fromUserId: user.id,
          fromUserName: user.displayName,
          toUserId: a.requestedBy,
          type: 'project_approval_result',
          title: '项目' + (a.actionType === 'close' ? '结案' : '删除') + '申请被驳回',
          message: '你对项目「' + a.projectName + '」的' + (a.actionType === 'close' ? '结案' : '删除') + '申请已被驳回：' + (reason || '未说明原因'),
          projectId: a.projectId,
          projectName: a.projectName,
          todoId: null,
          todoSubject: '',
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        resolve();
      });
    });
  },

  getProjectMembers(projectId) {
    var project = this.getProjectById(projectId);
    if (!project) return [];
    var users = this.getAllUsers();
    return project.memberIds.map(function(mid) { return users.find(function(u) { return u.id === mid; }); }).filter(Boolean);
  },

  addProjectMember(projectId, userId) {
    this._update(function(data) {
      var project = (data.projects || []).find(function(p) { return p.id === projectId; });
      if (project && !project.memberIds.includes(userId)) project.memberIds.push(userId);
    });
  },

  removeProjectMember(projectId, userId) {
    this._update(function(data) {
      var project = (data.projects || []).find(function(p) { return p.id === projectId; });
      if (project && userId !== project.initiatorId) {
        project.memberIds = project.memberIds.filter(function(mid) { return mid !== userId; });
      }
    });
  },

  /* ========== 待办管理 ========== */

  getAllTodos() { var data = this._read(); return data ? (data.todos || []) : []; },

  getProjectTodos(projectId) {
    var pid = projectId || this.getCurrentProjectId();
    if (!pid) return [];
    return this.getAllTodos().filter(function(t) { return t.projectId === pid; });
  },

  getTodoById(id) { return this.getAllTodos().find(function(t) { return t.id === parseInt(id); }); },

  /** 获取项目下最大待办序号 */
  _getProjectTodoSeq(projectId) {
    var todos = this.getAllTodos().filter(function(t) { return t.projectId === projectId; });
    if (todos.length === 0) return 0;
    // 从todoUid解析最大序号
    var maxSeq = 0;
    todos.forEach(function(t) {
      if (t.todoUid) {
        var match = t.todoUid.match(/-T(\d+)$/);
        if (match) {
          var seq = parseInt(match[1]);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    });
    return maxSeq;
  },

  /** 确保 milestone 字段存在（向前兼容） */
  _ensureMilestoneField: function() {
    var data = this._read();
    if (!data) return;
    var migrated = false;
    (data.todos || []).forEach(function(t) {
      if (t.isMilestone === undefined) { t.isMilestone = false; migrated = true; }
    });
    if (migrated) this._write(data);
  },

  /** 确保 extensionRequests 字段存在（向前兼容） */
  _ensureExtensionRequests: function() {
    var data = this._read();
    if (!data) return;
    if (!data.extensionRequests) {
      data.extensionRequests = [];
      this._write(data);
    }
  },

  /** 确保 weeklyReports 字段存在（向前兼容） */
  _ensureWeeklyReports: function() {
    var data = this._read();
    if (!data) return;
    if (!data.weeklyReports) {
      data.weeklyReports = [];
      this._write(data);
    }
  },

  /* ==================== 延期申请 ==================== */

  /** 获取所有延期申请 */
  getAllExtensionRequests: function() {
    var data = this._read();
    return data ? (data.extensionRequests || []) : [];
  },

  /** 获取项目/公司的延期申请 */
  getExtensionRequests: function(projectId, companyId) {
    var all = this.getAllExtensionRequests();
    if (projectId) return all.filter(function(r) { return r.projectId === projectId; });
    if (companyId) return all.filter(function(r) { return r.companyId === companyId; });
    return all;
  },

  /** 提交延期申请（项目办成员） */
  submitExtensionRequest: function(todoId, newDeadline, reason, countermeasure) {
    var self = this;
    var user = this.getCurrentUser();
    if (!user) return Promise.reject('请先登录');
    if (user.role !== 'lean_office') return Promise.reject('只有项目办成员可以提交延期申请');

    var todo = this.getTodoById(todoId);
    if (!todo) return Promise.reject('待办不存在');

    return new Promise(function(resolve, reject) {
      // 检查是否已有待审批的延期申请
      var existing = self.getAllExtensionRequests().find(function(r) {
        return r.todoId === todoId && r.status === 'pending';
      });
      if (existing) return reject('该待办已有待审批的延期申请');

      self._update(function(data) {
        if (!data.extensionRequests) data.extensionRequests = [];
        var newId = data.extensionRequests.length > 0
          ? Math.max.apply(null, data.extensionRequests.map(function(r) { return r.id; })) + 1 : 1;
        var req = {
          id: newId,
          todoId: todoId,
          todoUid: todo.todoUid,
          todoSubject: todo.subject,
          projectId: todo.projectId,
          companyId: todo.companyId,
          originalDeadline: todo.deadline,
          requestedDeadline: newDeadline,
          reason: reason || '',
          countermeasure: countermeasure || '',
          requestedBy: user.id,
          requestedByName: user.displayName,
          requestedAt: new Date().toISOString(),
          reviewedBy: '',
          reviewedByName: '',
          reviewedAt: '',
          confirmerId: null,
          confirmerName: '',
          rejectedReason: '',
          status: 'pending'
        };
        data.extensionRequests.push(req);

        // 记录日志
        if (!data.operationLogs) data.operationLogs = [];
        data.operationLogs.push({
          id: data.operationLogs.length + 1,
          userId: user.id, userName: user.displayName,
          action: 'request_extension', target: 'todo',
          targetId: todoId, targetName: todo.subject,
          detail: '提交延期申请：原期限 ' + todo.deadline + ' → ' + newDeadline,
          createdAt: new Date().toISOString()
        });

        // 通知项目经理
        var project = self.getProjectById(todo.projectId);
        var pmName = (project && project.manager) ? project.manager : '';
        var managers = (data.users || []).filter(function(u) {
          return u.companyId === todo.companyId && u.role === 'project_lead';
        });
        if (!data.notifications) data.notifications = [];
        managers.forEach(function(mgr) {
          data.notifications.push({
            id: data.notifications.length > 0 ? Math.max.apply(null, data.notifications.map(function(x) { return x.id; })) + 1 : 1,
            fromUserId: user.id, fromUserName: user.displayName,
            toUserId: mgr.id, type: 'extension_request',
            title: '待办延期审批',
            message: user.displayName + ' 为待办「' + todo.subject + '」（' + todo.todoUid + '）申请延期至 ' + newDeadline + '，请审批',
            projectId: todo.projectId, projectName: (project && project.name) || '',
            todoId: todoId, todoSubject: todo.subject,
            status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        });
        resolve(req);
      });
    });
  },

  /** 审批延期申请（项目经理） */
  approveExtension: function(requestId, confirmerId, confirmerName) {
    var self = this;
    var user = this.getCurrentUser();
    if (!user) return Promise.reject('请先登录');

    return new Promise(function(resolve, reject) {
      self._update(function(data) {
        var req = (data.extensionRequests || []).find(function(r) { return r.id === requestId; });
        if (!req) return reject('延期记录不存在');
        if (req.status !== 'pending') return reject('该申请已处理');

        req.status = 'approved';
        req.reviewedBy = user.id;
        req.reviewedByName = user.displayName;
        req.reviewedAt = new Date().toISOString();
        req.confirmerId = confirmerId || null;
        req.confirmerName = confirmerName || user.displayName;

        // 更新待办期限
        var todo = (data.todos || []).find(function(t) { return t.id === req.todoId; });
        if (todo) {
          todo.deadline = req.requestedDeadline;
          todo.status = self.calcStatus(todo);
          todo.updatedAt = new Date().toISOString();
          // 更新延期记录字段
          todo.delayRecord = '已延期至 ' + req.requestedDeadline + '（审批人：' + (confirmerName || user.displayName) + '）';
          todo.delayReason = req.reason;
          todo.delayMeasure = req.countermeasure;
        }

        // 记录日志
        if (!data.operationLogs) data.operationLogs = [];
        data.operationLogs.push({
          id: data.operationLogs.length + 1,
          userId: user.id, userName: user.displayName,
          action: 'approve_extension', target: 'todo',
          targetId: req.todoId, targetName: req.todoSubject,
          detail: '审批通过延期申请：原期限 ' + req.originalDeadline + ' → ' + req.requestedDeadline,
          createdAt: new Date().toISOString()
        });

        // 通知申请人
        if (!data.notifications) data.notifications = [];
        data.notifications.push({
          id: data.notifications.length > 0 ? Math.max.apply(null, data.notifications.map(function(x) { return x.id; })) + 1 : 1,
          fromUserId: user.id, fromUserName: user.displayName,
          toUserId: req.requestedBy, type: 'extension_result',
          title: '延期申请已通过',
          message: '待办「' + req.todoSubject + '」的延期申请已通过，新期限：' + req.requestedDeadline,
          projectId: req.projectId, projectName: '',
          todoId: req.todoId, todoSubject: req.todoSubject,
          status: 'confirmed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        resolve();
      });
    });
  },

  /** 驳回延期申请 */
  rejectExtension: function(requestId, reason) {
    var self = this;
    var user = this.getCurrentUser();
    if (!user) return Promise.reject('请先登录');

    return new Promise(function(resolve, reject) {
      self._update(function(data) {
        var req = (data.extensionRequests || []).find(function(r) { return r.id === requestId; });
        if (!req) return reject('延期记录不存在');
        if (req.status !== 'pending') return reject('该申请已处理');

        req.status = 'rejected';
        req.reviewedBy = user.id;
        req.reviewedByName = user.displayName;
        req.reviewedAt = new Date().toISOString();
        req.rejectedReason = reason || '未说明原因';

        // 记录日志
        if (!data.operationLogs) data.operationLogs = [];
        data.operationLogs.push({
          id: data.operationLogs.length + 1,
          userId: user.id, userName: user.displayName,
          action: 'reject_extension', target: 'todo',
          targetId: req.todoId, targetName: req.todoSubject,
          detail: '驳回延期申请：' + (reason || '未说明原因'),
          createdAt: new Date().toISOString()
        });

        // 通知申请人
        if (!data.notifications) data.notifications = [];
        data.notifications.push({
          id: data.notifications.length > 0 ? Math.max.apply(null, data.notifications.map(function(x) { return x.id; })) + 1 : 1,
          fromUserId: user.id, fromUserName: user.displayName,
          toUserId: req.requestedBy, type: 'extension_result',
          title: '延期申请被驳回',
          message: '待办「' + req.todoSubject + '」的延期申请已被驳回：' + (reason || '未说明原因'),
          projectId: req.projectId, projectName: '',
          todoId: req.todoId, todoSubject: req.todoSubject,
          status: 'confirmed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        resolve();
      });
    });
  },

  /* ==================== 项目周报 ==================== */

  /** 获取所有周报 */
  getAllWeeklyReports: function() {
    var data = this._read();
    return data ? (data.weeklyReports || []) : [];
  },

  /** 获取项目的周报列表 */
  getProjectWeeklyReports: function(projectId) {
    return this.getAllWeeklyReports().filter(function(r) { return r.projectId === projectId; });
  },

  /** 计算本周的起止日期（周一~周日） */
  _getWeekBounds: function() {
    var now = new Date();
    var dayOfWeek = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return {
      monday: monday, sunday: sunday,
      mondayStr: formatDate(monday), sundayStr: formatDate(sunday)
    };
  },

  /** 生成周报自动填充数据 */
  generateWeeklyReportData: function(projectId) {
    var project = this.getProjectById(projectId);
    var todos = this.getProjectTodos(projectId).filter(function(t) { return t.status !== '已删除'; });
    var now = new Date();

    // 计算本周起止日期（周一 ~ 周日）
    var dayOfWeek = now.getDay();
    var monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    var mondayStr = formatDate(monday);
    var sundayStr = formatDate(sunday);

    // 本周新提出
    var newThisWeek = todos.filter(function(t) {
      var d = t.proposedDate || '';
      return d >= mondayStr && d <= sundayStr;
    });

    // 本周完成
    var completedThisWeek = todos.filter(function(t) {
      return t.status === '已完成' && t.actualDate && t.actualDate >= mondayStr && t.actualDate <= sundayStr;
    });

    // 逾期未完成
    var overdue = todos.filter(function(t) { return t.status === '过期'; });

    // 期限内
    var withinDeadline = todos.filter(function(t) { return t.status === '期限内'; });

    // 总完成率
    var completed = todos.filter(function(t) { return t.status === '已完成'; });
    var completionRate = todos.length > 0 ? (completed.length / todos.length * 100).toFixed(1) : '0.0';

    // 里程碑统计
    var milestones = todos.filter(function(t) { return t.isMilestone; });
    var milestoneCompleted = milestones.filter(function(t) { return t.status === '已完成'; });
    var milestoneRate = milestones.length > 0 ? (milestoneCompleted.length / milestones.length * 100).toFixed(1) : '0.0';

    // 部门维度统计
    var deptStats = {};
    todos.forEach(function(t) {
      var dept = t.leadDepartment || '未分配';
      if (!deptStats[dept]) deptStats[dept] = { dept: dept, total: 0, completed: 0, newCount: 0 };
      deptStats[dept].total++;
      if (t.status === '已完成') deptStats[dept].completed++;
    });
    newThisWeek.forEach(function(t) {
      var dept = t.leadDepartment || '未分配';
      if (deptStats[dept]) deptStats[dept].newCount++;
    });

    // 上周完成（用于环比）
    var lastMonday = new Date(monday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    var lastSunday = new Date(sunday);
    lastSunday.setDate(lastSunday.getDate() - 7);
    var lastMondayStr = formatDate(lastMonday);
    var lastSundayStr = formatDate(lastSunday);
    var lastWeekCompleted = todos.filter(function(t) {
      return t.status === '已完成' && t.actualDate && t.actualDate >= lastMondayStr && t.actualDate <= lastSundayStr;
    }).length;
    var weekDiff = lastWeekCompleted > 0 ? ((completedThisWeek.length - lastWeekCompleted) / lastWeekCompleted * 100).toFixed(0) : (completedThisWeek.length > 0 ? 100 : 0);

    return {
      projectId: projectId,
      projectName: (project && project.name) || '',
      projectNo: (project && project.projectNo) || '',
      projectManager: (project && project.manager) || '',
      weekStart: mondayStr,
      weekEnd: sundayStr,
      weekLabel: mondayStr + ' ~ ' + sundayStr,
      generatedAt: now.toISOString(),

      // 自动统计数据
      totalTodos: todos.length,
      newThisWeek: newThisWeek.length,
      completedThisWeek: completedThisWeek.length,
      lastWeekCompleted: lastWeekCompleted,
      completedTotal: completed.length,
      completionRate: completionRate,
      overdueCount: overdue.length,
      withinDeadlineCount: withinDeadline.length,
      weekDiff: weekDiff,
      milestoneTotal: milestones.length,
      milestoneCompleted: milestoneCompleted.length,
      milestoneRate: milestoneRate,

      // 自动列表
      newList: newThisWeek.map(function(t) {
        return { todoUid: t.todoUid, subject: t.subject, owner: t.primaryOwner, dept: t.leadDepartment, deadline: t.deadline, importance: t.importance };
      }),
      completedList: completedThisWeek.map(function(t) {
        return { todoUid: t.todoUid, subject: t.subject, owner: t.primaryOwner, dept: t.leadDepartment, actualDate: t.actualDate || '' };
      }),
      overdueList: overdue.map(function(t) {
        var dl = new Date(t.deadline);
        var days = Math.floor((now - dl) / (1000 * 60 * 60 * 24));
        return { todoUid: t.todoUid, subject: t.subject, owner: t.primaryOwner, dept: t.leadDepartment, deadline: t.deadline, daysOverdue: days };
      }),
      milestoneList: milestones.map(function(t) {
        return { todoUid: t.todoUid, subject: t.subject, status: t.status, deadline: t.deadline, owner: t.primaryOwner };
      }),
      deptStats: Object.values(deptStats).sort(function(a, b) {
        var rateA = a.total > 0 ? (a.completed / a.total * 100) : 0;
        var rateB = b.total > 0 ? (b.completed / b.total * 100) : 0;
        return rateB - rateA;
      })
    };
  },

  /** 保存周报并推送 */
  submitWeeklyReport: function(projectId, reportData) {
    var self = this;
    var user = this.getCurrentUser();
    if (!user) return Promise.reject('请先登录');

    // 检查本周是否已有周报
    var existing = this.getProjectWeeklyReports(projectId);
    var thisWeek = this._getWeekBounds();
    var alreadyExists = existing.some(function(r) {
      return r.weekStart === thisWeek.mondayStr && r.weekEnd === thisWeek.sundayStr;
    });
    if (alreadyExists) {
      return Promise.reject('该项目本周已提交过周报，每周仅需提交一次');
    }

    return new Promise(function(resolve) {
      self._update(function(data) {
        if (!data.weeklyReports) data.weeklyReports = [];
        var newId = data.weeklyReports.length > 0
          ? Math.max.apply(null, data.weeklyReports.map(function(r) { return r.id; })) + 1 : 1;

        var report = {
          id: newId,
          projectId: projectId,
          companyId: reportData.companyId,
          projectName: reportData.projectName,
          projectNo: reportData.projectNo,
          projectManager: reportData.projectManager,
          weekStart: reportData.weekStart,
          weekEnd: reportData.weekEnd,
          weekLabel: reportData.weekLabel,

          // 统计数据（自动填充的快照）
          totalTodos: reportData.totalTodos,
          newThisWeek: reportData.newThisWeek,
          completedThisWeek: reportData.completedThisWeek,
          lastWeekCompleted: reportData.lastWeekCompleted,
          completedTotal: reportData.completedTotal,
          completionRate: reportData.completionRate,
          overdueCount: reportData.overdueCount,
          withinDeadlineCount: reportData.withinDeadlineCount,
          weekDiff: reportData.weekDiff,
          milestoneTotal: reportData.milestoneTotal,
          milestoneCompleted: reportData.milestoneCompleted,
          milestoneRate: reportData.milestoneRate,

          // 自动列表
          newList: reportData.newList || [],
          completedList: reportData.completedList || [],
          overdueList: reportData.overdueList || [],
          milestoneList: reportData.milestoneList || [],
          deptStats: reportData.deptStats || [],

          // 项目办手动填写
          keyAchievements: reportData.keyAchievements || '',
          nextWeekPlan: reportData.nextWeekPlan || '',
          risksAndIssues: reportData.risksAndIssues || '',
          needSupport: reportData.needSupport || '',
          additionalNotes: reportData.additionalNotes || '',

          authorId: user.id,
          authorName: user.displayName,
          authorRole: user.role,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        data.weeklyReports.push(report);

        // 记录日志
        if (!data.operationLogs) data.operationLogs = [];
        data.operationLogs.push({
          id: data.operationLogs.length + 1,
          userId: user.id, userName: user.displayName,
          action: 'submit_weekly_report', target: 'project',
          targetId: projectId, targetName: reportData.projectName,
          detail: '提交项目周报：' + reportData.weekLabel,
          createdAt: new Date().toISOString()
        });

        // 推送给所有有账号的项目组成员+高管+顾问（排除发送者自己）
        var allUsers = (data.users || []).filter(function(u) {
          return u.companyId === reportData.companyId && u.id !== user.id;
        });
        if (!data.notifications) data.notifications = [];
        var nextNotifId = data.notifications.length > 0
          ? Math.max.apply(null, data.notifications.map(function(x) { return x.id; })) : 0;
        allUsers.forEach(function(u) {
          nextNotifId++;
          data.notifications.push({
            id: nextNotifId,
            fromUserId: user.id, fromUserName: user.displayName,
            toUserId: u.id, type: 'weekly_report',
            title: '项目周报：' + reportData.projectName,
            message: '「' + reportData.projectName + '」项目周报（' + reportData.weekLabel + '）已发布\n完成率：' + reportData.completionRate + '% | 本周完成：' + reportData.completedThisWeek + '项 | 逾期：' + reportData.overdueCount + '项。请查阅详情。',
            projectId: projectId, projectName: reportData.projectName,
            todoId: null, todoSubject: '',
            status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        });
        resolve(report);
      });
    });
  },

  addTodo(item) {
    var self = this;
    return new Promise(function(resolve) {
      self._update(function(data) {
        if (!data.todos) data.todos = [];
        var projectId = item.projectId || data.currentProjectId;
        var seq = self._getProjectTodoSeq(projectId) + 1;
        item.id = data.todos.length > 0 ? Math.max.apply(null, data.todos.map(function(t) { return t.id; })) + 1 : 1;
        item.todoUid = generateTodoUid(projectId, seq);
        item.no = data.todos.filter(function(t) { return t.projectId === projectId; }).length + 1;
        item.projectId = projectId;
        item.companyId = item.companyId || (self.getProjectById(projectId) ? self.getProjectById(projectId).companyId : null);
        item.evidenceStatus = item.evidenceStatus || '';
        item.evidenceFiles = item.evidenceFiles || [];
        item.evidenceFolder = 'PRJ' + String(projectId).padStart(3, '0') + '/' + item.todoUid + '/';
        item.closerNotes = item.closerNotes || '';
        item.closerId = null;
        item.closerConfirmedBy = '';
        item.closerRejectedReason = '';
        item.isMilestone = item.isMilestone || false;
        item.createdAt = new Date().toISOString();
        item.updatedAt = new Date().toISOString();
        if (!item.status) item.status = self.calcStatus(item);
        data.todos.push(item);
        resolve(item);
      });
    });
  },

  updateTodo(id, updates) {
    var self = this;
    return new Promise(function(resolve) {
      self._update(function(data) {
        var idx = (data.todos || []).findIndex(function(t) { return t.id === parseInt(id); });
        if (idx >= 0) {
          data.todos[idx] = Object.assign({}, data.todos[idx], updates, { updatedAt: new Date().toISOString() });
          data.todos[idx].status = self.calcStatus(data.todos[idx]);
          resolve(data.todos[idx]);
        } else resolve(null);
      });
    });
  },

  deleteTodo(id) { return this.updateTodo(id, { status: '已删除' }); },

  /** 提交完成情况描述（结构化字段：发送日期、接收人、项目经理、文件名称、补充说明） */
  uploadEvidence(todoId, data) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var todo = self.getTodoById(todoId);
      if (!todo) return reject('待办不存在');
      if (!data.sendDate) return reject('请选择发送日期');
      if (!data.sendTo) return reject('请选择发送给项目办的成员');
      if (!data.sendToPM) return reject('请选择推送审核的项目经理');
      if (!data.fileName) return reject('请填写待办文件名称');

      var user = self.getCurrentUser();
      self.updateTodo(todoId, {
        completionSendDate: data.sendDate,
        completionSendTo: data.sendTo.trim(),
        completionSendToPM: data.sendToPM.trim(),
        completionFileName: data.fileName.trim(),
        completionDesc: (data.note || '').trim(),
        completionSubmittedBy: (user || {}).displayName || '未知',
        completionSubmittedAt: new Date().toISOString(),
        evidenceStatus: 'uploaded'
      }).then(function() {
        // 通知项目经理和项目办 — 有待办完成描述需审核
        self._update(function(d) {
          if (!d.notifications) d.notifications = [];
          var project = self.getProjectById(todo.projectId);
          var projectName = project ? project.name : '未知项目';
          var subject = todo.subject || '未知待办';
          var submitterName = (user || {}).displayName || '未知';
          var msg = '「' + subject + '」(' + todo.todoUid + ')已提交完成描述\n提交人：' + submitterName + ' | 项目：' + projectName + '\n请及时审核。';

          // 通知所有项目办成员
          var leanOfficeUsers = (d.users || []).filter(function(u) {
            return u.companyId === todo.companyId && u.role === 'lean_office';
          });
          // 通知选中的项目经理（通过姓名匹配）
          var pmUser = (d.users || []).find(function(u) {
            return u.companyId === todo.companyId && u.role === 'project_lead' && u.displayName === data.sendToPM.trim();
          });
          // 去重合并
          var notifyUsers = leanOfficeUsers.slice();
          if (pmUser && !notifyUsers.some(function(u) { return u.id === pmUser.id; })) {
            notifyUsers.push(pmUser);
          }

          var nextId = d.notifications.length > 0
            ? Math.max.apply(null, d.notifications.map(function(x) { return x.id; })) : 0;

          notifyUsers.forEach(function(u) {
            nextId++;
            d.notifications.push({
              id: nextId,
              fromUserId: user ? user.id : 0, fromUserName: submitterName,
              toUserId: u.id, type: 'evidence_uploaded',
              title: '待办完成描述待审核：' + subject,
              message: msg,
              projectId: todo.projectId, projectName: projectName,
              todoId: todoId, todoSubject: subject,
              status: 'pending',
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            });
          });
        });
        resolve();
      }).catch(reject);
    });
  },

  /** 项目办审核证据 */
  reviewEvidence(todoId, action, reason, confirmerId, confirmerName) {
    var self = this;
    var user = this.getCurrentUser();
    if (!user || (user.role !== 'lean_office' && user.role !== 'project_lead')) {
      return Promise.reject('只有项目办成员或项目经理可以审核');
    }
    var updateData = {
      evidenceStatus: action === 'confirm' ? 'confirmed' : 'rejected',
      evidenceReviewer: user.displayName,
      evidenceReviewTime: new Date().toISOString(),
      evidenceReviewOpinion: reason || '',
      evidenceConfirmerId: confirmerId || null,
      evidenceConfirmerName: confirmerName || ''
    };
    if (action === 'confirm') {
      updateData.closerConfirmedBy = confirmerName || user.displayName;
      updateData.status = '已完成';
      updateData.actualDate = formatDate(new Date());
    } else {
      updateData.closerRejectedReason = reason || '未说明原因';
    }
    return this.updateTodo(todoId, updateData).then(function() {
      // 通知提交人和项目经理审核结果
      var todo = self.getTodoById(todoId);
      if (!todo) return;
      self._update(function(d) {
        if (!d.notifications) d.notifications = [];
        var project = self.getProjectById(todo.projectId);
        var projectName = project ? project.name : '未知项目';
        var subject = todo.subject || '未知待办';
        var resultText = action === 'confirm' ? '审核通过' : '审核退回';
        var resultIcon = action === 'confirm' ? '✅' : '❌';
        var msg = resultIcon + ' 待办「' + subject + '」(' + todo.todoUid + ')已' + resultText + '\n审核人：' + user.displayName + ' | 审核意见：' + (reason || '');

        // 通知提交人
        var submitterName = todo.completionSubmittedBy || '';
        var submitterUsers = (d.users || []).filter(function(u) {
          return u.displayName === submitterName && u.companyId === todo.companyId;
        });

        // 通知项目经理
        var projectLeadUsers = (d.users || []).filter(function(u) {
          return u.companyId === todo.companyId && u.role === 'project_lead';
        });

        var notifyUsers = [];
        submitterUsers.forEach(function(u) { notifyUsers.push(u); });
        projectLeadUsers.forEach(function(u) {
          if (!notifyUsers.some(function(x) { return x.id === u.id; })) notifyUsers.push(u);
        });

        var nextId = d.notifications.length > 0
          ? Math.max.apply(null, d.notifications.map(function(x) { return x.id; })) : 0;

        notifyUsers.forEach(function(u) {
          nextId++;
          d.notifications.push({
            id: nextId,
            fromUserId: user.id, fromUserName: user.displayName,
            toUserId: u.id, type: 'evidence_review_result',
            title: '完成描述审核结果：' + subject,
            message: msg,
            projectId: todo.projectId, projectName: projectName,
            todoId: todoId, todoSubject: subject,
            status: 'pending',
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          });
        });
      });
    });
  },

  calcStatus(item) {
    if (item.status === '已删除') return '已删除';
    if (item.status === '已完成' && item.actualDate) return '已完成';
    if (item.deadline) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var deadline = new Date(item.deadline);
      deadline.setHours(0, 0, 0, 0);
      if (today > deadline) return '过期';
      return '期限内';
    }
    return '未设定';
  },

  refreshStatus() {
    var self = this;
    this._update(function(data) {
      (data.todos || []).forEach(function(item) {
        if (item.status !== '已完成' && item.status !== '已删除') item.status = self.calcStatus(item);
      });
    });
  },

  exportProject(projectId) {
    var pid = projectId || this.getCurrentProjectId();
    var project = this.getProjectById(pid);
    var todos = this.getProjectTodos(pid);
    var exportData = { project: project, todos: todos, exportDate: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = project.name + '_export_' + formatDate(new Date()) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  },

  /** XLSX 导出（使用 SheetJS） */
  exportProjectXLSX: function(projectId) {
    var pid = projectId || this.getCurrentProjectId();
    var project = this.getProjectById(pid);
    var todos = this.getProjectTodos(pid);

    // 构建导出行
    var rows = [];
    // 表头
    var headers = ['待办编号','提出日期','所属领域','重要程度','事项主题','现状问题','改善方案','需求支持','牵头部门','第一责任人','第二责任人','协作人','完成期限','实际完成日期','完成状况','证据状态','项目办确认','顾问确认','跟进事项','延期记录','延期原因','延期对策','交办顾问','是否涉及成本'];
    rows.push(headers);

    todos.forEach(function(t) {
      rows.push([
        t.todoUid || '', t.proposedDate || '', t.domain || '', t.importance || '',
        t.subject || '', t.currentProblems || '', t.improvementPlan || '',
        t.supportNeeded || '', t.leadDepartment || '', t.primaryOwner || '',
        t.secondaryOwner || '', t.collaborator || '', t.deadline || '',
        t.actualDate || '', t.status || '', t.evidenceStatus || '',
        t.leanOfficeConfirm || '', t.consultantConfirm || '', t.followUp || '',
        t.delayRecord || '', t.delayReason || '', t.delayMeasure || '',
        t.assignedConsultant || '', t.costRelated || ''
      ]);
    });

    var ws = XLSX.utils.aoa_to_sheet(rows);
    // 设置列宽
    ws['!cols'] = headers.map(function() { return { wch: 16 }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '待办事项');
    XLSX.writeFile(wb, (project ? project.name : 'export') + '_' + formatDate(new Date()) + '.xlsx');
  },

  /** XLSX 导入 */
  importXLSX: function(arrayBuffer, projectId, replace) {
    var self = this;
    try {
      var wb = XLSX.read(arrayBuffer, { type: 'array' });
      var ws = wb.Sheets[wb.SheetNames[0]];
      var data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length < 2) return Promise.reject(new Error('文件内容为空'));
      var headers = data[0];
      // 构建列名映射
      var colMap = {};
      headers.forEach(function(h, i) {
        var key = String(h || '').trim();
        if (key.indexOf('待办编号') >= 0) colMap.todoUid = i;
        else if (key.indexOf('提出日期') >= 0) colMap.proposedDate = i;
        else if (key.indexOf('所属领域') >= 0) colMap.domain = i;
        else if (key.indexOf('重要程度') >= 0) colMap.importance = i;
        else if (key.indexOf('事项主题') >= 0) colMap.subject = i;
        else if (key.indexOf('现状问题') >= 0) colMap.currentProblems = i;
        else if (key.indexOf('改善方案') >= 0) colMap.improvementPlan = i;
        else if (key.indexOf('需求支持') >= 0) colMap.supportNeeded = i;
        else if (key.indexOf('牵头部门') >= 0) colMap.leadDepartment = i;
        else if (key.indexOf('第一责任人') >= 0) colMap.primaryOwner = i;
        else if (key.indexOf('第二责任人') >= 0) colMap.secondaryOwner = i;
        else if (key.indexOf('协作人') >= 0) colMap.collaborator = i;
        else if (key.indexOf('完成期限') >= 0) colMap.deadline = i;
        else if (key.indexOf('实际完成日期') >= 0) colMap.actualDate = i;
        else if (key.indexOf('完成状况') >= 0) colMap.status = i;
        else if (key.indexOf('证据状态') >= 0) colMap.evidenceStatus = i;
        else if (key.indexOf('项目办确认') >= 0) colMap.leanOfficeConfirm = i;
        else if (key.indexOf('顾问确认') >= 0) colMap.consultantConfirm = i;
        else if (key.indexOf('跟进事项') >= 0) colMap.followUp = i;
        else if (key.indexOf('延期记录') >= 0) colMap.delayRecord = i;
        else if (key.indexOf('延期原因') >= 0) colMap.delayReason = i;
        else if (key.indexOf('延期对策') >= 0) colMap.delayMeasure = i;
        else if (key.indexOf('交办顾问') >= 0) colMap.assignedConsultant = i;
        else if (key.indexOf('是否涉及成本') >= 0) colMap.costRelated = i;
      });

      var pid = projectId || this.getCurrentProjectId();
      var project = self.getProjectById(pid);

      return new Promise(function(resolve) {
        self._update(function(storeData) {
          if (!storeData.todos) storeData.todos = [];
          if (replace) storeData.todos = storeData.todos.filter(function(t) { return t.projectId !== pid; });
          var nextId = storeData.todos.length > 0 ? Math.max.apply(null, storeData.todos.map(function(t) { return t.id; })) + 1 : 1;

          for (var r = 1; r < data.length; r++) {
            var row = data[r];
            if (!row || row.length === 0) continue;
            var seq = self._getProjectTodoSeq(pid) + 1;
            var todoUid = row[colMap.todoUid] || generateTodoUid(pid, seq);
            storeData.todos.push({
              id: nextId++,
              todoUid: todoUid,
              proposedDate: formatDateStr(row[colMap.proposedDate]) || '',
              domain: row[colMap.domain] || '',
              importance: row[colMap.importance] || 'D',
              subject: row[colMap.subject] || '',
              currentProblems: row[colMap.currentProblems] || '',
              improvementPlan: row[colMap.improvementPlan] || '',
              supportNeeded: row[colMap.supportNeeded] || '-',
              leadDepartment: row[colMap.leadDepartment] || '',
              primaryOwner: row[colMap.primaryOwner] || '',
              secondaryOwner: row[colMap.secondaryOwner] || '-',
              collaborator: row[colMap.collaborator] || '-',
              deadline: formatDateStr(row[colMap.deadline]) || '',
              actualDate: row[colMap.actualDate] || '',
              status: row[colMap.status] || '未设定',
              evidenceStatus: row[colMap.evidenceStatus] || '',
              leanOfficeConfirm: row[colMap.leanOfficeConfirm] || '',
              consultantConfirm: row[colMap.consultantConfirm] || '',
              followUp: row[colMap.followUp] || '',
              delayRecord: row[colMap.delayRecord] || '-',
              delayReason: row[colMap.delayReason] || '-',
              delayMeasure: row[colMap.delayMeasure] || '-',
              assignedConsultant: row[colMap.assignedConsultant] || '',
              costRelated: row[colMap.costRelated] || '否',
              projectId: pid,
              companyId: project ? project.companyId : null,
              evidenceFolder: 'PRJ' + String(pid).padStart(3, '0') + '/' + todoUid + '/',
              evidenceFiles: [],
              closerNotes: '', closerId: null, closerConfirmedBy: '', closerRejectedReason: '',
              isMilestone: false,
              onTimeQualified: false, onTimeUnqualified: false,
              delayQualified: false, delayUnqualified: false,
              benefits: '', procurementDate: '', expectedDate: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
          resolve(true);
        });
      });
    } catch (e) { return Promise.reject(e); }
  },

  importJSON(jsonString, projectId, replace) {
    var self = this;
    try {
      var imported = JSON.parse(jsonString);
      var pid = projectId || this.getCurrentProjectId();
      var project = self.getProjectById(pid);
      return new Promise(function(resolve) {
        self._update(function(data) {
          if (!data.todos) data.todos = [];
          if (replace) data.todos = data.todos.filter(function(t) { return t.projectId !== pid; });
          var todos = Array.isArray(imported) ? imported : (imported.todos || []);
          var nextId = data.todos.length > 0 ? Math.max.apply(null, data.todos.map(function(t) { return t.id; })) + 1 : 1;
          todos.forEach(function(t) {
            t.id = nextId++;
            t.projectId = pid;
            t.companyId = project ? project.companyId : null;
            var seq = self._getProjectTodoSeq(pid) + 1;
            if (!t.todoUid) t.todoUid = generateTodoUid(pid, seq);
            t.evidenceFolder = 'PRJ' + String(pid).padStart(3, '0') + '/' + t.todoUid + '/';
            t.createdAt = t.createdAt || new Date().toISOString();
            t.updatedAt = new Date().toISOString();
            data.todos.push(t);
          });
          resolve(true);
        });
      });
    } catch (e) { return Promise.reject(e); }
  },

  /** 获取系统级统计数据（超级管理员用） */
  getSystemStats: function() {
    var companies = this.getAllCompanies();
    var users = this.getAllUsers();
    var projects = this.getAllProjects();
    var todos = this.getAllTodos();
    var activeTodos = todos.filter(function(t) { return t.status !== '已删除'; });
    var completedTodos = activeTodos.filter(function(t) { return t.status === '已完成'; });
    var overdueTodos = activeTodos.filter(function(t) { return t.status === '过期'; });

    // 每个公司的项目统计
    var companyStats = companies.map(function(c) {
      var cProjects = projects.filter(function(p) { return p.companyId === c.id; });
      var cUsers = users.filter(function(u) { return u.companyId === c.id; });
      var cTodos = todos.filter(function(t) { return t.companyId === c.id; });
      var cActive = cTodos.filter(function(t) { return t.status !== '已删除'; });
      return {
        id: c.id,
        name: c.name,
        abbreviation: c.abbreviation || c.name,
        projectCount: cProjects.length,
        userCount: cUsers.length,
        totalTodos: cTodos.length,
        activeTodos: cActive.length,
        completedTodos: cActive.filter(function(t) { return t.status === '已完成'; }).length,
        overdueTodos: cActive.filter(function(t) { return t.status === '过期'; }).length,
        completionRate: cActive.length > 0 ? (cActive.filter(function(t) { return t.status === '已完成'; }).length / cActive.length * 100).toFixed(1) : 0
      };
    });

    return {
      companyCount: companies.length,
      userCount: users.length,
      projectCount: projects.length,
      todoCount: todos.length,
      activeCount: activeTodos.length,
      completedCount: completedTodos.length,
      overdueCount: overdueTodos.length,
      overallRate: activeTodos.length > 0 ? (completedTodos.length / activeTodos.length * 100).toFixed(1) : 0,
      companyStats: companyStats,
      // 各角色用户数
      roleDistribution: CONFIG.roles.map(function(r) {
        return { role: r.value, label: r.label, count: users.filter(function(u) { return u.role === r.value; }).length, color: r.color };
      })
    };
  },

  /* ========== 统计数据 ========== */

  getStats(projectId) {
    var pid = projectId || this.getCurrentProjectId();
    var items = pid ? this.getAllTodos().filter(function(t) { return t.projectId === pid; }) : this.getAllTodos();
    var active = items.filter(function(i) { return i.status !== '已删除'; });
    var completed = active.filter(function(i) { return i.status === '已完成'; });
    var overdue = active.filter(function(i) { return i.status === '过期'; });
    var withinDeadline = active.filter(function(i) { return i.status === '期限内'; });

    var evidenceStats = {};
    CONFIG.evidenceStatuses.forEach(function(es) { evidenceStats[es.value] = active.filter(function(i) { return i.evidenceStatus === es.value; }).length; });

    var deptStats = {};
    active.forEach(function(item) {
      var dept = item.leadDepartment || '未分配';
      if (!deptStats[dept]) deptStats[dept] = { dept: dept, total: 0, completed: 0, overdue: 0, withinDeadline: 0, notSet: 0 };
      deptStats[dept].total++;
      if (item.status === '已完成') deptStats[dept].completed++;
      else if (item.status === '过期') deptStats[dept].overdue++;
      else if (item.status === '期限内') deptStats[dept].withinDeadline++;
      else deptStats[dept].notSet++;
    });

    var importanceStats = {};
    CONFIG.importanceLevels.forEach(function(imp) { importanceStats[imp.value] = { level: imp.value, label: imp.label, total: 0, completed: 0, overdue: 0 }; });
    active.forEach(function(item) {
      var imp = item.importance || 'D';
      if (importanceStats[imp]) { importanceStats[imp].total++; if (item.status === '已完成') importanceStats[imp].completed++; else if (item.status === '过期') importanceStats[imp].overdue++; }
    });

    var domainStats = {};
    active.forEach(function(item) {
      var dom = item.domain || '其他';
      if (!domainStats[dom]) domainStats[dom] = { domain: dom, total: 0, completed: 0, overdue: 0 };
      domainStats[dom].total++;
      if (item.status === '已完成') domainStats[dom].completed++;
      else if (item.status === '过期') domainStats[dom].overdue++;
    });

    var monthlyStats = {};
    active.forEach(function(item) {
      if (item.proposedDate) {
        var month = item.proposedDate.substring(0, 7);
        if (!monthlyStats[month]) monthlyStats[month] = { month: month, total: 0, completed: 0 };
        monthlyStats[month].total++;
        if (item.status === '已完成') monthlyStats[month].completed++;
      }
    });

    var ownerStats = {};
    active.forEach(function(item) {
      var owner = item.primaryOwner || '未分配';
      if (!ownerStats[owner]) ownerStats[owner] = { owner: owner, total: 0, completed: 0, overdue: 0 };
      ownerStats[owner].total++;
      if (item.status === '已完成') ownerStats[owner].completed++;
      else if (item.status === '过期') ownerStats[owner].overdue++;
    });

    var completionRate = active.length > 0 ? (completed.length / active.length * 100) : 0;
    var overdueRate = active.length > 0 ? (overdue.length / active.length * 100) : 0;

    return {
      total: items.length, activeTotal: active.length,
      completed: completed.length, overdue: overdue.length,
      withinDeadline: withinDeadline.length,
      deleted: items.filter(function(i) { return i.status === '已删除'; }).length,
      notSet: active.filter(function(i) { return i.status === '未设定'; }).length,
      needReview: active.filter(function(i) { return i.evidenceStatus === 'uploaded'; }).length,
      completionRate: completionRate, overdueRate: overdueRate,
      evidenceStats: evidenceStats,
      deptStats: Object.values(deptStats).sort(function(a, b) {
        var rateA = a.total > 0 ? (a.completed / a.total * 100) : 0;
        var rateB = b.total > 0 ? (b.completed / b.total * 100) : 0;
        return rateB - rateA;
      }),
      importanceStats: Object.values(importanceStats),
      domainStats: Object.values(domainStats).sort(function(a, b) { return b.total - a.total; }),
      monthlyStats: Object.values(monthlyStats).sort(function(a, b) { return a.month.localeCompare(b.month); }),
      ownerStats: Object.values(ownerStats).sort(function(a, b) { return b.total - a.total; }),
      overdueItems: overdue.sort(function(a, b) { return new Date(b.deadline) - new Date(a.deadline); }),
      highPriorityActive: active.filter(function(i) { return i.importance === 'A' && i.status !== '已完成'; }).length
    };
  },

  /* ========== 公司汇总统计 ========== */
  getCompanyStats: function(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    var projects = this.getCompanyProjects(cid);
    var projectIds = projects.map(function(p) { return p.id; });
    var todos = this.getAllTodos().filter(function(t) { return projectIds.indexOf(t.projectId) >= 0 && t.status !== '已删除'; });
    var completed = todos.filter(function(t) { return t.status === '已完成'; });
    var overdue = todos.filter(function(t) { return t.status === '过期'; });
    return {
      projectCount: projects.length,
      totalTodos: todos.length,
      completed: completed.length,
      overdue: overdue.length,
      completionRate: todos.length > 0 ? (completed.length / todos.length * 100) : 0,
      overdueRate: todos.length > 0 ? (overdue.length / todos.length * 100) : 0,
      overdueItems: overdue.sort(function(a,b) { return new Date(b.deadline) - new Date(a.deadline); })
    };
  },

  /* ========== 通知系统 ========== */
  getAllNotifications: function() {
    var data = this._read();
    return data ? (data.notifications || []) : [];
  },

  getUserNotifications: function(userId) {
    return this.getAllNotifications().filter(function(n) { return n.toUserId === userId && n.status === 'pending'; });
  },

  getUserAllNotifications: function(userId) {
    return this.getAllNotifications().filter(function(n) { return n.toUserId === userId; }).sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  },

  addNotification: function(notification) {
    var self = this;
    return new Promise(function(resolve) {
      self._update(function(data) {
        if (!data.notifications) data.notifications = [];
        var n = {
          id: data.notifications.length > 0 ? Math.max.apply(null, data.notifications.map(function(x) { return x.id; })) + 1 : 1,
          fromUserId: notification.fromUserId,
          fromUserName: notification.fromUserName,
          toUserId: notification.toUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          projectId: notification.projectId || null,
          projectName: notification.projectName || '',
          todoId: notification.todoId || null,
          todoSubject: notification.todoSubject || '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        data.notifications.push(n);
        resolve(n);
      });
    });
  },

  respondNotification: function(notificationId, userId, action) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self._update(function(data) {
        if (!data.notifications) data.notifications = [];
        var n = data.notifications.find(function(x) { return x.id === notificationId && x.toUserId === userId; });
        if (!n) return reject('通知不存在');
        if (n.status !== 'pending') return reject('通知已处理');
        n.status = action;
        n.updatedAt = new Date().toISOString();

        if (action === 'accepted') {
          if (n.type === 'project_invite' && n.projectId) {
            var project = (data.projects || []).find(function(p) { return p.id === n.projectId; });
            if (project && project.memberIds.indexOf(n.toUserId) === -1) {
              project.memberIds.push(n.toUserId);
            }
          } else if (n.type === 'todo_assign' && n.todoId) {
            var todo = (data.todos || []).find(function(t) { return t.id === n.todoId; });
            var user = (data.users || []).find(function(u) { return u.id === n.toUserId; });
            if (todo && user) {
              todo.primaryOwner = user.displayName;
            }
          }
        }
        resolve(n);
      });
    });
  },

  /* ========== 操作日志系统 ========== */
  getAllLogs: function() {
    var data = this._read();
    return data ? (data.operationLogs || []) : [];
  },

  getCompanyLogs: function(companyId) {
    return this.getAllLogs().filter(function(l) { return l.companyId === companyId; });
  },

  addLog: function(log) {
    var user = this.getCurrentUser();
    var companyId = log.companyId || (user ? user.companyId : 0);
    this._update(function(data) {
      if (!data.operationLogs) data.operationLogs = [];
      data.operationLogs.push({
        id: data.operationLogs.length > 0 ? Math.max.apply(null, data.operationLogs.map(function(l) { return l.id; })) + 1 : 1,
        userId: user ? user.id : 0,
        userName: user ? user.displayName : '系统',
        userRole: user ? user.role : '',
        companyId: companyId,
        action: log.action,
        target: log.target,
        targetId: log.targetId || null,
        targetName: log.targetName || '',
        detail: log.detail || '',
        createdAt: new Date().toISOString()
      });
    });
  },

  /* ========== 项目成员管理 ========== */
  inviteProjectMember: function(projectId, userId) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var project = self.getProjectById(projectId);
      if (!project) return reject('项目不存在');
      if (project.memberIds.indexOf(userId) >= 0) return reject('该用户已是项目成员');
      var existingInvite = self.getAllNotifications().find(function(n) {
        return n.type === 'project_invite' && n.projectId === projectId && n.toUserId === userId && n.status === 'pending';
      });
      if (existingInvite) return reject('已存在待处理的邀请');
      var user = self.getUserById(userId);
      if (!user) return reject('用户不存在');
      var currentUser = self.getCurrentUser();
      self.addNotification({
        fromUserId: currentUser.id,
        fromUserName: currentUser.displayName,
        toUserId: userId,
        type: 'project_invite',
        title: '项目邀请',
        message: currentUser.displayName + ' 邀请你加入项目「' + project.name + '」',
        projectId: projectId,
        projectName: project.name
      }).then(function() { resolve(true); }).catch(reject);
    });
  },

  removeMemberWithNotify: function(projectId, userId) {
    var project = this.getProjectById(projectId);
    if (!project) return;
    if (userId === project.initiatorId) return;
    this._update(function(data) {
      (data.notifications || []).forEach(function(n) {
        if (n.type === 'project_invite' && n.projectId === projectId && n.toUserId === userId && n.status === 'pending') {
          n.status = 'rejected';
          n.updatedAt = new Date().toISOString();
        }
      });
      var p = (data.projects || []).find(function(pp) { return pp.id === projectId; });
      if (p) {
        p.memberIds = p.memberIds.filter(function(mid) { return mid !== userId; });
      }
    });
  },

  assignTodoToMember: function(todoId, userId) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var todo = self.getTodoById(todoId);
      if (!todo) return reject('待办不存在');
      var user = self.getUserById(userId);
      if (!user) return reject('用户不存在');
      var project = self.getProjectById(todo.projectId);
      var currentUser = self.getCurrentUser();
      self.addNotification({
        fromUserId: currentUser.id,
        fromUserName: currentUser.displayName,
        toUserId: userId,
        type: 'todo_assign',
        title: '待办分配',
        message: currentUser.displayName + ' 将待办「' + todo.subject + '」（' + todo.todoUid + '）分配给你，请确认是否接受',
        projectId: todo.projectId,
        projectName: project ? project.name : '',
        todoId: todoId,
        todoSubject: todo.subject
      }).then(function() { resolve(true); }).catch(reject);
    });
  },

  /* ========== 文件管理 ========== */
  getProjectEvidenceFiles: function(projectId) {
    var todos = this.getProjectTodos(projectId).filter(function(t) { return t.status !== '已删除'; });
    var result = [];
    todos.forEach(function(t) {
      if (t.evidenceFiles && t.evidenceFiles.length > 0) {
        t.evidenceFiles.forEach(function(f) {
          result.push({
            todoId: t.id,
            todoUid: t.todoUid,
            todoSubject: t.subject,
            todoStatus: t.status,
            evidenceStatus: t.evidenceStatus,
            fileName: f.name,
            fileSize: f.size,
            fileType: f.type,
            fileData: f.data,
            folder: f.folder || t.evidenceFolder,
            uploadedAt: f.uploadedAt,
            uploadedBy: f.uploadedBy
          });
        });
      }
    });
    return result;
  },

  getCompanyEvidenceFiles: function(companyId) {
    var cid = companyId || this.getCurrentCompanyId();
    var projects = this.getCompanyProjects(cid);
    var result = [];
    var self = this;
    projects.forEach(function(p) {
      var files = self.getProjectEvidenceFiles(p.id);
      files.forEach(function(f) { f.projectName = p.name; f.projectId = p.id; });
      result = result.concat(files);
    });
    return result;
  },

  deleteEvidenceFile: function(todoId, fileIndex) {
    var self = this;
    return new Promise(function(resolve) {
      self._update(function(data) {
        var todo = (data.todos || []).find(function(t) { return t.id === parseInt(todoId); });
        if (todo && todo.evidenceFiles) {
          todo.evidenceFiles.splice(fileIndex, 1);
          if (todo.evidenceFiles.length === 0) {
            todo.evidenceStatus = '';
          }
        }
        resolve();
      });
    });
  },

  clearAll() { localStorage.removeItem(this.STORAGE_KEY); }
};

/** 将各种日期格式统一转为 YYYY-MM-DD */
function formatDateStr(val) {
  if (!val || val === '-' || val === '') return '';
  var s = String(val).trim();
  // 已经是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Excel 序列号（数字）
  if (/^\d+$/.test(s) && parseInt(s) > 30000 && parseInt(s) < 60000) {
    var d = new Date((parseInt(s) - 25569) * 86400 * 1000);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  // YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    var p = s.split('/');
    return p[0] + '-' + p[1].padStart(2,'0') + '-' + p[2].padStart(2,'0');
  }
  // MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    var p = s.split('/');
    return p[2] + '-' + p[0].padStart(2,'0') + '-' + p[1].padStart(2,'0');
  }
  // 尝试原生解析
  var dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  }
  return s;
}
