# DB Designer

Web 端数据库设计工具，支持 AI 辅助设计和数据库逆向工程。

## 功能特性

*   **可视化设计**: 拖拽创建表，直观管理字段和关系。
*   **AI 智能助手**: 通过自然语言描述生成表结构，或上传图片生成 Schema。
*   **数据库逆向工程**:
    *   **SQL 脚本导入**: 支持通过执行 SQL 脚本并粘贴 JSON 结果来导入 MySQL, Oracle, PostgreSQL 结构。
    *   **直连导入**: 支持直接连接 PostgreSQL 数据库进行导入。
*   **版本管理**: 自动保存历史版本，支持回滚。
*   **导出功能**: 支持导出 SQL 文件、PNG 图片、SVG 矢量图。
*   **多主题**: 支持亮色/暗色模式。

## 技术栈

*   **前端**: React, Vite, React Flow (Canvas)
*   **后端**: Node.js, Express, PostgreSQL
*   **AI**: Aliyun DashScope (Qwen-Max/Qwen-VL)

## 快速开始

### 1. 环境准备

确保已安装：
*   Node.js (v18+)
*   PostgreSQL 数据库

### 2. 配置环境变量

复制 `.env.example` (如果存在) 或创建 `.env` 文件：

**前端 (.env):**
```
VITE_AI_API_KEY=your_dashscope_api_key
```

**后端 (server/.env):**
```
DB_USER=your_db_user
DB_HOST=localhost
DB_NAME=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432
```

### 3. 安装依赖

根目录 (前端):
```bash
npm install
```

`server` 目录 (后端):
```bash
cd server
npm install
```

### 4. 启动项目

根目录 (前端):
```bash
npm run dev
```

`server` 目录 (后端):
```bash
cd server
npm start
```

## 贡献

欢迎提交 Pull Request 或 Issue。
