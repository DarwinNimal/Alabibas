<?php
require __DIR__ . '/config.php';
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
$pdo = new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

function ensureCol($pdo, $t, $c, $def) {
    $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute([$t, $c]);
    if (!$q->fetchColumn()) $pdo->exec("ALTER TABLE `$t` ADD `$c` $def");
}

// Creates what's missing, once. Delete .schema_done to re-run.
if (!file_exists(__DIR__ . '/.schema_done')) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_users(
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_messages(
        id INT AUTO_INCREMENT PRIMARY KEY, customer_id VARCHAR(64) NOT NULL, customer_name VARCHAR(100),
        sender ENUM('customer','admin') NOT NULL, text TEXT NOT NULL, is_read TINYINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX(customer_id))");
    $pdo->exec('CREATE TABLE IF NOT EXISTS `' . PRODUCTS_TABLE . '`(`' . COL_ID . '` INT AUTO_INCREMENT PRIMARY KEY, `' . COL_NAME . '` VARCHAR(150) NOT NULL)');
    ensureCol($pdo, PRODUCTS_TABLE, 'stock_type', "ENUM('limited','unlimited') NOT NULL DEFAULT 'limited'");
    ensureCol($pdo, PRODUCTS_TABLE, 'quantity', 'INT NOT NULL DEFAULT 0');
    ensureCol($pdo, PRODUCTS_TABLE, 'sold_count', 'INT NOT NULL DEFAULT 0');
    if (!$pdo->query('SELECT COUNT(*) c FROM admin_users')->fetch()['c'])
        $pdo->prepare('INSERT INTO admin_users(username,password_hash) VALUES(?,?)')->execute(['admin', password_hash(getenv('ADMIN_PASS') ?: '12345', PASSWORD_DEFAULT)]);
    @file_put_contents(__DIR__ . '/.schema_done', '1');
}

function jsonOut($d, $code = 200) { http_response_code($code); header('Content-Type: application/json'); echo json_encode($d); exit; }
function body() { return json_decode(file_get_contents('php://input'), true) ?: []; }
function cleanText($t) { return mb_substr(trim((string)$t), 0, 2000); }
