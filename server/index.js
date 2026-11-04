require('dotenv').config();
const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const db = require('./db');

const scrypt = promisify(crypto.scrypt);
const app = express();
const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const AUTH_SECRET = process.env.AUTH_SECRET || 'db-designer-dev-secret';
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

function parsePositiveInt(value) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function toBase64Url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function fromBase64Url(value) {
    const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (normalizedValue.length % 4)) % 4);
    return Buffer.from(`${normalizedValue}${padding}`, 'base64').toString('utf8');
}

function createAuthToken(user) {
    const payload = {
        sub: user.id,
        username: user.username,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

    return `${encodedPayload}.${signature}`;
}

function verifyAuthToken(token) {
    const [encodedPayload, incomingSignature] = token.split('.');

    if (!encodedPayload || !incomingSignature) {
        return null;
    }

    const expectedSignature = crypto
        .createHmac('sha256', AUTH_SECRET)
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

    const signatureBuffer = Buffer.from(incomingSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const payload = JSON.parse(fromBase64Url(encodedPayload));
        const userId = parsePositiveInt(payload?.sub);

        if (!userId || !isNonEmptyString(payload?.username) || payload.exp < Date.now()) {
            return null;
        }

        return {
            id: userId,
            username: payload.username,
        };
    } catch {
        return null;
    }
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeProject(project) {
    if (!project) {
        return null;
    }

    const { schema_data: schemaData, ...rest } = project;
    return {
        ...rest,
        schema_data: schemaData || {},
    };
}

function sendError(res, status, message) {
    return res.status(status).json({ error: message });
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedPassword) {
    if (!storedPassword.includes(':')) {
        return password === storedPassword;
    }

    const [salt, key] = storedPassword.split(':');
    const derivedKey = await scrypt(password, salt, 64);
    const storedBuffer = Buffer.from(key, 'hex');

    if (storedBuffer.length !== derivedKey.length) {
        return false;
    }

    return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

async function getProjectAccess(projectId, userId) {
    const result = await db.query(
        `
            SELECT
                p.id,
                p.user_id,
                CASE
                    WHEN p.user_id = $2 THEN 'owner'
                    WHEN pm.role IS NOT NULL THEN pm.role
                    ELSE NULL
                END AS role
            FROM projects p
            LEFT JOIN project_members pm
                ON pm.project_id = p.id AND pm.user_id = $2
            WHERE p.id = $1
            LIMIT 1
        `,
        [projectId, userId]
    );

    return result.rows[0] || null;
}

async function getVersionAccess(versionId, userId) {
    const result = await db.query(
        `
            SELECT
                pv.id,
                pv.project_id,
                CASE
                    WHEN p.user_id = $2 THEN 'owner'
                    WHEN pm.role IS NOT NULL THEN pm.role
                    ELSE NULL
                END AS role
            FROM project_versions pv
            INNER JOIN projects p ON p.id = pv.project_id
            LEFT JOIN project_members pm
                ON pm.project_id = p.id AND pm.user_id = $2
            WHERE pv.id = $1
            LIMIT 1
        `,
        [versionId, userId]
    );

    return result.rows[0] || null;
}

function requireAuth(req, res, next) {
    const authorizationHeader = req.header('authorization') || '';
    const token = authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice('Bearer '.length)
        : '';
    const authenticatedUser = token ? verifyAuthToken(token) : null;

    if (!authenticatedUser) {
        return sendError(res, 401, '请先登录');
    }

    req.userId = authenticatedUser.id;
    req.authenticatedUser = authenticatedUser;
    return next();
}

function requireProjectAccess(ownerOnly = false) {
    return async (req, res, next) => {
        const projectId = parsePositiveInt(req.params.id);
        if (!projectId) {
            return sendError(res, 400, '无效的项目 ID');
        }

        try {
            const access = await getProjectAccess(projectId, req.userId);

            if (!access) {
                return sendError(res, 404, '项目不存在');
            }

            if (!access.role) {
                return sendError(res, 403, '无权访问该项目');
            }

            if (ownerOnly && access.role !== 'owner') {
                return sendError(res, 403, '只有项目创建者可以执行此操作');
            }

            req.projectId = projectId;
            req.projectRole = access.role;
            return next();
        } catch (error) {
            console.error('Project access check failed:', error);
            return sendError(res, 500, '权限校验失败');
        }
    };
}

function requireVersionAccess(ownerOnly = false) {
    return async (req, res, next) => {
        const versionId = parsePositiveInt(req.params.versionId);
        if (!versionId) {
            return sendError(res, 400, '无效的版本 ID');
        }

        try {
            const access = await getVersionAccess(versionId, req.userId);

            if (!access) {
                return sendError(res, 404, '版本不存在');
            }

            if (!access.role) {
                return sendError(res, 403, '无权访问该版本');
            }

            if (ownerOnly && access.role !== 'owner') {
                return sendError(res, 403, '只有项目创建者可以执行此操作');
            }

            req.versionId = versionId;
            req.projectId = access.project_id;
            req.projectRole = access.role;
            return next();
        } catch (error) {
            console.error('Version access check failed:', error);
            return sendError(res, 500, '权限校验失败');
        }
    };
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.post('/api/register', async (req, res) => {
    const username = req.body.username?.trim();
    const password = req.body.password;

    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        return sendError(res, 400, '用户名和密码不能为空');
    }

    if (password.length < 6) {
        return sendError(res, 400, '密码长度不能少于 6 位');
    }

    try {
        const hashedPassword = await hashPassword(password);
        const result = await db.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, hashedPassword]
        );
        const user = result.rows[0];
        res.json({
            ...user,
            token: createAuthToken(user),
        });
    } catch (error) {
        if (error.errcode === 2067) {
            return sendError(res, 409, '用户名已存在');
        }
        console.error('Register failed:', error);
        return sendError(res, 500, '注册失败');
    }
});

app.post('/api/login', async (req, res) => {
    const username = req.body.username?.trim();
    const password = req.body.password;

    if (!isNonEmptyString(username) || !isNonEmptyString(password)) {
        return sendError(res, 400, '用户名和密码不能为空');
    }

    try {
        const result = await db.query(
            'SELECT id, username, password FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return sendError(res, 401, '用户名或密码错误');
        }

        const user = result.rows[0];
        const isValidPassword = await verifyPassword(password, user.password);

        if (!isValidPassword) {
            return sendError(res, 401, '用户名或密码错误');
        }

        if (!user.password.includes(':')) {
            const upgradedPassword = await hashPassword(password);
            await db.query(
                'UPDATE users SET password = $1 WHERE id = $2',
                [upgradedPassword, user.id]
            );
        }

        return res.json({
            id: user.id,
            username: user.username,
            token: createAuthToken(user),
        });
    } catch (error) {
        console.error('Login failed:', error);
        return sendError(res, 500, '登录失败');
    }
});

app.get('/api/projects/my-created', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            `
                SELECT
                    p.*,
                    (
                        SELECT COUNT(*)
                        FROM project_requests
                        WHERE project_id = p.id AND status = 'pending'
                    ) AS pending_requests
                FROM projects p
                WHERE p.user_id = $1
                ORDER BY p.created_at DESC
            `,
            [req.userId]
        );
        res.json(result.rows.map(sanitizeProject));
    } catch (error) {
        console.error('Load created projects failed:', error);
        res.status(500).json({ error: '加载项目失败' });
    }
});

app.get('/api/projects/my-collaborated', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            `
                SELECT p.*
                FROM projects p
                INNER JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.user_id = $1 AND pm.role = 'member'
                ORDER BY pm.joined_at DESC
            `,
            [req.userId]
        );
        res.json(result.rows.map(sanitizeProject));
    } catch (error) {
        console.error('Load collaborated projects failed:', error);
        res.status(500).json({ error: '加载协作项目失败' });
    }
});

app.get('/api/projects/available', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            `
                SELECT
                    p.*,
                    pr.status AS request_status
                FROM projects p
                LEFT JOIN project_members pm
                    ON p.id = pm.project_id AND pm.user_id = $1
                LEFT JOIN project_requests pr
                    ON p.id = pr.project_id AND pr.user_id = $1
                WHERE pm.id IS NULL AND p.user_id != $1
                ORDER BY p.created_at DESC
            `,
            [req.userId]
        );
        res.json(result.rows.map(sanitizeProject));
    } catch (error) {
        console.error('Load available projects failed:', error);
        res.status(500).json({ error: '加载可加入项目失败' });
    }
});

app.put('/api/projects/requests/:requestId', requireAuth, async (req, res) => {
    const requestId = parsePositiveInt(req.params.requestId);
    const { status } = req.body;

    if (!requestId) {
        return sendError(res, 400, '无效的申请 ID');
    }

    if (!['approved', 'rejected'].includes(status)) {
        return sendError(res, 400, '无效的申请状态');
    }

    try {
        const existingRequest = await db.query(
            `
                SELECT pr.*, p.user_id AS owner_id
                FROM project_requests pr
                INNER JOIN projects p ON p.id = pr.project_id
                WHERE pr.id = $1
            `,
            [requestId]
        );

        if (existingRequest.rows.length === 0) {
            return sendError(res, 404, '申请不存在');
        }

        const requestRow = existingRequest.rows[0];

        if (requestRow.owner_id !== req.userId) {
            return sendError(res, 403, '只有项目创建者可以审批申请');
        }

        const updatedRequest = await db.query(
            `
                UPDATE project_requests
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `,
            [status, requestId]
        );

        if (status === 'approved') {
            await db.query(
                `
                    INSERT INTO project_members (project_id, user_id, role)
                    VALUES ($1, $2, 'member')
                    ON CONFLICT (project_id, user_id) DO NOTHING
                `,
                [requestRow.project_id, requestRow.user_id]
            );
        }

        res.json(updatedRequest.rows[0]);
    } catch (error) {
        console.error('Handle request failed:', error);
        res.status(500).json({ error: '审批申请失败' });
    }
});

app.get('/api/projects/:id/versions', requireAuth, requireProjectAccess(false), async (req, res) => {
    try {
        const result = await db.query(
            `
                SELECT
                    id,
                    created_at,
                    created_by,
                    description
                FROM project_versions
                WHERE project_id = $1
                ORDER BY id DESC
            `,
            [req.projectId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Load versions failed:', error);
        res.status(500).json({ error: '加载历史版本失败' });
    }
});

app.post('/api/projects/:id/versions', requireAuth, requireProjectAccess(false), async (req, res) => {
    const { schema, user, description } = req.body;

    if (!schema || typeof schema !== 'object') {
        return sendError(res, 400, '缺少有效的 schema 数据');
    }

    try {
        const result = await db.query(
            `
                INSERT INTO project_versions (project_id, schema, created_by, description, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                RETURNING
                    id,
                    created_at,
                    created_by,
                    description
            `,
            [req.projectId, schema, user || 'Unknown', description || '']
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create version failed:', error);
        res.status(500).json({ error: '创建版本失败' });
    }
});

app.get('/api/versions/:versionId', requireAuth, requireVersionAccess(false), async (req, res) => {
    try {
        const result = await db.query(
            'SELECT schema FROM project_versions WHERE id = $1',
            [req.versionId]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, '版本不存在');
        }

        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Load version failed:', error);
        return sendError(res, 500, '获取版本失败');
    }
});

app.put('/api/versions/:versionId', requireAuth, requireVersionAccess(false), async (req, res) => {
    const description = typeof req.body.description === 'string' ? req.body.description : '';

    try {
        const result = await db.query(
            'UPDATE project_versions SET description = $1 WHERE id = $2 RETURNING id, description',
            [description, req.versionId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update version description failed:', error);
        res.status(500).json({ error: '更新备注失败' });
    }
});

app.get('/api/projects', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
            [req.userId]
        );
        res.json(result.rows.map(sanitizeProject));
    } catch (error) {
        console.error('Load projects failed:', error);
        res.status(500).json({ error: '加载项目失败' });
    }
});

app.post('/api/projects', requireAuth, async (req, res) => {
    const name = req.body.name?.trim();
    const schema = req.body.schema && typeof req.body.schema === 'object'
        ? req.body.schema
        : { tables: [], relationships: [], bookmarks: [] };

    if (!isNonEmptyString(name)) {
        return sendError(res, 400, '项目名称不能为空');
    }

    try {
        const project = db.transaction(() => {
            const projectResult = db.query(
                'INSERT INTO projects (user_id, name, schema_data) VALUES ($1, $2, $3) RETURNING *',
                [req.userId, name, schema]
            );

            db.query(
                `
                    INSERT INTO project_members (project_id, user_id, role)
                    VALUES ($1, $2, 'owner')
                    ON CONFLICT (project_id, user_id) DO NOTHING
                `,
                [projectResult.rows[0].id, req.userId]
            );

            return projectResult.rows[0];
        });
        res.json(sanitizeProject(project));
    } catch (error) {
        console.error('Create project failed:', error);
        res.status(500).json({ error: '创建项目失败' });
    }
});

app.post('/api/projects/:id/request', requireAuth, async (req, res) => {
    const projectId = parsePositiveInt(req.params.id);
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

    if (!projectId) {
        return sendError(res, 400, '无效的项目 ID');
    }

    try {
        const access = await getProjectAccess(projectId, req.userId);

        if (!access) {
            return sendError(res, 404, '项目不存在');
        }

        if (access.role) {
            return sendError(res, 400, '您已经是该项目成员');
        }

        const result = await db.query(
            `
                INSERT INTO project_requests (project_id, user_id, message)
                VALUES ($1, $2, $3)
                ON CONFLICT (project_id, user_id)
                DO UPDATE
                    SET message = EXCLUDED.message,
                        status = 'pending',
                        updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `,
            [projectId, req.userId, message]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create join request failed:', error);
        res.status(500).json({ error: '提交申请失败' });
    }
});

app.get('/api/projects/:id/requests', requireAuth, requireProjectAccess(true), async (req, res) => {
    try {
        const result = await db.query(
            `
                SELECT pr.*, u.username
                FROM project_requests pr
                INNER JOIN users u ON pr.user_id = u.id
                WHERE pr.project_id = $1
                ORDER BY pr.created_at DESC
            `,
            [req.projectId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Load project requests failed:', error);
        res.status(500).json({ error: '加载申请列表失败' });
    }
});

app.get('/api/projects/:id', requireAuth, requireProjectAccess(false), async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM projects WHERE id = $1',
            [req.projectId]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, '项目不存在');
        }

        return res.json(sanitizeProject(result.rows[0]));
    } catch (error) {
        console.error('Load project failed:', error);
        return sendError(res, 500, '获取项目失败');
    }
});

app.put('/api/projects/:id', requireAuth, requireProjectAccess(false), async (req, res) => {
    const schema = req.body.schema;

    if (!schema || typeof schema !== 'object') {
        return sendError(res, 400, '缺少有效的 schema 数据');
    }

    try {
        const result = await db.query(
            'UPDATE projects SET schema_data = $1 WHERE id = $2 RETURNING *',
            [schema, req.projectId]
        );
        res.json(sanitizeProject(result.rows[0]));
    } catch (error) {
        console.error('Save project failed:', error);
        res.status(500).json({ error: '保存项目失败' });
    }
});

app.delete('/api/projects/:id', requireAuth, requireProjectAccess(true), async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM projects WHERE id = $1 RETURNING *',
            [req.projectId]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, '项目不存在');
        }

        res.json({
            message: 'Project deleted successfully',
            project: sanitizeProject(result.rows[0]),
        });
    } catch (error) {
        console.error('Delete project failed:', error);
        res.status(500).json({ error: '删除项目失败' });
    }
});

app.post('/api/db/introspect', requireAuth, async (req, res) => {
    const { type, config } = req.body;

    if (type !== 'postgresql') {
        return sendError(res, 400, '直接连接模式当前只支持 PostgreSQL');
    }

    if (!config || typeof config !== 'object') {
        return sendError(res, 400, '缺少数据库连接配置');
    }

    const connectionConfig = {
        host: config.host || '127.0.0.1',
        port: parsePositiveInt(config.port) || 5432,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
    };

    if (!isNonEmptyString(connectionConfig.database) || !isNonEmptyString(connectionConfig.user)) {
        return sendError(res, 400, '数据库名称和用户名不能为空');
    }

    const client = new Client(connectionConfig);

    try {
        await client.connect();

        const query = `
            WITH tbl_info AS (
                SELECT
                    c.relname AS table_name,
                    obj_description(c.oid) AS table_comment,
                    c.oid AS table_oid
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind = 'r'
            ),
            cols_info AS (
                SELECT
                    a.attrelid,
                    json_agg(
                        json_build_object(
                            'name', a.attname,
                            'type', t.typname,
                            'isPk',
                                (
                                    SELECT COUNT(*)
                                    FROM pg_constraint pc
                                    WHERE pc.conrelid = a.attrelid
                                        AND pc.contype = 'p'
                                        AND a.attnum = ANY(pc.conkey)
                                ) > 0,
                            'comment', col_description(a.attrelid, a.attnum)
                        )
                        ORDER BY a.attnum
                    ) AS columns
                FROM pg_attribute a
                JOIN pg_type t ON a.atttypid = t.oid
                WHERE a.attnum > 0 AND NOT a.attisdropped
                GROUP BY a.attrelid
            ),
            rels_info AS (
                SELECT
                    json_agg(
                        json_build_object(
                            'fromTable', cl.relname,
                            'fromCol', a.attname,
                            'toTable', cl2.relname,
                            'toCol', a2.attname
                        )
                    ) AS relationships
                FROM pg_constraint con
                JOIN pg_class cl ON con.conrelid = cl.oid
                JOIN pg_class cl2 ON con.confrelid = cl2.oid
                JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
                JOIN pg_attribute a2 ON a2.attrelid = con.confrelid AND a2.attnum = con.confkey[1]
                WHERE con.contype = 'f'
            )
            SELECT json_build_object(
                'tables',
                (
                    SELECT json_agg(
                        json_build_object(
                            'name', t.table_name,
                            'comment', COALESCE(t.table_comment, ''),
                            'columns', c.columns
                        )
                    )
                    FROM tbl_info t
                    JOIN cols_info c ON t.table_oid = c.attrelid
                ),
                'relationships',
                COALESCE((SELECT relationships FROM rels_info), '[]'::json)
            ) AS result;
        `;

        const result = await client.query(query);
        res.json(result.rows[0].result);
    } catch (error) {
        console.error('Database introspection failed:', error);
        res.status(500).json({ error: `连接失败: ${error.message}` });
    } finally {
        await client.end().catch(() => {});
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
