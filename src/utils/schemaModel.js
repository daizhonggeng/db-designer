import { v4 as uuidv4 } from 'uuid';

const TRUE_SET = new Set(['true', '1', 'yes', 'y', 'on']);
const FALSE_SET = new Set(['false', '0', 'no', 'n', 'off']);

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value, fallback = '') {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return fallback;
    }
    return String(value);
}

export function normalizeBoolean(value, fallback = false) {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (TRUE_SET.has(normalized)) {
            return true;
        }
        if (FALSE_SET.has(normalized)) {
            return false;
        }
    }

    return fallback;
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function buildColumnIdLookup(columns) {
    const byName = new Map();
    columns.forEach((col) => {
        byName.set(col.name.toLowerCase(), col.id);
    });
    return byName;
}

function normalizeColumnReferenceIds(rawRefs, columnIdSet, columnIdByName) {
    const normalizedRefs = ensureArray(rawRefs)
        .map((rawRef) => {
            if (typeof rawRef !== 'string') {
                return '';
            }

            const ref = rawRef.trim();
            if (!ref) {
                return '';
            }

            if (columnIdSet.has(ref)) {
                return ref;
            }

            const mappedByName = columnIdByName.get(ref.toLowerCase());
            return mappedByName || '';
        });

    return uniqueValues(normalizedRefs);
}

function resolveConstraintType(type) {
    const normalizedType = normalizeString(type).trim().toLowerCase();

    if (['primary', 'pk', 'primary_key', 'primarykey'].includes(normalizedType)) {
        return 'primary_key';
    }
    if (['unique', 'uniq'].includes(normalizedType)) {
        return 'unique';
    }
    if (['check', 'chk'].includes(normalizedType)) {
        return 'check';
    }

    return 'unique';
}

export function normalizeColumn(column = {}) {
    const normalized = { ...column };
    normalized.id = normalizeString(column.id) || uuidv4();
    normalized.name = normalizeString(column.name, 'new_col');
    normalized.type = normalizeString(column.type, 'VARCHAR(255)');
    normalized.isPk = normalizeBoolean(column.isPk, false);
    normalized.nullable = normalizeBoolean(column.nullable, !normalized.isPk);
    normalized.defaultValue = column.defaultValue === undefined ? '' : column.defaultValue;
    normalized.isUnique = normalizeBoolean(column.isUnique, false);
    normalized.isAutoIncrement = normalizeBoolean(column.isAutoIncrement, false);
    normalized.comment = normalizeString(column.comment, '');
    return normalized;
}

export function normalizeIndex(index = {}, columns = []) {
    const columnIdSet = new Set(columns.map(col => col.id));
    const columnIdByName = buildColumnIdLookup(columns);

    const rawRefs = index.columnIds || index.columns || [];
    const normalizedColumnIds = normalizeColumnReferenceIds(rawRefs, columnIdSet, columnIdByName);

    return {
        ...index,
        id: normalizeString(index.id) || uuidv4(),
        name: normalizeString(index.name, ''),
        columnIds: normalizedColumnIds,
        isUnique: normalizeBoolean(index.isUnique, false),
        type: normalizeString(index.type || index.method, 'btree'),
        comment: normalizeString(index.comment, ''),
    };
}

export function normalizeConstraint(constraint = {}, columns = []) {
    const columnIdSet = new Set(columns.map(col => col.id));
    const columnIdByName = buildColumnIdLookup(columns);

    const rawRefs = constraint.columnIds || constraint.columns || [];
    const normalizedColumnIds = normalizeColumnReferenceIds(rawRefs, columnIdSet, columnIdByName);

    return {
        ...constraint,
        id: normalizeString(constraint.id) || uuidv4(),
        name: normalizeString(constraint.name, ''),
        type: resolveConstraintType(constraint.type),
        columnIds: normalizedColumnIds,
        expression: normalizeString(constraint.expression || constraint.check || constraint.condition, ''),
        comment: normalizeString(constraint.comment, ''),
    };
}

export function normalizeTable(table = {}) {
    const normalizedColumns = ensureArray(table.columns).map(normalizeColumn);
    const normalizedIndexes = ensureArray(table.indexes)
        .map(index => normalizeIndex(index, normalizedColumns))
        .filter(index => index.columnIds.length > 0);

    const normalizedConstraints = ensureArray(table.constraints)
        .map(constraint => normalizeConstraint(constraint, normalizedColumns))
        .filter((constraint) => {
            if (constraint.type === 'check') {
                return Boolean(constraint.expression.trim());
            }
            return constraint.columnIds.length > 0;
        });

    const hasPrimaryConstraint = normalizedConstraints.some(c => c.type === 'primary_key');
    const pkColumnIds = normalizedColumns.filter(col => col.isPk).map(col => col.id);

    if (!hasPrimaryConstraint && pkColumnIds.length > 1) {
        normalizedConstraints.push({
            id: uuidv4(),
            name: '',
            type: 'primary_key',
            columnIds: pkColumnIds,
            expression: '',
            comment: '',
        });
    }

    const normalizedTable = { ...table };
    normalizedTable.id = normalizeString(table.id) || uuidv4();
    normalizedTable.name = normalizeString(table.name, 'new_table');
    normalizedTable.comment = normalizeString(table.comment, '');
    normalizedTable.position = {
        x: Number.isFinite(table.position?.x) ? table.position.x : 0,
        y: Number.isFinite(table.position?.y) ? table.position.y : 0,
    };
    normalizedTable.columns = normalizedColumns;
    normalizedTable.indexes = normalizedIndexes;
    normalizedTable.constraints = normalizedConstraints;
    normalizedTable.bookmarkId = table.bookmarkId || null;

    return normalizedTable;
}

function normalizeRelationship(relationship = {}) {
    return {
        ...relationship,
        id: normalizeString(relationship.id) || uuidv4(),
        fromTable: normalizeString(relationship.fromTable),
        fromCol: normalizeString(relationship.fromCol),
        toTable: normalizeString(relationship.toTable),
        toCol: normalizeString(relationship.toCol),
    };
}

export function normalizeSchema(schema = {}) {
    const tables = ensureArray(schema.tables).map(normalizeTable);
    const tableIdSet = new Set(tables.map(table => table.id));
    const columnIdSet = new Set(
        tables.flatMap(table => table.columns.map(col => col.id))
    );

    const relationships = ensureArray(schema.relationships)
        .map(normalizeRelationship)
        .filter(rel =>
            tableIdSet.has(rel.fromTable) &&
            tableIdSet.has(rel.toTable) &&
            columnIdSet.has(rel.fromCol) &&
            columnIdSet.has(rel.toCol)
        );

    return {
        tables,
        relationships,
        bookmarks: ensureArray(schema.bookmarks),
        designPreset: schema.designPreset || null,
    };
}
