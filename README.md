# DB Designer

Web 端数据库设计工具，支持 AI 辅助设计和数据库逆向工程。

## 功能特性

*   **可视化设计**: 拖拽创建表，直观管理字段和关系。

    <img width="100%" alt="可视化设计预览 1" src="https://github.com/user-attachments/assets/81785b67-3936-4be4-b424-3643c8873929" />
    <br/>
    <img width="100%" alt="可视化设计预览 2" src="https://github.com/user-attachments/assets/3554f12f-faac-4e7f-8105-b8be45d10ad0" />

*   **AI 智能助手**: 通过自然语言描述生成表结构，或上传图片生成表结构。

*   **数据库逆向工程**:

    <img width="100%" alt="逆向工程概览" src="https://github.com/user-attachments/assets/affb1f49-8cc4-4672-a3c0-b4d4d7bfa061" />

    *   **SQL 脚本导入**: 支持通过执行 SQL 脚本并粘贴 JSON 结果来导入 MySQL, Oracle, PostgreSQL 结构。
    
        <img width="100%" alt="脚本导入" src="https://github.com/user-attachments/assets/6d1d655c-6ed7-416f-abb6-9bf018fd8621" />

    *   **直连导入**: 支持直接连接 PostgreSQL 数据库进行导入，目前默认是 public 模式。
    
        <img width="100%" alt="直连导入" src="https://github.com/user-attachments/assets/0f33d465-ce63-4bc5-8f65-345940b5d74e" />

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
VITE_AI_API_KEY=your_api_key
VITE_AI_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
VITE_AI_MODEL_TEXT=qwen3-max
VITE_AI_MODEL_VISION=qwen3-vl-plus

# 注意: 本项目默认使用通义千问的文字模型与视觉模型，也兼容 OpenAI 标准格式接口。
# 如使用 OpenAI，请将 URL 改为 https://api.openai.com/v1/chat/completions 并修改模型名称。
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

## 🤝 团队协作

本工具支持简单的团队共享模式：
申请加入非本人创建的项目，创建人同意后，即可与项目成员共同协作，版本管理中可以看到协作历史。

1.  **团队访问**: 团队成员无需安装任何环境，直接通过浏览器访问服务器地址即可共同协作。
2.  **注意事项**: 
    *   当前采用**覆盖式保存**机制（Last Write Wins）。
    *   建议在保存前查看**历史版本**，避免覆盖他人工作。
    *   利用内置的**版本管理**功能，任何重大修改后系统会自动生成新版本，方便回滚。

## 贡献

欢迎提交 Pull Request 或 Issue。
