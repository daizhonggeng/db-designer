require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { Client } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Auth Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
            [username, password]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, username FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Collaboration Routes (MUST be before /api/projects/:id)
// 获取我创建的项目
app.get('/api/projects/my-created', async (req, res) => {
    const { userId } = req.query;
    try {
        const result = await pool.query(
            `SELECT p.*, 
                    (SELECT COUNT(*) FROM project_requests WHERE project_id = p.id AND status = 'pending') as pending_requests
             FROM projects p
             WHERE p.user_id = $1
             ORDER BY p.created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取我协作的项目
app.get('/api/projects/my-collaborated', async (req, res) => {
    const { userId } = req.query;
    try {
        const result = await pool.query(
            `SELECT p.* 
             FROM projects p
             INNER JOIN project_members pm ON p.id = pm.project_id
             WHERE pm.user_id = $1 AND pm.role = 'member'
             ORDER BY pm.joined_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取未参与的项目
app.get('/api/projects/available', async (req, res) => {
    const { userId } = req.query;
    try {
        const result = await pool.query(
            `SELECT p.*,
                    pr.status as request_status
             FROM projects p
             LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
             LEFT JOIN project_requests pr ON p.id = pr.project_id AND pr.user_id = $1
             WHERE pm.id IS NULL AND p.user_id != $1
             ORDER BY p.created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 审批申请
app.put('/api/projects/requests/:requestId', async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;
    try {
        const request = await pool.query(
            `UPDATE project_requests 
             SET status = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [status, requestId]
        );

        if (request.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (status === 'approved') {
            await pool.query(
                `INSERT INTO project_members (project_id, user_id, role)
                 VALUES ($1, $2, 'member')
                 ON CONFLICT (project_id, user_id) DO NOTHING`,
                [request.rows[0].project_id, request.rows[0].user_id]
            );
        }

        res.json(request.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Version Routes
app.get('/api/projects/:id/versions', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT id, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at, created_by, description 
             FROM project_versions WHERE project_id = $1 ORDER BY id DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/:id/versions', async (req, res) => {
    const { id } = req.params;
    const { schema, user, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO project_versions (project_id, schema, created_by, description, created_at) 
             VALUES ($1, $2, $3, $4, NOW() AT TIME ZONE 'Asia/Shanghai') 
             RETURNING id, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at, created_by, description`,
            [id, schema, user, description]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    try {
        const result = await pool.query('SELECT schema FROM project_versions WHERE id = $1', [versionId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Version not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const { description } = req.body;
    try {
        const result = await pool.query(
            'UPDATE project_versions SET description = $1 WHERE id = $2 RETURNING *',
            [description, versionId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Project Routes
app.get('/api/projects', async (req, res) => {
    const { userId } = req.query;
    try {
        const result = await pool.query(
            'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    const { userId, name, schema } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO projects (user_id, name, schema_data) VALUES ($1, $2, $3) RETURNING *',
            [userId, name, schema || {}]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 申请加入项目
app.post('/api/projects/:id/request', async (req, res) => {
    const { id } = req.params;
    const { userId, message } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO project_requests (project_id, user_id, message)
             VALUES ($1, $2, $3)
             ON CONFLICT (project_id, user_id) 
             DO UPDATE SET message = $3, status = 'pending', updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [id, userId, message || '']
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取项目的申请列表
app.get('/api/projects/:id/requests', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT pr.*, u.username
             FROM project_requests pr
             INNER JOIN users u ON pr.user_id = u.id
             WHERE pr.project_id = $1
             ORDER BY pr.created_at DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { schema } = req.body;
    try {
        const result = await pool.query(
            'UPDATE projects SET schema_data = $1 WHERE id = $2 RETURNING *',
            [schema, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length > 0) {
            res.json({ message: 'Project deleted successfully', project: result.rows[0] });
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/db/introspect', async (req, res) => {
    const { type, config } = req.body;
    if (type !== 'postgresql') {
        return res.status(400).json({ error: 'Direct connection currently only supports PostgreSQL.' });
    }

    const client = new Client(config);
    try {
        await client.connect();
        const query = `
            WITH tbl_info AS (
                SELECT 
                    c.relname as table_name,
                    obj_description(c.oid) as table_comment,
                    c.oid as table_oid
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind = 'r'
            ),
            cols_info AS (
                SELECT 
                    a.attrelid,
                    json_agg(json_build_object(
                        'name', a.attname,
                        'type', t.typname,
                        'isPk', (SELECT COUNT(*) FROM pg_constraint pc WHERE pc.conrelid = a.attrelid AND pc.contype = 'p' AND a.attnum = ANY(pc.conkey)) > 0,
                        'comment', col_description(a.attrelid, a.attnum)
                    ) ORDER BY a.attnum) as columns
                FROM pg_attribute a
                JOIN pg_type t ON a.atttypid = t.oid
                WHERE a.attnum > 0 AND NOT a.attisdropped
                GROUP BY a.attrelid
            ),
            rels_info AS (
                SELECT 
                    json_agg(json_build_object(
                        'fromTable', cl.relname,
                        'fromCol', a.attname,
                        'toTable', cl2.relname,
                        'toCol', a2.attname
                    )) as relationships
                FROM pg_constraint con
                JOIN pg_class cl ON con.conrelid = cl.oid
                JOIN pg_class cl2 ON con.confrelid = cl2.oid
                JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
                JOIN pg_attribute a2 ON a2.attrelid = con.confrelid AND a2.attnum = con.confkey[1]
                WHERE con.contype = 'f'
            )
            SELECT json_build_object(
                'tables', (
                    SELECT json_agg(json_build_object(
                        'name', t.table_name,
                        'comment', COALESCE(t.table_comment, ''),
                        'columns', c.columns
                    ))
                    FROM tbl_info t
                    JOIN cols_info c ON t.table_oid = c.attrelid
                ),
                'relationships', COALESCE((SELECT relationships FROM rels_info), '[]'::json)
            ) as result;
        `;
        const result = await client.query(query);
        await client.end();
        res.json(result.rows[0].result);

    } catch (err) {
        if (client) { try { await client.end(); } catch (e) { } }
        res.status(500).json({ error: 'Connection failed: ' + err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
