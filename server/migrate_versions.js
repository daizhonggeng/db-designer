const pool = require('./db');

async function migrate() {
    try {
        // Create project_versions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_versions (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                schema JSONB NOT NULL,
                created_by VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
        `);
        console.log('✓ Created project_versions table');

        console.log('\n✅ Version Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Version Migration failed:', err);
        process.exit(1);
    }
}

migrate();
