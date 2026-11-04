import {
    getLowerNameMap,
    normalizeSchema,
    resolveColumnReference,
    resolveTableReference,
} from './normalize';

function createIssueCollector() {
    const issues = [];
    let serial = 0;

    const push = (level, code, message, extra = {}) => {
        serial += 1;
        issues.push({
            id: `${code}-${serial}`,
            level,
            code,
            message,
            ...extra,
        });
    };

    return { issues, push };
}

function countByLevel(issues) {
    return {
        errorCount: issues.filter(item => item.level === 'error').length,
        warningCount: issues.filter(item => item.level === 'warning').length,
        infoCount: issues.filter(item => item.level === 'info').length,
    };
}

function validateTableNames(schema, pushIssue) {
    const tableNameMap = getLowerNameMap(schema.tables, table => table.name);

    tableNameMap.forEach((items, nameKey) => {
        if (items.length <= 1) {
            return;
        }

        pushIssue(
            'error',
            'DUPLICATE_TABLE_NAME',
            `发现重复表名 "${items[0].name}"（大小写不敏感匹配 key: ${nameKey}）。`,
            { tableIds: items.map(item => item.id) }
        );
    });
}

function validateColumns(table, pushIssue) {
    if (table.columns.length === 0) {
        pushIssue(
            'warning',
            'TABLE_WITHOUT_COLUMNS',
            `表 "${table.name}" 没有任何字段。`,
            { tableId: table.id }
        );
        return;
    }

    const columnNameMap = getLowerNameMap(table.columns, column => column.name);
    columnNameMap.forEach((items, nameKey) => {
        if (items.length <= 1) {
            return;
        }

        pushIssue(
            'error',
            'DUPLICATE_COLUMN_NAME',
            `表 "${table.name}" 中字段名 "${items[0].name}" 重复（大小写不敏感 key: ${nameKey}）。`,
            { tableId: table.id, columnIds: items.map(item => item.id) }
        );
    });

    const primaryKeyCount = table.columns.filter(column => column.isPk).length;
    if (primaryKeyCount === 0) {
        pushIssue(
            'warning',
            'MISSING_PRIMARY_KEY',
            `表 "${table.name}" 缺少主键字段。`,
            { tableId: table.id }
        );
    }
}

function validateIndexes(table, pushIssue) {
    const indexNameMap = getLowerNameMap(table.indexes, indexItem => indexItem.name);
    indexNameMap.forEach((items) => {
        if (items.length > 1) {
            pushIssue(
                'warning',
                'DUPLICATE_INDEX_NAME',
                `表 "${table.name}" 存在重复索引名 "${items[0].name}"。`,
                { tableId: table.id, indexIds: items.map(item => item.id) }
            );
        }
    });

    table.indexes.forEach((indexItem) => {
        if (indexItem.columns.length === 0) {
            pushIssue(
                'error',
                'INVALID_INDEX_COLUMNS',
                `表 "${table.name}" 的索引 "${indexItem.name}" 没有配置字段。`,
                { tableId: table.id, indexId: indexItem.id }
            );
            return;
        }

        const seen = new Set();
        indexItem.columns.forEach((columnRef) => {
            const column = resolveColumnReference(table, columnRef);
            if (!column) {
                pushIssue(
                    'error',
                    'BROKEN_INDEX_COLUMN_REF',
                    `表 "${table.name}" 的索引 "${indexItem.name}" 引用了不存在字段 "${columnRef}"。`,
                    { tableId: table.id, indexId: indexItem.id }
                );
                return;
            }

            if (seen.has(column.id)) {
                pushIssue(
                    'warning',
                    'DUPLICATE_INDEX_COLUMN_REF',
                    `表 "${table.name}" 的索引 "${indexItem.name}" 重复引用字段 "${column.name}"。`,
                    { tableId: table.id, indexId: indexItem.id, columnId: column.id }
                );
            } else {
                seen.add(column.id);
            }
        });
    });
}

function validateConstraints(schema, table, pushIssue) {
    const constraintNameMap = getLowerNameMap(table.constraints, item => item.name);
    constraintNameMap.forEach((items) => {
        if (items.length > 1) {
            pushIssue(
                'warning',
                'DUPLICATE_CONSTRAINT_NAME',
                `表 "${table.name}" 存在重复约束名 "${items[0].name}"。`,
                { tableId: table.id, constraintIds: items.map(item => item.id) }
            );
        }
    });

    table.constraints.forEach((constraint) => {
        const type = constraint.type.toLowerCase();

        if (['primary_key', 'unique', 'foreign_key'].includes(type) && constraint.columns.length === 0) {
            pushIssue(
                'error',
                'CONSTRAINT_WITHOUT_COLUMNS',
                `表 "${table.name}" 的约束 "${constraint.name}" 缺少字段配置。`,
                { tableId: table.id, constraintId: constraint.id }
            );
        }

        constraint.columns.forEach((columnRef) => {
            const column = resolveColumnReference(table, columnRef);
            if (!column) {
                pushIssue(
                    'error',
                    'BROKEN_CONSTRAINT_COLUMN_REF',
                    `表 "${table.name}" 的约束 "${constraint.name}" 引用了不存在字段 "${columnRef}"。`,
                    { tableId: table.id, constraintId: constraint.id }
                );
            }
        });

        if (type === 'foreign_key') {
            const referenceTable = resolveTableReference(schema, constraint.referenceTable);
            if (!referenceTable) {
                pushIssue(
                    'error',
                    'BROKEN_CONSTRAINT_TABLE_REF',
                    `表 "${table.name}" 的外键约束 "${constraint.name}" 引用了不存在的目标表 "${constraint.referenceTable}"。`,
                    { tableId: table.id, constraintId: constraint.id }
                );
                return;
            }

            if (constraint.referenceColumns.length === 0) {
                pushIssue(
                    'error',
                    'BROKEN_CONSTRAINT_TARGET_COLUMNS',
                    `表 "${table.name}" 的外键约束 "${constraint.name}" 缺少目标字段配置。`,
                    { tableId: table.id, constraintId: constraint.id }
                );
                return;
            }

            constraint.referenceColumns.forEach((columnRef) => {
                const targetColumn = resolveColumnReference(referenceTable, columnRef);
                if (!targetColumn) {
                    pushIssue(
                        'error',
                        'BROKEN_CONSTRAINT_TARGET_COLUMN_REF',
                        `表 "${table.name}" 的外键约束 "${constraint.name}" 引用了不存在目标字段 "${columnRef}"。`,
                        { tableId: table.id, constraintId: constraint.id }
                    );
                }
            });
        }
    });
}

function validateRelationships(schema, pushIssue) {
    schema.relationships.forEach((relationship) => {
        const fromTable = resolveTableReference(schema, relationship.fromTable);
        const toTable = resolveTableReference(schema, relationship.toTable);

        if (!fromTable) {
            pushIssue(
                'error',
                'BROKEN_RELATIONSHIP_FROM_TABLE',
                `关系 "${relationship.id}" 的源表不存在：${relationship.fromTable || '(空)'}。`,
                { relationshipId: relationship.id }
            );
            return;
        }

        if (!toTable) {
            pushIssue(
                'error',
                'BROKEN_RELATIONSHIP_TO_TABLE',
                `关系 "${relationship.id}" 的目标表不存在：${relationship.toTable || '(空)'}。`,
                { relationshipId: relationship.id }
            );
            return;
        }

        const fromColumn = resolveColumnReference(fromTable, relationship.fromCol);
        const toColumn = resolveColumnReference(toTable, relationship.toCol);

        if (!fromColumn) {
            pushIssue(
                'error',
                'BROKEN_RELATIONSHIP_FROM_COLUMN',
                `关系 "${relationship.id}" 的源字段不存在：${relationship.fromCol || '(空)'}。`,
                { relationshipId: relationship.id, tableId: fromTable.id }
            );
        }

        if (!toColumn) {
            pushIssue(
                'error',
                'BROKEN_RELATIONSHIP_TO_COLUMN',
                `关系 "${relationship.id}" 的目标字段不存在：${relationship.toCol || '(空)'}。`,
                { relationshipId: relationship.id, tableId: toTable.id }
            );
        }
    });
}

export function validateSchema(rawSchema, options = {}) {
    const schema = normalizeSchema(rawSchema);
    const { issues, push } = createIssueCollector();

    validateTableNames(schema, push);
    schema.tables.forEach((table) => {
        validateColumns(table, push);
        validateIndexes(table, push);
        validateConstraints(schema, table, push);
    });
    validateRelationships(schema, push);

    const summary = {
        tableCount: schema.tables.length,
        relationshipCount: schema.relationships.length,
        ...countByLevel(issues),
        isValid: issues.every(item => item.level !== 'error'),
    };

    if (options.level && ['error', 'warning', 'info'].includes(options.level)) {
        const filteredIssues = issues.filter(item => item.level === options.level);
        return {
            schema,
            summary: {
                ...summary,
                filteredCount: filteredIssues.length,
            },
            issues: filteredIssues,
        };
    }

    return { schema, summary, issues };
}

