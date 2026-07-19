# 群晖 NAS 部署指南

本指南将帮助您将精益项目待办管理系统部署到群晖 NAS 上，实现跨设备数据同步。

---

## 前提条件

- 群晖 NAS 已开机并可访问 DSM 界面
- NAS 与您的电脑/手机在同一局域网内（或已配置外网访问）
- NAS 的 80/443 端口未被其他服务占用

---

## 第一步：安装 Web Station 和 PHP

1. 登录群晖 DSM 界面
2. 打开 **套件中心**（Package Center）
3. 搜索并安装以下套件：
   - **Web Station** — 网站托管服务
   - **PHP 8.0**（或更高版本）— PHP 运行环境
4. 安装完成后，打开 **Web Station**

---

## 第二步：创建网站

1. 在 Web Station 中，点击 **网页服务** → **网页服务门户**
2. 点击 **创建**
3. 配置如下：
   - **门户名称**：`精益待办系统`
   - **类型**：静态网站（Static Website）
   - **根目录**：`/web/todo-system`
   - **HTTP 端口**：80（默认）
   - **HTTPS 端口**：443（如有证书则开启）
4. 点击 **创建**

> 注意：虽然选择"静态网站"，但 PHP 文件也会正常执行，因为 Web Station 默认支持 PHP。

---

## 第三步：上传文件到 NAS

### 方法 A：通过 File Station（推荐）

1. 打开 **File Station**
2. 进入 `web` 共享文件夹
3. 创建新文件夹 `todo-system`
4. 将以下文件从您的电脑拖入 `web/todo-system/` 目录：

```
todo-system/
├── index.html              ← 必须上传
├── api.php                 ← 必须上传（同步后端）
├── .gitignore              ← 可选
├── README.md               ← 可选
├── css/
│   └── style.css           ← 必须上传
├── js/
│   ├── auth.js             ← 必须上传
│   ├── config.js           ← 必须上传
│   └── store.js            ← 必须上传（已含同步层）
└── vendor/
    ├── echarts.min.js      ← 必须上传
    ├── html2canvas.min.js  ← 必须上传
    └── xlsx.full.min.js    ← 必须上传
```

### 方法 B：通过 SMB 共享文件夹

1. 在 Windows 资源管理器地址栏输入：`\\你的NAS_IP`
2. 找到 `web` 文件夹
3. 创建 `todo-system` 子文件夹
4. 复制所有文件进去

---

## 第四步：设置文件权限

通过 File Station 操作：

1. 右键 `web/todo-system` 文件夹 → **属性**
2. 切换到 **权限** 标签
3. 确保 **http** 用户（Web Station 服务用户）拥有 **读取/写入** 权限
4. 点击 **应用到该文件夹、子文件夹和文件**
5. 确认保存

> 这一步非常重要！api.php 需要写入 data.json 和备份文件，权限不对会导致同步失败。

---

## 第五步：验证部署

### 局域网访问

1. 在电脑浏览器中访问：`http://你的NAS_IP/todo-system/`
   - 例如：`http://192.168.1.100/todo-system/`
2. 应看到登录页面

### 验证 API 是否工作

在浏览器中访问：`http://你的NAS_IP/todo-system/api.php?ping`

应返回类似：
```json
{"ok":true,"server":"NAS PHP API","time":"2026-07-18T19:30:00+08:00","data_exists":false,"data_size":0}
```

### 验证同步状态

1. 登录系统后，查看顶部栏右侧的同步状态指示器
2. 如果显示 **"已同步"**（绿色圆点）→ NAS 后端工作正常
3. 如果显示 **"本地模式"**（灰色圆点）→ API 不可用，检查 PHP 和权限

---

## 第六步（可选）：外网访问

### 方式 A：群晖 DDNS + 端口转发

1. DSM → **控制面板** → **外部访问** → **DDNS**
2. 添加 DDNS 服务（群晖免费提供 `xxx.synology.me` 域名）
3. 在路由器上设置端口转发：
   - 外部端口 8080 → NAS IP:80
   - 外部端口 8443 → NAS IP:443
4. 访问：`http://你的DDNS域名:8080/todo-system/`

### 方式 B：使用 HTTPS

1. DSM → **控制面板** → **安全性** → **证书**
2. 添加 Let's Encrypt 证书（免费）
3. 在 Web Station 的门户设置中启用 HTTPS

---

## 数据同步原理

```
手机浏览器 ──→ NAS (index.html + api.php)
                  ↕
PC浏览器   ──→ NAS (data.json 共享数据文件)
```

- 所有设备访问同一个 NAS 地址
- 数据存储在 NAS 的 `data.json` 文件中
- 每次操作自动同步到 NAS（防抖延迟 2 秒）
- 每 30 秒自动从 NAS 拉取最新数据
- 如果 NAS 不可达，自动切换到本地离线模式
- NAS 自动保留最近 10 份数据备份（backups/ 目录）

## 数据备份

系统自动在 `backups/` 目录中保留最近 10 份数据备份：
- 每次数据变更时自动创建备份
- 备份文件名格式：`data_20260718_193000.json`
- 可随时手动从 backups 目录恢复数据

---

## 常见问题

### Q: 同步状态显示"本地模式"怎么办？
A: 检查以下几点：
1. api.php 是否已上传到 NAS
2. PHP 是否已在 Web Station 中启用
3. todo-system 文件夹权限是否包含 http 用户的写入权限
4. 访问 `api.php?ping` 看是否返回 JSON

### Q: 同步状态显示"同步失败"怎么办？
A: 通常是权限问题：
1. 检查 `web/todo-system/` 文件夹权限
2. 确保 http 用户有写入权限
3. 尝试手动创建空 `data.json` 文件并设置权限

### Q: 多人同时操作会冲突吗？
A: 采用"后保存覆盖先保存"策略。如果两人同时编辑同一条待办，最后保存的人的数据会覆盖前面的。建议重要操作前先刷新页面。

### Q: 手机访问需要安装 APP 吗？
A: 不需要。手机浏览器直接访问 NAS 地址即可，系统已做移动端适配。建议添加到主屏幕以便快速访问。
