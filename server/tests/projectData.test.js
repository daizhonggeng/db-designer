const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('project backup round trip keeps schema and omits undo history', async () => {
    const { createOrderExample, parseProjectFile, projectSnapshot } = await import('../../src/utils/projectData.js');
    const schema = createOrderExample();
    const backup = { name: '订单示例', schema: projectSnapshot({ ...schema, past: [schema], clipboard: schema.tables[0] }) };
    const restored = parseProjectFile(JSON.stringify(backup));
    assert.equal(restored.name, backup.name);
    assert.deepEqual(restored.schema, schema);
    assert.equal(restored.schema.tables.length, 3);
    assert.equal(restored.schema.relationships.length, 2);
    for (const relationship of restored.schema.relationships) {
        assert.ok(schema.tables.find(table => table.id === relationship.fromTable).columns.some(column => column.id === relationship.fromCol));
    }
    assert.equal(Object.hasOwn(backup.schema, 'past'), false);
    assert.throws(() => parseProjectFile('broken'), /JSON/);
    assert.throws(() => parseProjectFile('{"tables":{}}'), /数组/);
    assert.throws(() => parseProjectFile('{"tables":[{"name":"test"}],"relationships":[]}'), /格式不完整/);
});

test('canvas mapping accounts for pan and zoom exactly once', async () => {
    const { canvasPoint, fitViewport } = await import('../../src/utils/canvasViewport.js');
    assert.deepEqual(canvasPoint(450, 250, { left: 100, top: 50 }, { x: 150, y: 100 }, 0.5), { x: 400, y: 200 });
    const tables = [{ position: { x: -200, y: 100 }, width: 260, height: 300 }, { position: { x: 1000, y: 700 }, width: 260, height: 300 }];
    const viewport = fitViewport(tables, [], 900, 600);
    for (const table of tables) {
        assert.ok(table.position.x * viewport.zoom + viewport.pan.x >= 0);
        assert.ok((table.position.x + table.width) * viewport.zoom + viewport.pan.x <= 900);
        assert.ok(table.position.y * viewport.zoom + viewport.pan.y >= 0);
        assert.ok((table.position.y + table.height) * viewport.zoom + viewport.pan.y <= 600);
    }
    assert.deepEqual(fitViewport([], [], 900, 600), { zoom: 1, pan: { x: 0, y: 0 } });
});

test('editing an existing table preserves index and constraint references', async () => {
    const { normalizeTable } = await import('../../src/utils/schemaModel.js');
    const { normalizeTableForEditor, validateEditedTable, tableSavePayload } = await import('../../src/utils/tableEditor.js');
    const table = normalizeTable({ id: 't', name: 'customers', columns: [{ id: 'id', name: 'id', type: 'INT', isPk: true }, { id: 'name', name: 'name', type: 'VARCHAR(100)' }], indexes: [{ id: 'idx', name: 'idx_name', type: 'btree', columnIds: ['name'] }], constraints: [{ id: 'pk', name: 'pk_customers', type: 'primary_key', columnIds: ['id'] }] });
    const edited = normalizeTableForEditor(table);
    assert.equal(validateEditedTable(edited), '');
    assert.deepEqual(edited.indexes[0].columns, ['name']);
    assert.equal(edited.constraints[0].type, 'PRIMARY_KEY');
    edited.indexes[0].columns = ['id', 'name'];
    const saved = normalizeTable(tableSavePayload(edited));
    assert.deepEqual(saved.indexes[0].columnIds, ['id', 'name']);
    assert.equal(saved.constraints.filter(item => item.type === 'primary_key').length, 1);
    assert.equal(saved.constraints[0].id, 'pk');
    const reopened = normalizeTableForEditor(saved);
    assert.equal(validateEditedTable(reopened), '');
});

test('opening an existing SQLite database preserves its users and projects', () => {
    const { DatabaseSync } = require('node:sqlite');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'db-designer-migration-test-'));
    const filename = path.join(directory, 'old.sqlite');
    const old = new DatabaseSync(filename);
    old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE projects (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), name TEXT NOT NULL, schema_data TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        INSERT INTO users (id, username, password) VALUES (1, 'migration-test', 'test-only-hash');
        INSERT INTO projects (id, user_id, name, schema_data) VALUES (8, 1, '原有项目', '{"tables":[],"relationships":[]}');`);
    old.close();
    try {
        execFileSync(process.execPath, ['initDb.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, SQLITE_PATH: filename }, stdio: 'pipe' });
        const migrated = new DatabaseSync(filename);
        try {
            const project = migrated.prepare('SELECT * FROM projects WHERE id = 8').get();
            assert.equal(project.name, '原有项目');
            assert.equal(project.revision, 0);
            assert.equal(project.updated_at, project.created_at);
            assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1);
            assert.equal(migrated.prepare("SELECT role FROM project_members WHERE project_id = 8").get().role, 'owner');
        } finally {
            migrated.close();
        }
    } finally {
        assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
        assert.ok(path.basename(directory).startsWith('db-designer-migration-test-'));
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
