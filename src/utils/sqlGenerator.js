/**
 * 生成单个表的 SQL 语句
 * @param {Object} table - 表对象
 * @param {string} dialect - 数据库方言 ('mysql', 'postgresql', 'oracle')
 * @returns {string} SQL 语句
 */
export function generateTableSQL(table, dialect = 'mysql') {
    let sql = '';

    // 表名引用符号
    const quote = dialect === 'mysql' ? '`' : '"';

    // CREATE TABLE 语句
    sql += `CREATE TABLE ${quote}${table.name}${quote} (\n`;

    // 列定义
    const cols = table.columns.map(col => {
        let type = col.type;
        let line = '';

        // 数据库特定的类型调整
        if (dialect === 'postgresql') {
            if (col.isPk && type.toUpperCase() === 'INT') {
                type = 'SERIAL'; // PostgreSQL 自增
            }
        } else if (dialect === 'oracle') {
            if (type.toUpperCase() === 'INT') type = 'NUMBER';
            if (type.toUpperCase().startsWith('VARCHAR')) {
                type = type.replace(/VARCHAR/i, 'VARCHAR2');
            }
        }

        line = `  ${quote}${col.name}${quote} ${type}`;

        // 主键定义
        if (col.isPk) {
            if (dialect === 'mysql') {
                line += ' PRIMARY KEY';
                if (type.toUpperCase().includes('INT')) {
                    line += ' AUTO_INCREMENT';
                }
            } else if (dialect === 'postgresql') {
                line += ' PRIMARY KEY';
            } else if (dialect === 'oracle') {
                line += ' PRIMARY KEY';
            }
        }

        // MySQL 列注释
        if (dialect === 'mysql' && col.comment) {
            line += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
        }

        return line;
    });

    sql += cols.join(',\n');

    // 表注释
    if (dialect === 'mysql' && table.comment) {
        sql += `\n) COMMENT='${table.comment.replace(/'/g, "\\'")}';`;
    } else {
        sql += '\n);';
    }

    // PostgreSQL / Oracle 注释
    if (dialect !== 'mysql') {
        if (table.comment) {
            sql += `\nCOMMENT ON TABLE ${quote}${table.name}${quote} IS '${table.comment.replace(/'/g, "''")}';`;
        }
        table.columns.forEach(col => {
            if (col.comment) {
                sql += `\nCOMMENT ON COLUMN ${quote}${table.name}${quote}.${quote}${col.name}${quote} IS '${col.comment.replace(/'/g, "''")}';`;
            }
        });
    }

    return sql;
}

/**
 * 生成完整 schema 的 SQL 语句
 * @param {Object} schema - schema 对象，包含 tables 和 relationships
 * @param {string} dialect - 数据库方言 ('mysql', 'postgresql', 'oracle')
 * @returns {string} SQL 语句
 */
export function generateSchemaSQL(schema, dialect = 'mysql') {
    let sql = '';
    const { tables, relationships } = schema;
    const quote = dialect === 'mysql' ? '`' : '"';

    // 生成所有表
    tables.forEach(table => {
        sql += generateTableSQL(table, dialect) + '\n\n';
    });

    // 生成外键约束
    relationships.forEach(rel => {
        const fromT = tables.find(t => t.id === rel.fromTable);
        const toT = tables.find(t => t.id === rel.toTable);
        const fromC = fromT?.columns.find(c => c.id === rel.fromCol);
        const toC = toT?.columns.find(c => c.id === rel.toCol);

        if (fromT && toT && fromC && toC) {
            sql += `ALTER TABLE ${quote}${fromT.name}${quote} ADD FOREIGN KEY (${quote}${fromC.name}${quote}) REFERENCES ${quote}${toT.name}${quote} (${quote}${toC.name}${quote});\n`;
        }
    });

    return sql;
}
