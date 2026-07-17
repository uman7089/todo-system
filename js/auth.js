/**
 * 精益项目待办管理系统 v4.0 — 认证模块
 * 支持多公司登录、角色权限控制（仅项目办可增删改待办）
 */

var Auth = {
  init: async function() {
    var user = Store.getCurrentUser();
    if (user) { window.currentUser = user; return user; }
    return null;
  },

  currentUser: function() { return Store.getCurrentUser(); },

  /** 登录 — 含公司选择（超级管理员无需选公司） */
  login: async function(username, password, companyId) {
    var hash = await hashPassword(password);
    var user = Store.login(username, hash, companyId || undefined);
    if (user) { window.currentUser = user; return { success: true, user: user }; }
    return { success: false, error: '用户名或密码错误' };
  },

  /** 注册（公司由系统自动分配） */
  register: async function(username, password, displayName, department, role) {
    var hash = await hashPassword(password);
    var result = Store.register({
      username: username, passwordHash: hash, displayName: displayName,
      department: department || '', role: role || 'project_member'
    });
    if (result.error) return { success: false, error: result.error };
    window.currentUser = result.user;
    return { success: true, user: result.user };
  },

  logout: function() {
    Store.logout();
    window.currentUser = null;
    window.location.hash = '#login';
  },

  /** 权限检查 — 页面访问控制 */
  canAccess: function(page) {
    var user = this.currentUser();
    if (!user) return page === 'login';

    // 超级管理员
    if (user.role === 'super_admin') {
      return ['workspace', 'companies', 'projectApprovals', 'logs'].indexOf(page) >= 0;
    }

    switch (page) {
      case 'users':
      case 'settings':
        return user.role === 'admin';
      case 'review':
        return user.role === 'lean_office' || user.role === 'project_lead';
      case 'weeklyReport':
        return true; // 全体登录用户可见，但只有项目办可创建
      case 'extensions':
        return user.role === 'project_lead';
      case 'projectApprovals':
        return user.role === 'leader' || user.role === 'super_admin';
      case 'logs':
        return user.role === 'super_admin' || user.role === 'admin';
      case 'notifications':
        return true; // 所有登录用户都可查看自己的通知
      case 'projects':
      case 'todos':
      case 'dashboard':
      case 'workspace':
        return true;
      default:
        return true;
    }
  },

  /** 待办编辑权限 — 仅项目办 */
  canEditTodos: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'lean_office';
  },

  /** 项目管理权限（新建/删除项目） */
  canManageProjects: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'admin' || user.role === 'lean_office';
  },

  /** 证据审核权限 — 项目办 + 项目经理 */
  canReviewEvidence: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'lean_office' || user.role === 'project_lead';
  },

  /** 用户管理权限 */
  canManageUsers: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'admin';
  },

  /** 公司管理权限 */
  canManageCompanies: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'super_admin';
  },

  /** 基础数据管理权限（部门/人员/顾问） */
  canManageSettings: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'admin';
  },

  /** 项目审批权限（结案/删除审核 — 高层/超级管理员） */
  canApproveProjects: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'leader' || user.role === 'super_admin';
  },

  /** 是否只读角色（只可查看，不可做任何编辑操作） */
  isReadOnly: function() {
    var user = this.currentUser();
    if (!user) return true;
    return user.role !== 'lean_office' && user.role !== 'admin' && user.role !== 'super_admin';
  },

  /** 延期申请提交权限 — 仅项目办 */
  canSubmitExtension: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'lean_office';
  },

  /** 延期申请审批权限 — 项目经理 */
  canApproveExtension: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'project_lead';
  },

  /** 周报管理权限 — 项目办 */
  canManageWeeklyReport: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'lean_office';
  },

  /** 操作日志查看权限 */
  canViewLogs: function() {
    var user = this.currentUser();
    if (!user) return false;
    return user.role === 'super_admin' || user.role === 'admin';
  },

  /** 检查当前用户是否是某项目的成员 */
  isProjectMember: function(projectId) {
    var user = this.currentUser();
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'lean_office' || user.role === 'leader') return true;
    var project = Store.getProjectById(projectId);
    if (!project) return false;
    return (project.memberIds || []).indexOf(user.id) >= 0;
  },

  getRoleInfo: function(role) {
    return CONFIG.roles.find(function(r) { return r.value === role; }) || CONFIG.roles[0];
  },

  getRoleLabel: function(role) {
    var ri = this.getRoleInfo(role);
    return ri ? ri.label : role;
  },

  /** 获取当前用户可选择的公司列表（登录时） */
  getLoginCompanies: function() {
    return Store.getAllCompanies();
  }
};
