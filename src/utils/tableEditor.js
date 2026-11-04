import { v4 as uuidv4 } from 'uuid';

const INDEX_TYPES = ['BTREE', 'HASH', 'GIN', 'GIST', 'FULLTEXT', 'OTHER'];
const CONSTRAINT_TYPES = ['PRIMARY_KEY', 'UNIQUE', 'CHECK'];

const normalizeColumn = (column) => {
    const isPk = Boolean(column?.isPk);
    return {
        id: column?.id || uuidv4(),
        name: column?.name || 'new_column',
        type: column?.type || 'VARCHAR(255)',
        isPk,
        nullable: typeof column?.nullable === 'boolean' ? column.nullable : !isPk,
        defaultValue: column?.defaultValue == null ? '' : String(column.defaultValue),
        isUnique: typeof column?.isUnique === 'boolean' ? column.isUnique : isPk,
        isAutoIncrement: Boolean(column?.isAutoIncrement),
        comment: column?.comment || '',
    };
};

export const normalizeTableForEditor = (table) => {
    const columns = Array.isArray(table?.columns) ? table.columns.map(normalizeColumn) : [];
    const columnIds = new Set(columns.map((column) => column.id));
    return {
        ...table,
        name: table?.name || 'new_table',
        comment: table?.comment || '',
        columns,
        indexes: (table?.indexes || []).map((index) => ({
            id: index?.id || uuidv4(),
            name: index?.name || 'idx_name',
            type: INDEX_TYPES.includes(index?.type?.toUpperCase()) ? index.type.toUpperCase() : 'BTREE',
            isUnique: Boolean(index?.isUnique),
            columns: (index?.columnIds || index?.columns || []).filter((id) => columnIds.has(id)),
            comment: index?.comment || '',
        })),
        constraints: (table?.constraints || []).map((constraint) => ({
            id: constraint?.id || uuidv4(),
            type: CONSTRAINT_TYPES.includes(constraint?.type?.toUpperCase()) ? constraint.type.toUpperCase() : 'UNIQUE',
            name: constraint?.name || 'cons_name',
            columns: (constraint?.columnIds || constraint?.columns || []).filter((id) => columnIds.has(id)),
            expression: constraint?.expression || '',
        })),
    };
};

export const validateEditedTable = (table) => {
    if (!table.name.trim()) return '表名不能为空';
    if (!table.columns.length) return '至少需要一个字段';
    const names = new Set();
    for (const column of table.columns) {
        const name = column.name.trim().toLowerCase();
        if (!name) return '字段名不能为空';
        if (!column.type.trim()) return `字段 ${column.name} 缺少类型`;
        if (names.has(name)) return `字段名重复: ${column.name}`;
        names.add(name);
    }
    for (const index of table.indexes) {
        if (!index.name.trim()) return '索引名称不能为空';
        if (!index.columns.length) return `索引 ${index.name || '(未命名)'} 至少选择一个字段`;
    }
    for (const constraint of table.constraints) {
        if (!constraint.name.trim()) return '约束名称不能为空';
        if (constraint.type === 'CHECK' && !constraint.expression.trim()) return `检查约束 ${constraint.name || '(未命名)'} 需要表达式`;
        if (constraint.type !== 'CHECK' && !constraint.columns.length) return `约束 ${constraint.name || '(未命名)'} 至少选择一个字段`;
    }
    return '';
};

export const tableSavePayload = (table) => {
    const columns = table.columns.map((column) => ({
        ...column,
        name: column.name.trim(),
        type: column.type.trim(),
        defaultValue: (column.defaultValue || '').trim(),
        comment: (column.comment || '').trim(),
    }));
    const pkColumns = columns.filter((column) => column.isPk).map((column) => column.id);
    const autoPk = pkColumns.length ? [{ id: table.constraints.find(item => item.type === 'PRIMARY_KEY')?.id || uuidv4(), type: 'PRIMARY_KEY', name: `pk_${table.name.trim() || 'table'}`, columns: pkColumns, expression: '' }] : [];
    return {
        ...table,
        name: table.name.trim(),
        comment: table.comment.trim(),
        columns,
        indexes: table.indexes.map(({ columns: refs, ...index }) => ({ ...index, columnIds: refs, name: index.name.trim(), comment: index.comment.trim() })),
        constraints: [...autoPk, ...table.constraints.filter((constraint) => constraint.type !== 'PRIMARY_KEY')].map(({ columns: refs, ...constraint }) => ({
            ...constraint,
            columnIds: refs,
            name: constraint.name.trim(),
            expression: (constraint.expression || '').trim(),
        })),
    };
};
