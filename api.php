<?php
/**
 * 精益项目待办管理系统 — NAS 后端 API
 * 部署在群晖 NAS Web Station 上，实现跨设备数据同步
 *
 * 功能：
 *   GET  api.php        → 读取 data.json
 *   POST api.php        → 写入 data.json
 *   GET  api.php?ping   → 健康检查
 */

// ── CORS 头（允许所有来源访问）──
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// ── 数据文件路径 ──
$DATA_FILE = __DIR__ . '/data.json';
$BACKUP_DIR = __DIR__ . '/backups';

// ── 处理预检请求 ──
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// ── 健康检查 ──
if (isset($_GET['ping'])) {
    echo json_encode([
        'ok' => true,
        'server' => 'NAS PHP API',
        'time' => date('c'),
        'data_exists' => file_exists($DATA_FILE),
        'data_size' => file_exists($DATA_FILE) ? filesize($DATA_FILE) : 0
    ]);
    exit(0);
}

// ── GET：读取数据 ──
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($DATA_FILE)) {
        // 直接输出文件内容（已经是 JSON）
        readfile($DATA_FILE);
    } else {
        // 数据文件不存在，返回 null（前端会自动初始化演示数据）
        echo json_encode(null);
    }
    exit(0);
}

// ── POST：写入数据 ──
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    
    // 验证 JSON 格式
    $decoded = json_decode($input);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid JSON: ' . json_last_error_msg()]);
        exit(0);
    }
    
    // 限制数据大小（防止恶意大文件，10MB 足够）
    if (strlen($input) > 10 * 1024 * 1024) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'error' => 'Data too large']);
        exit(0);
    }
    
    // 创建备份目录（首次写入时）
    if (!is_dir($BACKUP_DIR)) {
        @mkdir($BACKUP_DIR, 0755, true);
    }
    
    // 如果已有旧数据，先备份（保留最近 10 份）
    if (file_exists($DATA_FILE)) {
        $backupFile = $BACKUP_DIR . '/data_' . date('Ymd_His') . '.json';
        @copy($DATA_FILE, $backupFile);
        
        // 清理旧备份，只保留最近 10 份
        $backups = glob($BACKUP_DIR . '/data_*.json');
        if ($backups && count($backups) > 10) {
            sort($backups);
            for ($i = 0; $i < count($backups) - 10; $i++) {
                @unlink($backups[$i]);
            }
        }
    }
    
    // 写入数据（使用文件锁防止并发冲突）
    $result = file_put_contents($DATA_FILE, $input, LOCK_EX);
    
    if ($result === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Write failed (check permissions)']);
        exit(0);
    }
    
    echo json_encode(['ok' => true, 'size' => $result]);
    exit(0);
}

// ── 其他方法 ──
http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
?>
