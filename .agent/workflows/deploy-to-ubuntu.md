---
description: 部署项目到 Ubuntu 服务器
---

# 部署 DB Designer 到 Ubuntu 服务器

## 前置要求

1. 一台 Ubuntu 服务器（建议 Ubuntu 20.04 或更高版本）
2. 服务器上有 sudo 权限
3. 域名（可选，用于配置 HTTPS）

## 步骤 1: 安装必要软件

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装 Node.js (使用 NodeSource 仓库安装最新 LTS 版本)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version

# 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 安装 Nginx (用作反向代理)
sudo apt install -y nginx

# 安装 PM2 (用于进程管理)
sudo npm install -g pm2
```

## 步骤 2: 配置 PostgreSQL

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 PostgreSQL 中执行以下命令:
CREATE DATABASE db_designer;
CREATE USER db_designer_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE db_designer TO db_designer_user;
\q
```

## 步骤 3: 上传项目文件

在本地机器上，将项目打包并上传到服务器：

```bash
# 在本地项目目录执行
# 排除 node_modules 和其他不必要的文件
tar -czf db-designer.tar.gz --exclude=node_modules --exclude=.git --exclude=dist .

# 使用 scp 上传到服务器
scp db-designer.tar.gz username@your-server-ip:/home/username/
```

在服务器上解压：

```bash
# SSH 登录到服务器
ssh username@your-server-ip

# 创建项目目录
mkdir -p /var/www/db-designer
cd /var/www/db-designer

# 解压项目
tar -xzf ~/db-designer.tar.gz
```

## 步骤 4: 配置环境变量

创建后端环境配置文件：

```bash
# 在服务器上创建 server/.env 文件
cd /var/www/db-designer/server
nano .env
```

添加以下内容：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db_designer
DB_USER=db_designer_user
DB_PASSWORD=your_secure_password
PORT=3000
NODE_ENV=production
```

## 步骤 5: 修改数据库连接配置

编辑 `server/db.js` 使用环境变量：

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'db_designer',
    user: process.env.DB_USER || 'db_designer_user',
    password: process.env.DB_PASSWORD
});

module.exports = pool;
```

安装 dotenv：

```bash
cd /var/www/db-designer/server
npm install dotenv
```

## 步骤 6: 安装依赖并初始化数据库

```bash
# 安装后端依赖
cd /var/www/db-designer/server
npm install

# 初始化数据库表
node initDb.js

# 运行迁移脚本
node migrate.js
node migrate_versions.js

# 安装前端依赖
cd /var/www/db-designer
npm install

# 构建前端
npm run build
```

## 步骤 7: 配置 Nginx

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/db-designer
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或服务器IP

    # 前端静态文件
    location / {
        root /var/www/db-designer/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点并重启 Nginx：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/db-designer /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

## 步骤 8: 使用 PM2 启动后端服务

```bash
cd /var/www/db-designer/server

# 启动后端服务
pm2 start index.js --name db-designer-api

# 保存 PM2 配置
pm2 save

# 设置 PM2 开机自启
pm2 startup
# 按照输出的命令执行
```

## 步骤 9: 配置防火墙

```bash
# 允许 HTTP 和 HTTPS
sudo ufw allow 'Nginx Full'

# 如果使用 SSH，确保允许 SSH
sudo ufw allow OpenSSH

# 启用防火墙
sudo ufw enable
```

## 步骤 10: 配置 HTTPS（可选但推荐）

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书并自动配置 Nginx
sudo certbot --nginx -d your-domain.com

# 测试自动续期
sudo certbot renew --dry-run
```

## 步骤 11: 修改前端 API 地址

在部署前，需要修改前端代码中的 API 地址。

编辑所有前端文件中的 API 调用，将 `http://localhost:3000` 替换为：
- 如果使用域名：`https://your-domain.com`
- 如果使用 IP：`http://your-server-ip`

或者创建环境变量配置文件 `src/config.js`：

```javascript
export const API_BASE_URL = import.meta.env.PROD 
    ? 'https://your-domain.com' 
    : 'http://localhost:3000';
```

然后在所有 API 调用中使用：

```javascript
import { API_BASE_URL } from '../config';

fetch(`${API_BASE_URL}/api/projects`)
```

重新构建前端：

```bash
cd /var/www/db-designer
npm run build
```

## 常用管理命令

```bash
# 查看后端服务状态
pm2 status

# 查看后端日志
pm2 logs db-designer-api

# 重启后端服务
pm2 restart db-designer-api

# 停止后端服务
pm2 stop db-designer-api

# 查看 Nginx 状态
sudo systemctl status nginx

# 重启 Nginx
sudo systemctl restart nginx

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

## 故障排查

### 后端无法连接数据库

```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 检查数据库连接
sudo -u postgres psql -d db_designer -c "SELECT 1;"
```

### 前端无法访问

```bash
# 检查 Nginx 配置
sudo nginx -t

# 检查前端文件是否存在
ls -la /var/www/db-designer/dist
```

### API 请求失败

```bash
# 检查后端服务是否运行
pm2 status

# 检查后端日志
pm2 logs db-designer-api

# 测试 API 是否可访问
curl http://localhost:3000/api/projects
```

## 性能优化建议

1. **启用 Nginx Gzip 压缩**：编辑 `/etc/nginx/nginx.conf`，启用 gzip
2. **配置 PostgreSQL 连接池**：在 `db.js` 中调整连接池大小
3. **使用 CDN**：将静态资源托管到 CDN
4. **配置缓存**：在 Nginx 中配置静态资源缓存

## 安全建议

1. 定期更新系统和软件包
2. 使用强密码
3. 配置 fail2ban 防止暴力破解
4. 定期备份数据库
5. 限制数据库只允许本地连接
6. 使用 HTTPS

## 数据库备份

```bash
# 创建备份脚本
nano /home/username/backup-db.sh
```

添加内容：

```bash
#!/bin/bash
BACKUP_DIR="/home/username/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump db_designer > $BACKUP_DIR/db_designer_$DATE.sql
# 保留最近 7 天的备份
find $BACKUP_DIR -name "db_designer_*.sql" -mtime +7 -delete
```

设置定时任务：

```bash
chmod +x /home/username/backup-db.sh
crontab -e
# 添加每天凌晨 2 点备份
0 2 * * * /home/username/backup-db.sh
```

## 完成

现在您的 DB Designer 应该已经成功部署到 Ubuntu 服务器上了！

访问 `http://your-domain.com` 或 `http://your-server-ip` 即可使用。
