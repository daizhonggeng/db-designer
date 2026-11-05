require('dotenv').config();
const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const cors = require('cors');
const { Client } = require('pg');
const db = require('./db');
const settingsCrypto = require('./settingsCrypto');

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

function projectSchema(schema) {
    return {
        tables: schema.tables,
        relationships: Array.isArray(schema.relationships) ? schema.relationships : [],
        bookmarks: Array.isArray(schema.bookmarks) ? schema.bookmarks : [],
        ...(schema.designPreset === undefined ? {} : { designPreset: schema.designPreset || null }),
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

app.get('/api/account/:kind', requireAuth, (req, res) => {
    const { kind } = req.params;
    if (!['presets', 'ai-profiles'].includes(kind)) return res.status(404).json({ error: '未知配置' });
    try {
        const row = db.query('SELECT presets, ai_profiles FROM user_settings WHERE user_id = $1', [req.userId]).rows[0];
        res.set('Cache-Control', 'no-store');
        return res.json(kind === 'presets' ? (row ? JSON.parse(row.presets) : []) : (row?.ai_profiles ? settingsCrypto.decrypt(row.ai_profiles, req.userId) : null));
    } catch (error) {
        console.error('读取账号配置失败', error.message);
        return res.status(500).json({ error: '读取账号配置失败，请检查服务器加密密钥。' });
    }
});

app.put('/api/account/:kind', requireAuth, (req, res) => {
    const { kind } = req.params;
    if (!['presets', 'ai-profiles'].includes(kind)) return res.status(404).json({ error: '未知配置' });
    const values = req.body;
    const validString = (value, max) => typeof value === 'string' && value.length <= max;
    if (!Array.isArray(values) || values.length > 100 || JSON.stringify(values).length > 1000000) return res.status(400).json({ error: '配置格式或大小无效。' });
    const valid = kind === 'presets'
        ? values.every(item => item && validString(item.id, 100) && isNonEmptyString(item.name) && validString(item.name, 255) && validString(item.rules, 20000) && validString(item.sourceName || '', 255))
        : values.length > 0 && values.filter(item => item?.active === true).length === 1 && values.every(item => item && validString(item.id, 100) && isNonEmptyString(item.name) && validString(item.name, 255) && typeof item.active === 'boolean' && item.settings && ['apiUrl', 'apiKey', 'modelText', 'modelVision'].every(field => validString(item.settings[field], 4096)));
    if (!valid) return res.status(400).json({ error: '配置内容无效。' });
    try {
        const column = kind === 'presets' ? 'presets' : 'ai_profiles';
        const stored = kind === 'presets' ? JSON.stringify(values) : settingsCrypto.encrypt(values, req.userId);
        db.query(`INSERT INTO user_settings (user_id, ${column}) VALUES ($1, $2) ON CONFLICT(user_id) DO UPDATE SET ${column} = excluded.${column}`, [req.userId, stored]);
        res.set('Cache-Control', 'no-store');
        return res.json({ ok: true });
    } catch (error) {
        console.error('保存账号配置失败', error.message);
        return res.status(500).json({ error: '保存账号配置失败。' });
    }
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
                ORDER BY p.updated_at DESC, p.id DESC
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
                ORDER BY p.updated_at DESC, p.id DESC
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

function chatMessage(row) {
    return {
        id: row.id,
        role: row.role,
        text: row.text,
        images: JSON.parse(row.images),
        attachments: JSON.parse(row.attachments),
        proposal: row.proposal ? JSON.parse(row.proposal) : null,
        baseFingerprint: row.base_fingerprint,
        applied: Boolean(row.applied),
        createdAt: row.created_at,
    };
}

app.get('/api/projects/:id/ai-messages', requireAuth, requireProjectAccess(false), (req, res) => {
    try {
        const result = db.query(
            'SELECT * FROM ai_chat_messages WHERE project_id = $1 AND user_id = $2 ORDER BY seq',
            [req.projectId, req.userId]
        );
        res.set('Cache-Control', 'no-store');
        res.json(result.rows.map(chatMessage));
    } catch (error) {
        console.error('Load AI conversation failed:', error.message);
        res.status(500).json({ error: '加载对话失败' });
    }
});

app.post('/api/projects/:id/ai-messages', requireAuth, requireProjectAccess(false), (req, res) => {
    const { id, role, text, images = [], attachments = [], proposal = null, baseFingerprint = null } = req.body;
    const validId = typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
    const validText = typeof text === 'string' && text.length <= 20000;
    const validImages = Array.isArray(images) && images.length <= 2 && images.every(image =>
        image && typeof image.name === 'string' && image.name.length <= 255 &&
        typeof image.dataUrl === 'string' && image.dataUrl.length <= 4200000 &&
        /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/]+={0,2}$/.test(image.dataUrl)
    );
    const validAttachments = Array.isArray(attachments) && attachments.length <= 3 && attachments.every(file =>
        file && typeof file.name === 'string' && file.name.length > 0 && file.name.length <= 255 &&
        /\.(pdf|docx|txt|md|sql|json|csv|xml|pdm)$/i.test(file.name) &&
        typeof file.text === 'string' && file.text.trim().length > 0 && file.text.length <= (/\.pdm$/i.test(file.name) ? 120000 : 60000)
    );
    const validProposal = proposal === null || (
        role === 'assistant' && proposal && typeof proposal === 'object' && !Array.isArray(proposal) &&
        Array.isArray(proposal.operations) && proposal.operations.length > 0 && proposal.operations.length <= 500 &&
        JSON.stringify(proposal).length <= 1000000 && typeof baseFingerprint === 'string' && /^[a-f0-9]{64}$/.test(baseFingerprint)
    );
    if (!validId || !['user', 'assistant'].includes(role) || !validText || !validImages || !validAttachments || !validProposal ||
        (role === 'assistant' && (images.length || attachments.length)) || (!text.trim() && !images.length && !attachments.length)) {
        return res.status(400).json({ error: '对话内容格式或大小无效' });
    }
    try {
        const message = db.transaction(() => {
            const usage = db.query(
                'SELECT COUNT(*) AS count, COALESCE(SUM(length(text) + length(images) + length(attachments) + COALESCE(length(proposal), 0)), 0) AS size FROM ai_chat_messages WHERE project_id = $1 AND user_id = $2',
                [req.projectId, req.userId]
            ).rows[0];
            if (usage.count >= 200 || usage.size + text.length + JSON.stringify(images).length + JSON.stringify(attachments).length + JSON.stringify(proposal).length > 30000000) {
                return null;
            }
            return db.query(
                `INSERT INTO ai_chat_messages (id, project_id, user_id, role, text, images, proposal, base_fingerprint, attachments)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [id, req.projectId, req.userId, role, text, JSON.stringify(images), proposal ? JSON.stringify(proposal) : null, baseFingerprint, JSON.stringify(attachments)]
            ).rows[0];
        });
        if (!message) return res.status(400).json({ error: '对话已达到容量上限，请新建对话后继续' });
        res.set('Cache-Control', 'no-store');
        return res.json(chatMessage(message));
    } catch (error) {
        if (error.errcode === 2067) return res.status(409).json({ error: '该消息已保存，请刷新对话' });
        console.error('Save AI message failed:', error.message);
        return res.status(500).json({ error: '保存消息失败' });
    }
});

app.put('/api/projects/:id/ai-messages/:messageId', requireAuth, requireProjectAccess(false), (req, res) => {
    if (req.body.applied !== true) return res.status(400).json({ error: '无效的消息状态' });
    try {
        const result = db.query(
            `UPDATE ai_chat_messages SET applied = 1
             WHERE project_id = $1 AND user_id = $2 AND id = $3 AND role = 'assistant' AND proposal IS NOT NULL
             RETURNING *`,
            [req.projectId, req.userId, req.params.messageId]
        );
        if (!result.rows.length) return res.status(404).json({ error: '修改方案不存在' });
        res.set('Cache-Control', 'no-store');
        return res.json(chatMessage(result.rows[0]));
    } catch (error) {
        console.error('Update AI message failed:', error.message);
        return res.status(500).json({ error: '更新消息失败' });
    }
});

app.delete('/api/projects/:id/ai-messages', requireAuth, requireProjectAccess(false), (req, res) => {
    try {
        db.query('DELETE FROM ai_chat_messages WHERE project_id = $1 AND user_id = $2', [req.projectId, req.userId]);
        res.set('Cache-Control', 'no-store');
        res.json({ ok: true });
    } catch (error) {
        console.error('Clear AI conversation failed:', error.message);
        res.status(500).json({ error: '清除对话失败' });
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
            'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC, id DESC',
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
    const schema = req.body.schema && Array.isArray(req.body.schema.tables)
        ? projectSchema(req.body.schema)
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
    const { schema, expectedRevision, createVersion, description } = req.body;
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;

    if (schema !== undefined && (!schema || !Array.isArray(schema.tables))) {
        return sendError(res, 400, '缺少有效的 schema 数据');
    }
    if (schema === undefined && name === undefined) {
        return sendError(res, 400, '缺少要保存的内容');
    }
    if (name !== undefined && !name) {
        return sendError(res, 400, '项目名称不能为空');
    }
    if (name !== undefined && req.projectRole !== 'owner') {
        return sendError(res, 403, '只有项目创建者可以重命名');
    }
    if (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) {
        return sendError(res, 400, '无效的保存版本');
    }

    try {
        const project = db.transaction(() => {
            const current = db.query('SELECT * FROM projects WHERE id = $1', [req.projectId]).rows[0];
            if (expectedRevision !== undefined && current.revision !== expectedRevision) {
                return null;
            }
            const savedSchema = schema === undefined ? current.schema_data : projectSchema(schema);
            const saved = db.query(
                `UPDATE projects SET schema_data = $1, name = $2,
                    revision = revision + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 RETURNING *`,
                [savedSchema, name === undefined ? current.name : name, req.projectId]
            ).rows[0];
            if (createVersion === true) {
                db.query(
                    `INSERT INTO project_versions (project_id, schema, created_by, description)
                     VALUES ($1, $2, $3, $4)`,
                    [req.projectId, savedSchema, req.authenticatedUser.username, typeof description === 'string' ? description : '手动保存']
                );
            }
            return saved;
        });
        if (!project) {
            return sendError(res, 409, '项目已在其他窗口或由协作者更新，请先备份当前内容，再载入最新版本');
        }
        res.json(sanitizeProject(project));
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
