# DB Designer

一个基于 React + Vite + Express + SQLite 的 Web 数据库设计工具，支持可视化建模、AI 辅助建模、结构逆向导入和历史版本管理。

## 这次整理后的重点改进

- 登录注册不再使用明文密码比对，后端会对密码做哈希存储。
- 前后端改成了统一的 API 调用层，去掉了前端写死的接口地址。
- 项目、版本、申请审批等接口补上了鉴权和权限校验。
- 增加了前后端环境变量示例、Vite 代理和更完整的脚本。
- 清理了一批低质量实现，项目现在可以通过 `lint` 和前端生产构建。

## 技术栈

首次使用与这一版的体验改动见 [体验优化说明](docs/体验优化说明.md)，包含示例起步、自动保存、草稿恢复和备份操作。

- 前端：React 19、Vite
- 后端：Node.js、Express、SQLite（Node.js 内置 `node:sqlite`）
- AI：兼容 OpenAI 格式的聊天补全接口，默认示例为 DashScope

## 目录结构

```text
db-designer/
  src/              前端源码
  server/           后端服务与数据库初始化脚本
  public/           静态资源
```

## 环境要求

- Node.js 22.16+（推荐 Node.js 24 LTS）
- 无需安装数据库服务；PostgreSQL 驱动仅用于逆向导入外部数据库。

## 环境变量

### 前端

复制根目录下的 `.env.example` 为 `.env`：

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
VITE_AI_API_KEY=
VITE_AI_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
VITE_AI_MODEL_TEXT=qwen3-max
VITE_AI_MODEL_VISION=qwen3-vl-plus
```

说明：

- 本地开发如果使用 Vite 代理，`VITE_API_BASE_URL` 也可以留空。
- 若使用 OpenAI 兼容接口，请把 `VITE_AI_API_URL` 和模型名改成对应配置。

### 后端

复制 `server/.env.example` 为 `server/.env`：

```env
PORT=3000
SQLITE_PATH=data/db-designer.sqlite
AUTH_SECRET=change-this-to-a-random-long-string
CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173
```

`AUTH_SECRET` 请务必改成生产环境自己的长随机字符串。

## 安装依赖

根目录：

```bash
npm install
```

后端目录：

```bash
cd server
npm install
```

## 初始化数据库

后端首次启动会自动创建数据库文件和所需表，无需单独启动 PostgreSQL。默认文件为 `server/data/db-designer.sqlite`，已从 Git 排除。`SQLITE_PATH` 可指定绝对路径，或相对于 `server/` 的路径。备份时先停止后端，再复制数据库文件。

如需提前初始化，可执行：

```bash
cd server
npm run init-db
```

以下命令保留为 SQLite 幂等初始化入口，不会导入旧 PostgreSQL 数据：

```bash
npm run migrate
npm run migrate:versions
```

## 启动开发环境

启动后端：

```bash
cd server
npm run dev
```

启动前端：

```bash
npm run dev
```

默认情况下：

- 前端开发地址：`http://127.0.0.1:5173`
- 后端接口地址：`http://127.0.0.1:3000`

## 常用脚本

根目录：

```bash
npm run dev
npm run build
npm run lint
npm run server:dev
npm run server:init-db
```

后端目录：

```bash
npm run dev
npm run start
npm run init-db
npm run migrate
npm run migrate:versions
```

## 验证

- `npm run lint`
- `npm run build`
- `node --check server/index.js`
- `node --check server/initDb.js`
- `npm --prefix server test`：使用独立临时 SQLite 文件验证注册登录、项目与版本持久化、协作及级联删除。

## 仍需注意

- 当前登录态使用的是轻量级服务端签名 token，适合内部工具和轻量部署；如果后续要对外公开，建议继续升级为标准会话或 JWT 方案。
- 依赖安装后仍有 `npm audit` 报告的已知漏洞，后续可以单独做一轮依赖升级验证。
- SQLite 切换不会自动迁移旧 PostgreSQL 数据；需要保留旧账号和项目时，应先单独迁移。
- `node:sqlite` 在部分 Node.js 版本中会提示实验性 API 警告，不影响本地启动。
