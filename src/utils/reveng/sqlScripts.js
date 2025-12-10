
export const SCRIPTS = {
    mysql: {
        label: "MySQL (5.7+)",
        description: "请在 MySQL 数据库中执行以下 SQL，复制返回的 schema_json 字段内容。",
        query: `SELECT JSON_OBJECT(
    'tables', (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'name', t.TABLE_NAME,
            'comment', IFNULL(t.TABLE_COMMENT, ''),
            'columns', (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'name', c.COLUMN_NAME,
                    'type', c.COLUMN_TYPE,
                    'isPk', IF(c.COLUMN_KEY = 'PRI', true, false),
                    'comment', IFNULL(c.COLUMN_COMMENT, '')
                ))
                FROM INFORMATION_SCHEMA.COLUMNS c
                WHERE c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
            )
        ))
        FROM INFORMATION_SCHEMA.TABLES t
        WHERE t.TABLE_SCHEMA = DATABASE()
    ),
    'relationships', IFNULL((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'fromTable', k.TABLE_NAME,
            'fromCol', k.COLUMN_NAME,
            'toTable', k.REFERENCED_TABLE_NAME,
            'toCol', k.REFERENCED_COLUMN_NAME
        ))
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
        WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
    ), JSON_ARRAY())
) as schema_json;`
    },
    postgresql: {
        label: "PostgreSQL (9.4+)",
        description: "请在 PostgreSQL 数据库中执行以下 SQL，复制返回的 JSON 内容。",
        query: `WITH tbl_info AS (
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
);`
    },
    oracle: {
        label: "Oracle (12.2+)",
        description: "请在 Oracle 数据库中执行以下 SQL，复制返回的 CLOB/JSON 内容。",
        query: `SELECT JSON_OBJECT(
    'tables' VALUE (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'name' VALUE t.table_name,
            'comment' VALUE c.comments,
            'columns' VALUE (
                SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'name' VALUE col.column_name,
                    'type' VALUE col.data_type,
                    'isPk' VALUE CASE WHEN p.constraint_name IS NOT NULL THEN 'true' ELSE 'false' END,
                    'comment' VALUE cc.comments
                ))
                FROM user_tab_columns col
                LEFT JOIN user_col_comments cc ON col.table_name = cc.table_name AND col.column_name = cc.column_name
                LEFT JOIN (
                    SELECT cons.table_name, cols.column_name, cons.constraint_name
                    FROM user_constraints cons
                    JOIN user_cons_columns cols ON cons.constraint_name = cols.constraint_name
                    WHERE cons.constraint_type = 'P'
                ) p ON col.table_name = p.table_name AND col.column_name = p.column_name
                WHERE col.table_name = t.table_name
            )
        ))
        FROM user_tables t
        LEFT JOIN user_tab_comments c ON t.table_name = c.table_name
    ),
    'relationships' VALUE (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'fromTable' VALUE c.table_name,
            'fromCol' VALUE cc.column_name,
            'toTable' VALUE r.table_name,
            'toCol' VALUE rc.column_name
        ))
        FROM user_constraints c
        JOIN user_cons_columns cc ON c.constraint_name = cc.constraint_name
        JOIN user_constraints r ON c.r_constraint_name = r.constraint_name
        JOIN user_cons_columns rc ON r.constraint_name = rc.constraint_name
        WHERE c.constraint_type = 'R'
    )
) FROM DUAL;`
    }
};
