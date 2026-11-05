const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');

test('SQLite API persists projects, versions and collaboration', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'db-designer-sqlite-test-'));
    const databasePath = path.join(directory, 'test.sqlite');
    const portReservation = net.createServer();
    portReservation.listen(0, '127.0.0.1');
    await once(portReservation, 'listening');
    const port = portReservation.address().port;
    await new Promise(resolve => portReservation.close(resolve));
    const baseUrl = `http://127.0.0.1:${port}`;
    const password = randomBytes(16).toString('hex');
    const authSecret = randomBytes(32).toString('hex');
    let child;
    let output = '';

    async function stop() {
        if (child && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
    }

    t.after(async () => {
        await stop();
        // 只清理本测试在系统临时目录下创建的精确目录。
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('db-designer-sqlite-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function start() {
        child = spawn(process.execPath, ['index.js'], {
            cwd: path.resolve(__dirname, '..'),
            env: {
                ...process.env,
                PORT: String(port),
                SQLITE_PATH: databasePath,
                AUTH_SECRET: authSecret,
            },
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        for (let attempt = 0; attempt < 100; attempt += 1) {
            if (child.exitCode !== null) {
                assert.fail(`Server exited: ${output}`);
            }
            try {
                const response = await fetch(`${baseUrl}/api/health`);
                if (response.ok) return;
            } catch {
                // 等待测试服务器监听端口。
            }
            await delay(100);
        }
        assert.fail(`Server did not start: ${output}`);
    }

    async function request(method, url, body, user, expectedStatus = 200) {
        const response = await fetch(`${baseUrl}${url}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const data = await response.json();
        assert.equal(response.status, expectedStatus, `${method} ${url}: ${JSON.stringify(data)}`);
        return data;
    }

    await start();
    let owner;
    let member;
    let project;
    let version;
    const schema = {
        tables: [{ id: 'table-1', name: '客户', columns: [{ id: 'column-1', name: 'id', type: 'INT', isPk: true }] }],
        relationships: [],
        bookmarks: [],
        designPreset: { rules: '表名必须使用 crm_ 前缀。', sourceName: '规范.md' },
    };

    await t.test('register, login and duplicate username handling', async () => {
        owner = await request('POST', '/api/register', { username: 'sqlite-owner', password });
        member = await request('POST', '/api/register', { username: 'sqlite-member', password });
        assert.equal(typeof owner.id, 'number');
        await request('POST', '/api/register', { username: owner.username, password }, undefined, 409);
        const loggedIn = await request('POST', '/api/login', { username: owner.username, password });
        assert.equal(loggedIn.id, owner.id);
        await request('POST', '/api/login', { username: owner.username, password: randomBytes(16).toString('hex') }, undefined, 401);
        await request('GET', '/api/projects', undefined, undefined, 401);
    });

    await t.test('account settings are isolated, encrypted and survive restart', async () => {
        const presets = [{ id: 'p1', name: '规范', rules: '使用下划线', sourceName: '' }];
        const profiles = [{ id: 'a1', name: 'AI', active: true, settings: { apiKey: 'secret-test-token', apiUrl: 'https://example.test/v1', modelText: 'text', modelVision: 'vision' } }];
        await request('PUT', '/api/account/presets', presets, owner);
        await request('PUT', '/api/account/ai-profiles', profiles, owner);
        assert.deepEqual(await request('GET', '/api/account/presets', undefined, member), []);
        assert.equal(await request('GET', '/api/account/ai-profiles', undefined, member), null);
        await request('PUT', '/api/account/ai-profiles', [], owner, 400);
        await request('GET', '/api/account/presets', undefined, undefined, 401);
        await stop();
        assert.equal(fs.readFileSync(databasePath).includes(Buffer.from('secret-test-token')), false);
        await start();
        assert.deepEqual(await request('GET', '/api/account/presets', undefined, owner), presets);
        assert.deepEqual(await request('GET', '/api/account/ai-profiles', undefined, owner), profiles);
    });

    await t.test('project JSON round trip and concurrent transactions', async () => {
        project = await request('POST', '/api/projects', { name: 'SQLite 中文项目', schema }, owner);
        assert.deepEqual(project.schema_data, schema);
        assert.ok(project.id > 0);
        const projects = await Promise.all(Array.from({ length: 4 }, (_, index) =>
            request('POST', '/api/projects', { name: `parallel-${index}` }, owner)));
        assert.equal(new Set(projects.map(item => item.id)).size, 4);
        for (const item of projects) await request('DELETE', `/api/projects/${item.id}`, undefined, owner);
        const list = await request('GET', '/api/projects/my-created', undefined, owner);
        assert.equal(list.length, 1);
        assert.deepEqual(list[0].schema_data, schema);
        const saved = await request('PUT', `/api/projects/${project.id}`, { schema }, owner);
        assert.deepEqual(saved.schema_data, schema);
    });

    await t.test('persisting an imported field without a type preserves the empty value', async () => {
        const incomplete = {
            ...schema,
            tables: [{
                ...schema.tables[0],
                columns: [...schema.tables[0].columns, { id: 'untyped', name: 'pending_type', type: '' }],
            }],
        };
        const saved = await request('PUT', `/api/projects/${project.id}`, { schema: incomplete }, owner);
        assert.equal(saved.schema_data.tables[0].columns[1].type, '');
        const loaded = await request('GET', `/api/projects/${project.id}`, undefined, owner);
        assert.equal(loaded.schema_data.tables[0].columns[1].type, '');
        await request('PUT', `/api/projects/${project.id}`, { schema }, owner);
    });

    await t.test('version JSON, timestamp and description', async () => {
        version = await request('POST', `/api/projects/${project.id}/versions`, {
            schema, user: owner.username, description: '初始版本',
        }, owner);
        assert.match(version.created_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        const loaded = await request('GET', `/api/versions/${version.id}`, undefined, owner);
        assert.deepEqual(loaded.schema, schema);
        await request('PUT', `/api/versions/${version.id}`, { description: '版本备注' }, owner);
        const versions = await request('GET', `/api/projects/${project.id}/versions`, undefined, owner);
        assert.equal(versions[0].description, '版本备注');
    });

    await t.test('atomic save detects conflicts and excludes editor history', async () => {
        const before = await request('GET', `/api/projects/${project.id}`, undefined, owner);
        const saved = await request('PUT', `/api/projects/${project.id}`, {
            schema: { ...schema, past: [{ tables: [] }], clipboard: { name: 'private copy' } },
            expectedRevision: before.revision,
            createVersion: true,
            description: '手动保存',
        }, owner);
        assert.equal(saved.revision, before.revision + 1);
        assert.deepEqual(saved.schema_data, schema);
        const versions = await request('GET', `/api/projects/${project.id}/versions`, undefined, owner);
        assert.equal(versions.length, 2);
        assert.equal(versions[0].description, '手动保存');
        await request('PUT', `/api/projects/${project.id}`, {
            schema: { tables: [], relationships: [], bookmarks: [] },
            expectedRevision: before.revision,
            createVersion: true,
        }, owner, 409);
        const unchanged = await request('GET', `/api/projects/${project.id}`, undefined, owner);
        assert.equal(unchanged.revision, saved.revision);
        assert.deepEqual(unchanged.schema_data, schema);
        const afterVersions = await request('GET', `/api/projects/${project.id}/versions`, undefined, owner);
        assert.equal(afterVersions.length, 2);
        const renamed = await request('PUT', `/api/projects/${project.id}`, { name: '订单设计', expectedRevision: saved.revision }, owner);
        assert.equal(renamed.name, '订单设计');
        assert.deepEqual(renamed.schema_data, schema);
        await request('PUT', `/api/projects/${project.id}`, { schema: [] }, owner, 400);
    });

    await t.test('membership approval and access checks', async () => {
        await request('GET', `/api/projects/${project.id}`, undefined, member, 403);
        const available = await request('GET', '/api/projects/available', undefined, member);
        assert.equal(available[0].id, project.id);
        const join = await request('POST', `/api/projects/${project.id}/request`, { message: '加入协作' }, member);
        const repeated = await request('POST', `/api/projects/${project.id}/request`, { message: '更新申请' }, member);
        assert.equal(repeated.id, join.id);
        const requests = await request('GET', `/api/projects/${project.id}/requests`, undefined, owner);
        assert.equal(requests[0].message, '更新申请');
        await request('PUT', `/api/projects/requests/${join.id}`, { status: 'approved' }, owner);
        const collaborated = await request('GET', '/api/projects/my-collaborated', undefined, member);
        assert.equal(collaborated[0].id, project.id);
        const loaded = await request('GET', `/api/projects/${project.id}`, undefined, member);
        assert.deepEqual(loaded.schema_data, schema);
        await request('DELETE', `/api/projects/${project.id}`, undefined, member, 403);
    });

    await t.test('server restart preserves users, projects and versions', async () => {
        await stop();
        assert.ok(fs.statSync(databasePath).size > 0);
        await start();
        const login = await request('POST', '/api/login', { username: owner.username, password });
        assert.equal(login.id, owner.id);
        const loaded = await request('GET', `/api/projects/${project.id}`, undefined, owner);
        assert.deepEqual(loaded.schema_data, schema);
        const versions = await request('GET', `/api/projects/${project.id}/versions`, undefined, owner);
        assert.ok(versions.some(item => item.id === version.id));
    });

    await t.test('deleting a project cascades to members, requests and versions', async () => {
        await request('DELETE', `/api/projects/${project.id}`, undefined, owner);
        await request('GET', `/api/versions/${version.id}`, undefined, owner, 404);
        const collaborated = await request('GET', '/api/projects/my-collaborated', undefined, member);
        assert.deepEqual(collaborated, []);
        await stop();
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(databasePath);
        try {
            for (const table of ['projects', 'project_members', 'project_requests', 'project_versions']) {
                assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
            }
            const user = db.prepare('SELECT password FROM users WHERE id = ?').get(owner.id);
            assert.notEqual(user.password, password);
            assert.ok(user.password.includes(':'));
        } finally {
            db.close();
        }
    });
});

test('SQLite transactions roll back the entire operation', () => {
    process.env.SQLITE_PATH = ':memory:';
    const db = require('../db');
    try {
        assert.throws(() => db.transaction(() => {
            db.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['rollback-user', randomBytes(16).toString('hex')]);
            db.query('INSERT INTO projects (user_id, name) VALUES ($1, $2)', [999999, 'invalid owner']);
        }), /FOREIGN KEY constraint failed/);
        assert.equal(db.query('SELECT COUNT(*) AS count FROM users').rows[0].count, 0);
    } finally {
        db.close();
    }
});
