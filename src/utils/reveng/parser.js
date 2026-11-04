import { v4 as uuidv4 } from 'uuid';
import { normalizeSchema } from '../schemaModel';

function normalizePkFlag(rawValue) {
    if (rawValue === true || rawValue === 1) {
        return true;
    }

    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        return ['true', '1', 'yes', 'y', 'pk'].includes(normalized);
    }

    return false;
}

function normalizeNullableFlag(rawValue, fallback) {
    if (rawValue === null || rawValue === undefined) {
        return fallback;
    }

    if (typeof rawValue === 'boolean') {
        return rawValue;
    }

    if (typeof rawValue === 'number') {
        return rawValue !== 0;
    }

    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'nullable'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n', 'not null'].includes(normalized)) {
            return false;
        }
    }

    return fallback;
}

function normalizeBoolean(rawValue, fallback = false) {
    if (rawValue === null || rawValue === undefined) {
        return fallback;
    }
    if (typeof rawValue === 'boolean') {
        return rawValue;
    }
    if (typeof rawValue === 'number') {
        return rawValue !== 0;
    }
    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
            return false;
        }
    }
    return fallback;
}

function resolveColumnRefs(rawRefs, columnNameToId) {
    if (!Array.isArray(rawRefs)) {
        return [];
    }

    return [...new Set(rawRefs
        .map((rawRef) => {
            if (typeof rawRef !== 'string') {
                return '';
            }
            const ref = rawRef.trim();
            if (!ref) {
                return '';
            }
            return columnNameToId.get(ref.toLowerCase()) || '';
        })
        .filter(Boolean))];
}

export function parseReverseEngResult(jsonInput) {
    let data;
    try {
        // Handle potential array wrapping or single object
        const parsed = JSON.parse(jsonInput);
        // Sometimes users might copy array of one object
        data = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
        throw new Error("无法解析 JSON。请确保您复制了完整的查询结果。");
    }

    if (!data.tables) {
        throw new Error("JSON 缺少 'tables' 字段。");
    }

    const tableMap = new Map(); // Name -> ID
    const colMap = new Map();   // TableName.ColName -> ID

    // 1. Process Tables
    const tables = data.tables.map((t, index) => {
        const tableId = uuidv4();
        tableMap.set(t.name, tableId);

        // Simple Grid Layout
        const COLS_PER_ROW = 4;
        const x = (index % COLS_PER_ROW) * 300 + 50;
        const y = Math.floor(index / COLS_PER_ROW) * 400 + 50;

        const normalizedColumns = (t.columns || []).map(c => {
            const colId = uuidv4();
            colMap.set(`${t.name}.${c.name}`, colId);

            const isPk = normalizePkFlag(c.isPk);
            const nullable = normalizeNullableFlag(c.nullable ?? c.isNullable ?? c.null, !isPk);

            return {
                id: colId,
                name: c.name,
                type: c.type || 'VARCHAR',
                isPk,
                nullable,
                defaultValue: c.defaultValue ?? c.default ?? '',
                isUnique: normalizeBoolean(c.isUnique ?? c.unique, false),
                isAutoIncrement: normalizeBoolean(c.isAutoIncrement ?? c.autoIncrement ?? c.auto_increment, false),
                comment: c.comment || ''
            };
        });

        const columnNameToId = new Map(
            normalizedColumns.map(col => [col.name.toLowerCase(), col.id])
        );

        const normalizedIndexes = (t.indexes || []).map(indexDef => ({
            id: uuidv4(),
            name: indexDef.name || '',
            columnIds: resolveColumnRefs(indexDef.columnIds || indexDef.columns, columnNameToId),
            isUnique: normalizeBoolean(indexDef.isUnique, false),
            type: indexDef.type || indexDef.method || 'btree',
            comment: indexDef.comment || ''
        })).filter(indexDef => indexDef.columnIds.length > 0);

        const normalizedConstraints = (t.constraints || []).map(constraintDef => ({
            id: uuidv4(),
            name: constraintDef.name || '',
            type: constraintDef.type || 'unique',
            columnIds: resolveColumnRefs(constraintDef.columnIds || constraintDef.columns, columnNameToId),
            expression: constraintDef.expression || constraintDef.condition || '',
            comment: constraintDef.comment || ''
        })).filter(constraintDef => {
            if ((constraintDef.type || '').toLowerCase() === 'check') {
                return Boolean((constraintDef.expression || '').trim());
            }
            return constraintDef.columnIds.length > 0;
        });

        return {
            id: tableId,
            name: t.name,
            comment: t.comment || '',
            position: { x, y },
            columns: normalizedColumns,
            indexes: normalizedIndexes,
            constraints: normalizedConstraints
        };
    });

    // 2. Process Relationships
    const relationships = (data.relationships || []).map(r => {
        const fromTableId = tableMap.get(r.fromTable);
        const toTableId = tableMap.get(r.toTable);
        const fromColId = colMap.get(`${r.fromTable}.${r.fromCol}`);
        const toColId = colMap.get(`${r.toTable}.${r.toCol}`);

        if (fromTableId && toTableId && fromColId && toColId) {
            return {
                id: uuidv4(),
                fromTable: fromTableId,
                fromCol: fromColId,
                toTable: toTableId,
                toCol: toColId
            };
        }
        return null; // Invalid reference
    }).filter(r => r !== null);

    return normalizeSchema({ tables, relationships, bookmarks: [] });
}
