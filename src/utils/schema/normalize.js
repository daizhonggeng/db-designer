function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function toStringSafe(value, fallback = '') {
    if (value === null || value === undefined) {
        return fallback;
    }
    return String(value);
}

function toBooleanSafe(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalizedValue = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalizedValue)) {
            return true;
        }
        if (['false', '0', 'no', 'n'].includes(normalizedValue)) {
            return false;
        }
    }
    return fallback;
}

function normalizedName(value, fallbackPrefix, index) {
    const text = toStringSafe(value).trim();
    if (text) {
        return text;
    }
    return `${fallbackPrefix}_${index + 1}`;
}

export function normalizeColumn(column, tableId, index) {
    const columnName = normalizedName(column?.name, 'column', index);
    const isPrimaryKey = toBooleanSafe(column?.isPk, false);
    const defaultValueRaw = column?.defaultValue ?? column?.default ?? null;
    const defaultValue = defaultValueRaw === null || defaultValueRaw === undefined
        ? null
        : toStringSafe(defaultValueRaw);

    return {
        ...column,
        id: toStringSafe(column?.id, `col:${tableId}:${index}`),
        name: columnName,
        type: toStringSafe(column?.type, 'VARCHAR(255)'),
        comment: toStringSafe(column?.comment, ''),
        isPk: isPrimaryKey,
        nullable: toBooleanSafe(column?.nullable, !isPrimaryKey),
        isUnique: toBooleanSafe(column?.isUnique, false),
        isAutoIncrement: toBooleanSafe(column?.isAutoIncrement, false),
        defaultValue,
    };
}

export function normalizeIndex(indexItem, tableId, index) {
    const normalizedColumns = toArray(indexItem?.columns ?? indexItem?.columnIds).map(value => toStringSafe(value));

    return {
        ...indexItem,
        id: toStringSafe(indexItem?.id, `idx:${tableId}:${index}`),
        name: normalizedName(indexItem?.name, 'idx', index),
        columns: normalizedColumns,
        columnIds: normalizedColumns,
        isUnique: toBooleanSafe(indexItem?.isUnique, false),
        type: toStringSafe(indexItem?.type, 'BTREE').toUpperCase(),
        comment: toStringSafe(indexItem?.comment, ''),
    };
}

export function normalizeConstraint(constraint, tableId, index) {
    const normalizedColumns = toArray(constraint?.columns ?? constraint?.columnIds).map(value => toStringSafe(value));
    const normalizedReferenceColumns = toArray(
        constraint?.referenceColumns ?? constraint?.referenceColumnIds
    ).map(value => toStringSafe(value));

    return {
        ...constraint,
        id: toStringSafe(constraint?.id, `cst:${tableId}:${index}`),
        name: normalizedName(constraint?.name, 'constraint', index),
        type: toStringSafe(constraint?.type, 'UNIQUE').toLowerCase(),
        columns: normalizedColumns,
        columnIds: normalizedColumns,
        expression: toStringSafe(constraint?.expression, ''),
        referenceTable: toStringSafe(constraint?.referenceTable, ''),
        referenceColumns: normalizedReferenceColumns,
        referenceColumnIds: normalizedReferenceColumns,
        comment: toStringSafe(constraint?.comment, ''),
    };
}

export function normalizeTable(table, index) {
    const tableName = normalizedName(table?.name, 'table', index);
    const tableId = toStringSafe(table?.id, `tbl:${index}`);
    const columns = toArray(table?.columns).map((column, colIndex) => normalizeColumn(column, tableId, colIndex));
    const indexes = toArray(table?.indexes).map((item, itemIndex) => normalizeIndex(item, tableId, itemIndex));
    const constraints = toArray(table?.constraints).map((item, itemIndex) => normalizeConstraint(item, tableId, itemIndex));

    return {
        ...table,
        id: tableId,
        name: tableName,
        comment: toStringSafe(table?.comment, ''),
        columns,
        indexes,
        constraints,
    };
}

export function normalizeRelationship(relationship, index) {
    return {
        ...relationship,
        id: toStringSafe(relationship?.id, `rel:${index}`),
        fromTable: toStringSafe(relationship?.fromTable, ''),
        fromCol: toStringSafe(relationship?.fromCol, ''),
        toTable: toStringSafe(relationship?.toTable, ''),
        toCol: toStringSafe(relationship?.toCol, ''),
    };
}

export function normalizeSchema(rawSchema = {}) {
    const tables = toArray(rawSchema?.tables).map(normalizeTable);
    const relationships = toArray(rawSchema?.relationships).map(normalizeRelationship);
    const bookmarks = toArray(rawSchema?.bookmarks);

    return {
        ...rawSchema,
        tables,
        relationships,
        bookmarks,
    };
}

export function getLowerNameMap(items, getter) {
    const result = new Map();

    items.forEach((item) => {
        const key = toStringSafe(getter(item)).trim().toLowerCase();
        if (!key) {
            return;
        }
        if (!result.has(key)) {
            result.set(key, []);
        }
        result.get(key).push(item);
    });

    return result;
}

export function resolveTableReference(schema, reference) {
    const refText = toStringSafe(reference).trim();
    if (!refText) {
        return null;
    }

    const byId = schema.tables.find(table => table.id === refText);
    if (byId) {
        return byId;
    }

    const normalizedRef = refText.toLowerCase();
    return schema.tables.find(table => table.name.toLowerCase() === normalizedRef) || null;
}

export function resolveColumnReference(table, reference) {
    const refText = toStringSafe(reference).trim();
    if (!refText || !table) {
        return null;
    }

    const byId = table.columns.find(column => column.id === refText);
    if (byId) {
        return byId;
    }

    const normalizedRef = refText.toLowerCase();
    return table.columns.find(column => column.name.toLowerCase() === normalizedRef) || null;
}
