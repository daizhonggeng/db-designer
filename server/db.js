const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const configuredPath = process.env.SQLITE_PATH || 'data/db-designer.sqlite';
const databasePath = configuredPath === ':memory:'
    ? configuredPath
    : path.resolve(__dirname, configuredPath);

if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const connection = new DatabaseSync(databasePath);
connection.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        schema_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(schema_data)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending',
        message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        schema TEXT NOT NULL CHECK (json_valid(schema)),
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        description TEXT
    );

    INSERT INTO project_members (project_id, user_id, role)
    SELECT id, user_id, 'owner' FROM projects WHERE user_id IS NOT NULL
    ON CONFLICT (project_id, user_id) DO NOTHING;
`);

function query(sql, params = []) {
    const statement = connection.prepare(sql);
    // SQLite 原生支持 $1 命名参数；重复参数无需改写 SQL。
    const bindings = Object.fromEntries(params.map((value, index) => [
        `$${index + 1}`,
        value !== null && typeof value === 'object' ? JSON.stringify(value) : value,
    ]));

    if (statement.columns().length === 0) {
        const result = statement.run(bindings);
        return { rows: [], rowCount: result.changes };
    }

    const rows = statement.all(bindings).map(row => {
        const result = { ...row };
        for (const field of ['schema_data', 'schema']) {
            if (typeof result[field] === 'string') {
                result[field] = JSON.parse(result[field]);
            }
        }
        return result;
    });
    return { rows, rowCount: rows.length };
}

function transaction(callback) {
    connection.exec('BEGIN IMMEDIATE');
    try {
        const result = callback();
        connection.exec('COMMIT');
        return result;
    } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
    }
}

module.exports = {
    query,
    transaction,
    close: () => connection.close(),
    databasePath,
};
