const pool = require('./db');

async function migrate() {
    try {
        // 创建项目成员表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_members (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, user_id)
            )
        `);
        console.log('✓ Created project_members table');

        // 创建加入申请表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_requests (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, user_id)
            )
        `);
        console.log('✓ Created project_requests table');

        // 为现有项目添加创建者为成员（owner角色）
        await pool.query(`
            INSERT INTO project_members (project_id, user_id, role)
            SELECT id, user_id, 'owner'
            FROM projects
            ON CONFLICT (project_id, user_id) DO NOTHING
        `);
        console.log('✓ Added existing project creators as owners');

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
