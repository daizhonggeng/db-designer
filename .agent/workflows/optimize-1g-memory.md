---
description: 1G 内存服务器优化配置
---

# 1G 内存服务器优化指南

## PostgreSQL 优化

编辑 PostgreSQL 配置文件：

```bash
sudo nano /etc/postgresql/*/main/postgresql.conf
```

添加或修改以下配置：

```conf
# 内存设置（针对 1G 内存服务器）
shared_buffers = 128MB              # 默认可能是 128MB，保持不变
effective_cache_size = 256MB        # 降低缓存预期
work_mem = 4MB                      # 降低工作内存
maintenance_work_mem = 32MB         # 降低维护内存
max_connections = 20                # 限制最大连接数

# 减少检查点频率以降低 I/O
checkpoint_completion_target = 0.9
wal_buffers = 8MB
```

重启 PostgreSQL：

```bash
sudo systemctl restart postgresql
```

## Node.js 后端优化

修改 `server/db.js` 限制连接池大小：

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'db_designer',
    user: process.env.DB_USER || 'db_designer_user',
    password: process.env.DB_PASSWORD,
    max: 5,                    // 最大连接数（默认 10）
    idleTimeoutMillis: 30000,  // 空闲连接超时
    connectionTimeoutMillis: 2000
});

module.exports = pool;
```

## PM2 优化配置

创建 PM2 配置文件 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'db-designer-api',
    script: './index.js',
    instances: 1,              // 只运行 1 个实例（不使用集群模式）
    exec_mode: 'fork',         // fork 模式而非 cluster
    max_memory_restart: '200M', // 超过 200M 自动重启
    node_args: '--max-old-space-size=200', // 限制 Node.js 堆内存为 200MB
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

使用配置文件启动：

```bash
cd /var/www/db-designer/server
pm2 start ecosystem.config.js
pm2 save
```

## Nginx 优化

编辑 Nginx 配置：

```bash
sudo nano /etc/nginx/nginx.conf
```

优化工作进程和连接数：

```nginx
user www-data;
worker_processes 1;              # 1G 内存只用 1 个工作进程
worker_rlimit_nofile 1024;

events {
    worker_connections 512;      # 降低连接数
    use epoll;
}

http {
    # 基本设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 30;        # 降低保持连接时间
    types_hash_max_size 2048;
    client_max_body_size 10M;    # 限制上传大小

    # 关闭访问日志以节省 I/O（可选）
    access_log off;
    error_log /var/log/nginx/error.log warn;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/json application/javascript;

    include /etc/nginx/mime.types;
    include /etc/nginx/sites-enabled/*;
}
```

## 系统级优化

### 1. 配置 Swap（交换空间）

**重要**：1G 内存服务器强烈建议配置 Swap

```bash
# 创建 1G Swap 文件
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 永久启用
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 调整 swappiness（降低使用 swap 的倾向）
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

### 2. 禁用不必要的服务

```bash
# 查看运行的服务
systemctl list-units --type=service --state=running

# 禁用不需要的服务（示例）
sudo systemctl disable snapd
sudo systemctl stop snapd
```

### 3. 限制日志大小

```bash
# 限制 journald 日志大小
sudo nano /etc/systemd/journald.conf
```

修改：

```conf
SystemMaxUse=50M
RuntimeMaxUse=50M
```

重启服务：

```bash
sudo systemctl restart systemd-journald
```

## 监控内存使用

### 安装监控工具

```bash
# 安装 htop
sudo apt install htop

# 使用 htop 查看实时内存使用
htop
```

### 查看内存使用脚本

创建监控脚本 `check-memory.sh`：

```bash
#!/bin/bash
echo "=== 内存使用情况 ==="
free -h
echo ""
echo "=== 进程内存占用 TOP 10 ==="
ps aux --sort=-%mem | head -11
echo ""
echo "=== Swap 使用情况 ==="
swapon --show
```

```bash
chmod +x check-memory.sh
./check-memory.sh
```

## 构建优化

在本地构建前端，而不是在服务器上构建：

```bash
# 在本地机器上
cd db-designer
npm run build

# 只上传 dist 目录到服务器
scp -r dist/ username@server:/var/www/db-designer/
```

这样可以避免在服务器上运行 `npm install` 和 `npm run build`，节省大量内存。

## 应急措施

如果内存不足导致服务崩溃：

```bash
# 1. 重启服务
pm2 restart db-designer-api

# 2. 清理系统缓存
sudo sync && sudo sysctl -w vm.drop_caches=3

# 3. 检查内存占用
free -h
ps aux --sort=-%mem | head -10
```

## 性能监控告警

设置 PM2 监控：

```bash
# 安装 PM2 监控模块
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 3
```

## 预期性能

使用以上优化后，1G 内存服务器可以支持：
- **并发用户**: 5-10 人同时使用
- **项目数量**: 几十到上百个项目
- **响应时间**: 正常使用下 < 1 秒

## 升级建议

如果遇到以下情况，建议升级到 2G 内存：
- 经常出现内存不足
- 频繁使用 Swap 导致性能下降
- 需要支持更多并发用户（>10人）
- 需要运行其他服务

## 替代方案

如果 1G 内存确实不够用，可以考虑：

1. **使用轻量级数据库**: 将 PostgreSQL 替换为 SQLite
2. **使用外部数据库服务**: 使用云数据库服务（如 AWS RDS Free Tier）
3. **前后端分离部署**: 前端部署到静态托管服务（如 Vercel、Netlify）
