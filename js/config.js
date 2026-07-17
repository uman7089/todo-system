/**
 * 精益项目待办管理系统 v3.0 — 配置数据
 * 支持多公司、多角色、部门/人员后台维护
 */

var CONFIG = {
  version: '3.0.0',
  appName: '精益项目待办管理系统',

  // ===== 公司结构 =====
  // 公司由超级管理员维护，管理员可维护所属公司的部门和人员
  defaultCompanyName: '默认公司',

  // ===== 角色体系 v4.0 =====
  // 权限：仅项目办(lean_office)可增删改待办；其他角色全部只读
  roles: [
    { value: 'super_admin',  label: '超级管理员',   desc: '管理所有公司、查看系统运营数据', color: '#E24B4A', icon: '👑', canEditTodo: false },
    { value: 'admin',        label: '公司管理员',   desc: '管理所属公司项目、待办、人员',   color: '#7F77DD', icon: '⚙️', canEditTodo: false },
    { value: 'lean_office',  label: '项目办',       desc: '唯一可增删改待办、审核证据',     color: '#639922', icon: '📋', canEditTodo: true  },
    { value: 'project_lead', label: '项目经理',     desc: '负责项目确认人署名，查看项目待办进度',  color: '#378ADD', icon: '👔', canEditTodo: false },
    { value: 'project_member',label:'项目成员',     desc: '查看项目待办',                   color: '#5C8DB5', icon: '👤', canEditTodo: false },
    { value: 'leader',       label: '高层',         desc: '查看驾驶舱、项目进度',           color: '#EF7E25', icon: '📊', canEditTodo: false },
    { value: 'consultant',   label: '顾问',         desc: '查看待办、指导改善',             color: '#1D9E75', icon: '💡', canEditTodo: false }
  ],

  // 角色分类（用于下拉分组）
  roleGroups: [
    { label: '管理类', roles: ['super_admin', 'admin'] },
    { label: '执行类', roles: ['lean_office', 'project_lead', 'project_member'] },
    { label: '查阅类', roles: ['leader', 'consultant'] }
  ],

  // ===== 完成情况描述流转状态 =====
  evidenceStatuses: [
    { value: '', label: '待描述', color: '#8b949e', icon: '⭕' },
    { value: 'uploaded', label: '待审核', color: '#d29922', icon: '📤' },
    { value: 'confirmed', label: '已确认', color: '#3fb950', icon: '✅' },
    { value: 'rejected', label: '被退回', color: '#f85149', icon: '❌' }
  ],

  // ===== 所属领域 =====
  domains: [
    '设备管理', '效率提升', '成本递减', '人力资源', '信息化管理',
    '物流仓储', '成本低减', '5S&安全', '现场管理', '制度&标准化',
    '设备改善', '人员低减', '工艺改善', '安全管理', '项目管理',
    '采购管理', '班组建设', '文宣项目', '改善提案', '目视化管理',
    '生产计划', '产线配置'
  ],

  // ===== 重要程度分级 =====
  importanceLevels: [
    { value: 'A', label: '重要+紧急', desc: '影响项目的里程碑节点且需要按照要求时间完成', color: '#E24B4A', bg: '#FCEBEB' },
    { value: 'B', label: '重要', desc: '对项目的一般节点或关键节点有影响，但不影响项目的里程碑节点', color: '#EF9F27', bg: '#FAEEDA' },
    { value: 'C', label: '紧急', desc: '需要按照要求时间完成否则影响项目的里程碑节点', color: '#E2B53B', bg: '#FFF9E6' },
    { value: 'D', label: '一般', desc: '一般的问题，不会对项目的进程产生影响', color: '#888780', bg: '#F1EFE8' }
  ],

  // ===== 完成状况 =====
  statusTypes: [
    { value: '期限内', label: '期限内', color: '#378ADD', bg: '#E6F1FB' },
    { value: '过期', label: '过期', color: '#E24B4A', bg: '#FCEBEB' },
    { value: '已完成', label: '已完成', color: '#639922', bg: '#EAF3DE' },
    { value: '已删除', label: '已删除', color: '#888780', bg: '#F1EFE8' },
    { value: '未设定', label: '未设定', color: '#B4B2A9', bg: '#F1EFE8' }
  ],

  // ===== 默认部门和人员（各公司可自行维护）v4.0 =====
  defaultDepartments: [
    { id: 1,  name: '精益办',       code: 'LEAN' },
    { id: 2,  name: '设备部',       code: 'EQUIP' },
    { id: 3,  name: '工艺部',       code: 'PROC' },
    { id: 4,  name: '质量部',       code: 'QUAL' },
    { id: 5,  name: '人力资源部',   code: 'HR' },
    { id: 6,  name: '物流部',       code: 'LOG' },
    { id: 7,  name: 'IT部',         code: 'IT' },
    { id: 8,  name: '生产部',       code: 'PROD' },
    { id: 9,  name: '计划部',       code: 'PLAN' },
    { id: 10, name: '采购部',       code: 'PURC' },
    { id: 11, name: '销售部',       code: 'SALE' },
    { id: 12, name: '财务部',       code: 'FIN' },
    { id: 13, name: '安环部',       code: 'SAFE' },
    { id: 14, name: '经营层',       code: 'MGMT' },
    { id: 15, name: '储运部',       code: 'STOR' }
  ],
  // 人员结构：{name, position, employeeId, department, role(项目角色)}
  defaultPersonnel: [
    { id: 1,  name: '张明', position: '精益专员',  employeeId: 'E001', department: '精益办', role: 'lean_office' },
    { id: 2,  name: '王强', position: '精益专员',  employeeId: 'E002', department: '精益办', role: 'lean_office' },
    { id: 3,  name: '李伟', position: '设备主管',  employeeId: 'E003', department: '设备部', role: 'project_lead' },
    { id: 4,  name: '刘洋', position: '工艺工程师',employeeId: 'E004', department: '工艺部', role: 'project_member' },
    { id: 5,  name: '陈刚', position: '质量主管',  employeeId: 'E005', department: '质量部', role: 'project_lead' },
    { id: 6,  name: '赵丽', position: 'HR经理',    employeeId: 'E006', department: '人力资源部', role: 'project_member' },
    { id: 7,  name: '孙磊', position: '物流主管',  employeeId: 'E007', department: '物流部', role: 'project_member' },
    { id: 8,  name: '周婷', position: 'IT工程师',  employeeId: 'E008', department: 'IT部', role: 'project_member' },
    { id: 9,  name: '吴鹏', position: '车间主任',  employeeId: 'E009', department: '生产部', role: 'project_lead' },
    { id: 10, name: '郑辉', position: '生产班长',  employeeId: 'E010', department: '生产部', role: 'project_member' },
    { id: 11, name: '钱建国',position: '计划主管',  employeeId: 'E011', department: '计划部', role: 'project_member' },
    { id: 12, name: '杨立', position: '采购经理',  employeeId: 'E012', department: '采购部', role: 'project_member' },
    { id: 13, name: '黄涛', position: '安全主管',  employeeId: 'E013', department: '安环部', role: 'project_member' },
    { id: 14, name: '许芳', position: '财务主管',  employeeId: 'E014', department: '财务部', role: 'project_member' },
    { id: 15, name: '何平', position: '销售经理',  employeeId: 'E015', department: '销售部', role: 'project_member' }
  ],

  // ===== 交办顾问 =====
  defaultConsultants: [
    { id: 1, name: '林顾问', title: '资深精益顾问' },
    { id: 2, name: '陈老师', title: '精益管理专家' },
    { id: 3, name: '赵老师', title: '质量体系顾问' },
    { id: 4, name: '顾老师', title: '设备管理顾问' },
    { id: 5, name: '廖老师', title: '供应链顾问' }
  ],

  // ===== 待办字段定义 =====
  fields: [
    { key: 'todoUid', label: '待办编号', type: 'uid', width: 110, editable: false },
    { key: 'proposedDate', label: '提出日期', type: 'date', width: 100, editable: true, required: true },
    { key: 'domain', label: '所属领域', type: 'select', width: 100, editable: true, required: true },
    { key: 'importance', label: '重要程度', type: 'select', width: 70, editable: true, required: true },
    { key: 'subject', label: '事项主题', type: 'text', width: 220, editable: true, required: true },
    { key: 'leadDepartment', label: '牵头部门', type: 'select', width: 100, editable: true, required: true },
    { key: 'primaryOwner', label: '第一责任人', type: 'select', width: 80, editable: true, required: true },
    { key: 'deadline', label: '完成期限', type: 'date', width: 100, editable: true, required: true },
    { key: 'status', label: '完成状况', type: 'select', width: 80, editable: true },
    { key: 'evidenceStatus', label: '证据状态', type: 'select', width: 80, editable: false }
  ],

  // 必填字段列表
  requiredFields: [
    'proposedDate', 'domain', 'importance', 'subject',
    'leadDepartment', 'primaryOwner', 'deadline', 'currentProblems', 'improvementPlan'
  ],

  // ===== 导航菜单（按角色）v4.0 =====
  menus: {
    super_admin: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'companies',  icon: '🏢', label: '公司管理', page: 'companies' },
      { id: 'projectApprovals', icon: '📝', label: '项目审批', page: 'projectApprovals' },
      { id: 'logs',       icon: '📜', label: '操作日志', page: 'logs' }
    ],
    admin: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'projects',   icon: '📁', label: '项目管理', page: 'projects' },
      { id: 'dashboard',  icon: '📊', label: '驾驶舱',   page: 'dashboard' },
      { id: 'settings',   icon: '🛠️', label: '基础数据', page: 'settings' },
      { id: 'users',      icon: '👥', label: '用户管理', page: 'users' },
      { id: 'logs',       icon: '📜', label: '操作日志', page: 'logs' }
    ],
    lean_office: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'projects',   icon: '📁', label: '项目概览', page: 'projects' },
      { id: 'todos',      icon: '📋', label: '待办管理', page: 'todos' },
      { id: 'dashboard',  icon: '📊', label: '驾驶舱',   page: 'dashboard' },
      { id: 'review',     icon: '🔍', label: '完成情况审核', page: 'review' },
      { id: 'weeklyReport', icon: '📝', label: '项目周报', page: 'weeklyReport' }
    ],
    project_lead: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'projects',   icon: '📁', label: '项目概览', page: 'projects' },
      { id: 'todos',      icon: '📋', label: '查看待办', page: 'todos' },
      { id: 'review',     icon: '🔍', label: '完成审批', page: 'review' },
      { id: 'dashboard',  icon: '📊', label: '驾驶舱',   page: 'dashboard' },
      { id: 'extensions',  icon: '⏳', label: '延期审批', page: 'extensions' },
      { id: 'weeklyReport', icon: '📝', label: '项目周报', page: 'weeklyReport' }
    ],
    project_member: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'projects',   icon: '📁', label: '项目概览', page: 'projects' },
      { id: 'todos',      icon: '📋', label: '查看待办', page: 'todos' },
      { id: 'weeklyReport', icon: '📝', label: '项目周报', page: 'weeklyReport' },
      { id: 'dashboard',  icon: '📊', label: '驾驶舱',   page: 'dashboard' }
    ],
    leader: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'projects',   icon: '📁', label: '项目总览', page: 'projects' },
      { id: 'todos',      icon: '📋', label: '查看待办', page: 'todos' },
      { id: 'dashboard',  icon: '📊', label: '驾驶舱',   page: 'dashboard' },
      { id: 'weeklyReport', icon: '📝', label: '项目周报', page: 'weeklyReport' },
      { id: 'projectApprovals', icon: '📝', label: '项目审批', page: 'projectApprovals' },
      { id: 'notifications',icon:'🔔',label: '我的通知', page: 'notifications' }
    ],
    consultant: [
      { id: 'workspace',  icon: '🏠', label: '工作台',   page: 'workspace' },
      { id: 'projects',   icon: '📁', label: '项目概览', page: 'projects' },
      { id: 'todos',      icon: '📋', label: '查看待办', page: 'todos' },
      { id: 'weeklyReport', icon: '📝', label: '项目周报', page: 'weeklyReport' },
      { id: 'dashboard',  icon: '📊', label: '驾驶舱',   page: 'dashboard' }
    ]
  }
};

/* ======================== 范例数据生成 ======================== */

var DEMO_USERS = [
  { id: 1,  username: 'superadmin',   passwordHash: '', displayName: '超级管理员', department: '系统',    role: 'super_admin',     companyId: 0, position: '', employeeId: '', createdAt: '2026-01-01' },
  { id: 2,  username: 'admin',       passwordHash: '', displayName: '管理员',     department: 'IT部',    role: 'admin',           companyId: 1, position: 'IT经理', employeeId: 'E001', createdAt: '2026-01-01' },
  { id: 3,  username: 'leanoffice',   passwordHash: '', displayName: '李主任',     department: '精益办',  role: 'lean_office',     companyId: 1, position: '精益办主任', employeeId: 'E002', createdAt: '2026-01-01' },
  { id: 4,  username: 'leader',       passwordHash: '', displayName: '王总',       department: '经营层',  role: 'leader',          companyId: 1, position: '副总经理', employeeId: 'E003', createdAt: '2026-01-01' },
  { id: 5,  username: 'consultant1',   passwordHash: '', displayName: '林顾问',     department: '顾问组',  role: 'consultant',      companyId: 1, position: '资深顾问', employeeId: 'C001', createdAt: '2026-01-01' },
  { id: 6,  username: 'zhangming',    passwordHash: '', displayName: '张明',       department: '精益办',  role: 'lean_office',     companyId: 1, position: '项目专员', employeeId: 'E004', createdAt: '2026-01-01' },
  { id: 7,  username: 'wangqiang',    passwordHash: '', displayName: '王强',       department: '精益办',  role: 'lean_office',     companyId: 1, position: '项目专员', employeeId: 'E005', createdAt: '2026-01-01' },
  { id: 8,  username: 'pml1',         passwordHash: '', displayName: '赵组长',     department: '设备部',  role: 'project_lead',    companyId: 1, position: '设备组长', employeeId: 'E006', createdAt: '2026-01-01' },
  { id: 9,  username: 'member1',      passwordHash: '', displayName: '陈工',       department: '设备部',  role: 'project_member',  companyId: 1, position: '工程师',   employeeId: 'E007', createdAt: '2026-01-01' },
  { id: 10, username: 'member2',      passwordHash: '', displayName: '刘工',       department: '工艺部',  role: 'project_member',  companyId: 1, position: '工艺师',   employeeId: 'E008', createdAt: '2026-01-01' }
];

var DEMO_COMPANIES = [
  { id: 1, name: '华星精密制造有限公司', abbreviation: '华星精密', address: '广东省深圳市南山区科技园南路88号', taxId: '91440300MA5DGH1234', website: 'http://www.huaxing-precision.com', createdAt: '2026-01-01',
    departments: CONFIG.defaultDepartments.map(function(d) { return { id: d.id, name: d.name, code: d.code }; }),
    personnel: CONFIG.defaultPersonnel.map(function(p) { return { id: p.id, name: p.name, position: p.position, employeeId: p.employeeId, department: p.department, role: p.role }; }),
    consultants: CONFIG.defaultConsultants.map(function(c) { return { id: c.id, name: c.name, title: c.title }; })
  }
];

var DEMO_PROJECTS = [
  { id: 1, name: '精益生产一期项目', description: '全面推进精益生产管理体系，涵盖设备管理、5S、标准化作业等', initiatorId: 2, memberIds: [2,3,4,5,6,7], companyId: 1, createdAt: '2026-01-15' },
  { id: 2, name: '信息化升级专项', description: 'MES/WMS/OA等信息系统导入与优化', initiatorId: 2, memberIds: [2,3,5,7], companyId: 1, createdAt: '2026-03-01' },
  { id: 3, name: '质量提升百日行动', description: '质量管理体系优化、供应商质量管控、过程能力提升', initiatorId: 2, memberIds: [2,3,6,7], companyId: 1, createdAt: '2026-06-01' }
];

var SAMPLE_TODOS_RAW = [
  {
    no: 1, proposedDate: '2018-05-27', domain: '人力资源', importance: 'C',
    subject: '完善课程培训要求与制度',
    currentProblems: '1.重要外训课程未进行录影存档\n2.无上课引言，课堂纪律松散\n3.上课学员不带笔记本，学习效果不佳',
    improvementPlan: '1、课程培训档案存档\n2、上课引言：3-5页PPT\n3、出勤记录\n4、建立个人学习档案\n5、专用笔记本',
    supportNeeded: '-', leadDepartment: '人力资源部', primaryOwner: '张明',
    secondaryOwner: '-', collaborator: '-', deadline: '2017-02-14',
    actualDate: '', status: '过期', evidenceStatus: '',
    leanOfficeConfirm: '李主任', consultantConfirm: '林顾问',
    followUp: '更新培训管理制度', delayRecord: '-', delayReason: '-',
    delayMeasure: '-', delayQualified: false, delayUnqualified: false,
    onTimeQualified: false, onTimeUnqualified: true,
    benefits: '', procurementDate: '', expectedDate: '',
    assignedConsultant: '林顾问', costRelated: '否'
  },
  {
    no: 2, proposedDate: '2018-05-27', domain: '信息化管理', importance: 'A',
    subject: '建立精益项目考核办法并颁布实施',
    currentProblems: '结合精益项目辅导过程中待办事项的执行、培训的参与等指标建立',
    improvementPlan: '1.建立精益项目主考核办法\n2.要求各项目组建立项目组考核办法\n3.参考顾问组提供范例',
    supportNeeded: '各项目组组长', leadDepartment: '精益办', primaryOwner: '王强',
    secondaryOwner: '-', collaborator: '-', deadline: '2017-02-17',
    actualDate: '', status: '过期', evidenceStatus: '',
    leanOfficeConfirm: '李主任', consultantConfirm: '林顾问',
    followUp: '确认OA功能的完成期限', delayRecord: '2/15申请延期到3/15完成',
    delayReason: 'OA系统厂商未及时到公司协助', delayMeasure: '与OA厂商书面确定维护日期',
    delayQualified: false, delayUnqualified: false,
    onTimeQualified: true, onTimeUnqualified: false,
    benefits: '', procurementDate: '', expectedDate: '',
    assignedConsultant: '林顾问', costRelated: '否'
  }
];

function generateDemoData() {
  var subjects = [
    '设备点检制度优化与执行', '车间5S可视化标准制定', '生产线节拍时间测定与平衡',
    '仓储区域定置定位改善', '安全生产隐患排查与整改', '工艺标准化作业指导书编制',
    '供应商交期管理与评估优化', '员工技能矩阵图制作与更新', '物料看板系统导入与运行',
    '质量异常快速响应机制建立', '设备OEE数据采集与分析', '在制品库存控制与流转优化',
    '现场浪费识别与消除活动', '目视化管理标准手册编制', '班组长每日管理项目标准化',
    '改善提案制度推行与激励', '生产计划达成率提升方案', '产线人员技能培训计划',
    '采购成本递减专项改善', '物流周转器具标准化设计', '安全风险辨识与控制清单',
    '设备预防性维护计划制定', '车间现场布局优化改善', '库存周转率提升方案实施',
    '质量数据统计分析系统建立', '工艺参数优化与验证', '员工多技能培训体系搭建',
    '生产现场异常安灯系统导入', '成本核算精细化方案推行', '设备综合效率提升专项',
    '现场改善周活动组织与总结', '标准作业文件体系完善', '物料配送路线优化设计',
    '安全生产标准化达标创建', '质量管理体系审核整改', '车间KPI看板设计与运行',
    '生产周期时间缩短专项', '设备备件管理系统建立', '现场5S红牌作战活动实施',
    '工艺流程优化与再造', '人员效率提升方案制定', '物流仓储WMS系统优化',
    '安全应急演练计划实施', '采购流程标准化建设', '生产排程优化系统导入',
    '设备故障率降低专项', '在制品流转改善', '质量管理前置预防机制',
    '现场管理巡检制度建立'
  ];
  var owners = CONFIG.defaultPersonnel.map(function(p) { return p.name; });
  var depts = CONFIG.defaultDepartments.map(function(d) { return d.name; });
  var domains = CONFIG.domains;
  var importanceVals = ['A', 'B', 'C', 'D'];
  var consultants = CONFIG.defaultConsultants.map(function(c) { return c.name; });

  var data = [];
  var projectCounters = { 1: 2, 2: 0, 3: 0 }; // 项目待办计数器

  // 先放两条真实范例
  SAMPLE_TODOS_RAW.forEach(function(t, i) {
    data.push({
      id: i + 1, ...t,
      projectId: 1, companyId: 1,
      todoUid: generateTodoUid(1, i + 1),
      evidenceFiles: [], closerNotes: '',
      closerId: null, closerConfirmedBy: '', closerRejectedReason: '',
      createdAt: '2018-05-27T00:00:00', updatedAt: '2018-05-27T00:00:00'
    });
  });

  // 分配待办到3个项目
  for (var i = 0; i < subjects.length; i++) {
    var projectId = (i % 3) + 1;
    projectCounters[projectId] = (projectCounters[projectId] || 0) + 1;
    var proposedDate = randomDate(new Date(2018, 0, 1), new Date(2026, 5, 1));
    var deadline = randomDate(new Date(2018, 2, 1), new Date(2026, 11, 31));
    var today = new Date();
    var status, actualDate = '';

    var r = Math.random();
    if (r < 0.5) { status = '已完成'; actualDate = formatDate(randomDate(new Date(proposedDate), deadline)); }
    else if (r < 0.72) { status = '期限内'; }
    else if (r < 0.9) { status = '过期'; }
    else { status = '已删除'; }

    if (deadline < today && status === '期限内') status = '过期';

    var evidenceStatus = status === '已完成' ? (Math.random() > 0.3 ? 'confirmed' : 'uploaded') : '';
    var evidenceFiles = evidenceStatus ? [{ name: '改善报告.pdf', size: 245600, type: 'application/pdf', uploadedAt: actualDate || formatDate(deadline), uploadedBy: '张明' }] : [];

    var todoUid = generateTodoUid(projectId, projectCounters[projectId]);

    data.push({
      id: data.length + 1, no: data.length + 1,
      todoUid: todoUid,
      proposedDate: formatDate(proposedDate),
      domain: domains[Math.floor(Math.random() * domains.length)],
      importance: importanceVals[Math.floor(Math.random() * importanceVals.length)],
      subject: subjects[i],
      currentProblems: '当前' + subjects[i] + '方面存在改善空间，需要系统梳理问题点并制定对策',
      improvementPlan: '1.成立改善小组\n2.现状调查与数据分析\n3.制定改善方案\n4.实施并验证效果',
      supportNeeded: Math.random() > 0.5 ? '需要跨部门协作支持' : '-',
      leadDepartment: depts[Math.floor(Math.random() * depts.length)],
      primaryOwner: owners[Math.floor(Math.random() * owners.length)],
      secondaryOwner: Math.random() > 0.6 ? owners[Math.floor(Math.random() * owners.length)] : '-',
      collaborator: Math.random() > 0.7 ? owners[Math.floor(Math.random() * owners.length)] : '-',
      deadline: formatDate(deadline), actualDate: actualDate,
      status: status, evidenceStatus: evidenceStatus, evidenceFiles: evidenceFiles,
      leanOfficeConfirm: status === '已完成' ? '李主任' : '',
      consultantConfirm: Math.random() > 0.6 ? consultants[Math.floor(Math.random() * consultants.length)] : '',
      followUp: status === '已完成' ? '持续跟踪改善效果' : '',
      delayRecord: status === '过期' && Math.random() > 0.5 ? '申请延期一个月' : '-',
      delayReason: status === '过期' && Math.random() > 0.5 ? '资源协调不到位' : '-',
      delayMeasure: status === '过期' && Math.random() > 0.5 ? '增加人力投入，优先排产' : '-',
      delayQualified: false, delayUnqualified: false,
      onTimeQualified: status === '已完成' && Math.random() > 0.5,
      onTimeUnqualified: status === '已完成' && Math.random() > 0.8,
      benefits: status === '已完成' ? '预计年度节省成本约15万元' : '',
      procurementDate: Math.random() > 0.8 ? formatDate(randomDate(new Date(2018, 0, 1), new Date(2026, 5, 1))) : '',
      expectedDate: Math.random() > 0.8 ? formatDate(randomDate(new Date(2018, 0, 1), new Date(2026, 11, 31))) : '',
      assignedConsultant: consultants[Math.floor(Math.random() * consultants.length)],
      costRelated: Math.random() > 0.7 ? '是' : '否',
      projectId: projectId, companyId: 1,
      closerNotes: status === '已完成' ? '改善已完成，效果已验证' : '',
      closerId: null,
      closerConfirmedBy: evidenceStatus === 'confirmed' ? '李主任' : '',
      closerRejectedReason: '',
      createdAt: formatDate(proposedDate) + 'T00:00:00',
      updatedAt: new Date().toISOString().split('T')[0] + 'T00:00:00'
    });
  }
  return data;
}

/** 生成项目内独立待办编号: PRJ{projectId}-T{seq} */
function generateTodoUid(projectId, seq) {
  return 'PRJ' + String(projectId).padStart(3, '0') + '-T' + String(seq).padStart(3, '0');
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// 简便哈希（演示用，密码均为 "123456"）
async function hashPassword(password) {
  try {
    var encoder = new TextEncoder();
    var data = encoder.encode(password);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  } catch (e) {
    // crypto.subtle 不可用时的 fallback（如某些非安全上下文）
    console.warn('crypto.subtle 不可用，使用简单哈希:', e);
    var h = 0;
    for (var i = 0; i < password.length; i++) {
      h = ((h << 5) - h) + password.charCodeAt(i);
      h |= 0;
    }
    return 'fallback_' + Math.abs(h).toString(16);
  }
}

async function initDemoPasswords() {
  var hash = await hashPassword('123456');
  DEMO_USERS.forEach(function(u) { u.passwordHash = hash; });
}
