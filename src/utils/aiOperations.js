import { v4 as uuidv4 } from 'uuid';
import { normalizeColumn, normalizeTable } from './schemaModel.js';

const TABLE_FIELDS = ['name', 'comment', 'position'];
const COLUMN_FIELDS = ['name', 'type', 'comment', 'isPk', 'nullable', 'isUnique', 'isAutoIncrement', 'defaultValue'];
const INDEX_FIELDS = ['name', 'type', 'columnIds', 'isUnique', 'comment'];
const CONSTRAINT_FIELDS = ['name', 'type', 'columnIds', 'expression', 'comment'];
const RELATION_FIELDS = ['name', 'fromTable', 'fromCol', 'toTable', 'toCol', 'onDelete', 'onUpdate'];

function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式无效`);
    return value;
}

function string(value, label) {
    if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw new Error(`${label}不能为空`);
    return value.trim();
}

function changesFor(value, allowed, label) {
    const changes = object(value, label);
    const invalid = Object.keys(changes).find(key => !allowed.includes(key));
    if (invalid) throw new Error(`${label}包含不支持的字段：${invalid}`);
    if (!Object.keys(changes).length) throw new Error(`${label}没有修改内容`);
    for (const [key, item] of Object.entries(changes)) {
        if (['name', 'type'].includes(key)) string(item, key);
        else if (['isPk', 'nullable', 'isUnique', 'isAutoIncrement'].includes(key) && typeof item !== 'boolean') throw new Error(`${key}必须为布尔值`);
        else if (['comment', 'expression', 'onDelete', 'onUpdate', 'fromTable', 'fromCol', 'toTable', 'toCol'].includes(key) && typeof item !== 'string') throw new Error(`${key}必须为文字`);
        else if (key === 'columnIds' && (!Array.isArray(item) || !item.every(id => typeof id === 'string'))) throw new Error('字段引用必须为列表');
        else if (key === 'position' && (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y))) throw new Error('表位置无效');
        else if (key === 'defaultValue' && item !== null && !['string', 'number', 'boolean'].includes(typeof item)) throw new Error('默认值格式无效');
    }
    return changes;
}

function findUnique(items, reference, label) {
    const key = string(reference, label);
    const byId = items.find(item => item.id === key);
    if (byId) return byId;
    const matches = items.filter(item => item.name?.toLowerCase() === key.toLowerCase());
    if (matches.length > 1) throw new Error(`${label}“${key}”不唯一，请使用标识`);
    if (!matches.length) throw new Error(`${label}“${key}”不存在`);
    return matches[0];
}

function ensureUnique(items, id, name, label, exceptId) {
    if (items.some(item => item.id === id && item.id !== exceptId)) throw new Error(`${label}标识重复`);
    if (name && items.some(item => item.id !== exceptId && item.name?.toLowerCase() === name.toLowerCase())) throw new Error(`${label}名称“${name}”重复`);
}

function allColumns(schema) {
    return schema.tables.flatMap(table => table.columns);
}

function getTable(schema, reference) {
    return findUnique(schema.tables, reference, '表');
}

function getColumn(table, reference) {
    return findUnique(table.columns, reference, `表“${table.name}”的字段`);
}

function columnRefs(table, references) {
    if (!Array.isArray(references) || !references.length) throw new Error('索引或约束至少需要一个字段');
    const result = references.map(reference => getColumn(table, reference).id);
    if (new Set(result).size !== result.length) throw new Error('索引或约束中的字段重复');
    return result;
}

function ensureIntegrity(schema) {
    for (const relationship of schema.relationships) {
        const from = schema.tables.find(table => table.id === relationship.fromTable);
        const to = schema.tables.find(table => table.id === relationship.toTable);
        if (!from?.columns.some(column => column.id === relationship.fromCol) || !to?.columns.some(column => column.id === relationship.toCol)) {
            throw new Error('修改后仍有关系引用被删除的表或字段，请先删除或修改相关关系');
        }
    }
    for (const table of schema.tables) {
        const ids = new Set(table.columns.map(column => column.id));
        for (const index of table.indexes || []) {
            if (!(index.columnIds || []).length || index.columnIds.some(id => !ids.has(id))) throw new Error(`表“${table.name}”的索引引用了已删除的字段`);
        }
        for (const constraint of table.constraints || []) {
            if ((constraint.columnIds || []).some(id => !ids.has(id))) throw new Error(`表“${table.name}”的约束引用了已删除的字段`);
        }
    }
}

function formatChanges(changes) {
    return Object.entries(changes).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('；');
}

function createColumn(schema, table, raw) {
    const column = object(raw, '新字段');
    const invalid = Object.keys(column).find(key => !['id', ...COLUMN_FIELDS].includes(key));
    if (invalid) throw new Error(`新字段包含不支持的字段：${invalid}`);
    const id = column.id ? string(column.id, '字段标识') : uuidv4();
    const name = string(column.name, '字段名称');
    string(column.type, '字段类型');
    if (allColumns(schema).some(item => item.id === id)) throw new Error('字段标识重复');
    ensureUnique(table.columns, id, name, '字段');
    changesFor(Object.fromEntries(Object.entries(column).filter(([key]) => key !== 'id')), COLUMN_FIELDS, '字段');
    return normalizeColumn({ ...column, id, name });
}

function addDefinition(table, kind, raw) {
    const value = object(raw, kind === 'indexes' ? '索引' : '约束');
    const allowed = kind === 'indexes' ? INDEX_FIELDS : CONSTRAINT_FIELDS;
    const invalid = Object.keys(value).find(key => !['id', ...allowed].includes(key));
    if (invalid) throw new Error(`定义包含不支持的字段：${invalid}`);
    const id = value.id ? string(value.id, '定义标识') : uuidv4();
    const name = string(value.name, '定义名称');
    const items = table[kind] || (table[kind] = []);
    ensureUnique(items, id, name, kind === 'indexes' ? '索引' : '约束');
    const type = string(value.type || (kind === 'indexes' ? 'BTREE' : 'unique'), '定义类型');
    if (kind === 'constraints' && !['primary_key', 'unique', 'check'].includes(type.toLowerCase())) throw new Error('不支持的约束类型');
    if (kind === 'indexes' && value.isUnique !== undefined && typeof value.isUnique !== 'boolean') throw new Error('isUnique必须为布尔值');
    const isCheck = kind === 'constraints' && type.toLowerCase() === 'check';
    if (isCheck) string(value.expression, '检查表达式');
    const refs = isCheck ? [] : columnRefs(table, value.columnIds);
    const item = kind === 'indexes'
        ? { id, name, type, isUnique: value.isUnique || false, comment: value.comment || '', columnIds: refs }
        : { id, name, type: type.toLowerCase(), expression: value.expression || '', comment: value.comment || '', columnIds: refs };
    items.push(item);
    return item;
}

function newRelationship(schema, raw) {
    const value = object(raw, '关系');
    const invalid = Object.keys(value).find(key => !['id', ...RELATION_FIELDS].includes(key));
    if (invalid) throw new Error(`关系包含不支持的字段：${invalid}`);
    const id = value.id ? string(value.id, '关系标识') : uuidv4();
    if (schema.relationships.some(item => item.id === id)) throw new Error('关系标识重复');
    const from = getTable(schema, value.fromTable);
    const to = getTable(schema, value.toTable);
    return {
        ...value, id,
        fromTable: from.id, fromCol: getColumn(from, value.fromCol).id,
        toTable: to.id, toCol: getColumn(to, value.toCol).id,
    };
}

export function applySchemaOperations(current, operations) {
    if (!Array.isArray(operations) || operations.length > 500) throw new Error('修改操作必须是最多 500 项的列表');
    const schema = structuredClone({
        tables: current.tables || [], relationships: current.relationships || [],
        bookmarks: current.bookmarks || [], designPreset: current.designPreset || null,
    });
    const summary = [];

    for (const raw of operations) {
        const operation = object(raw, '修改操作');
        const op = string(operation.op, '操作类型');
        const fields = {
            add_table: ['table'], update_table: ['table', 'changes'], delete_table: ['table'],
            add_column: ['table', 'column'], update_column: ['table', 'column', 'changes'], delete_column: ['table', 'column'],
            add_index: ['table', 'index'], update_index: ['table', 'index', 'changes'], delete_index: ['table', 'index'],
            add_constraint: ['table', 'constraint'], update_constraint: ['table', 'constraint', 'changes'], delete_constraint: ['table', 'constraint'],
            add_relationship: ['relationship'], update_relationship: ['relationship', 'changes'], delete_relationship: ['relationship'],
        };
        if (!Object.hasOwn(fields, op)) throw new Error(`不支持的修改操作：${op}`);
        const extra = Object.keys(operation).find(key => key !== 'op' && !fields[op].includes(key));
        if (extra) throw new Error(`修改操作包含不支持的字段：${extra}`);
        if (op === 'add_table') {
            const value = object(operation.table, '新表');
            const invalid = Object.keys(value).find(key => !['id', 'name', 'comment', 'position', 'columns'].includes(key));
            if (invalid) throw new Error(`新表包含不支持的字段：${invalid}`);
            const id = value.id ? string(value.id, '表标识') : uuidv4();
            const name = string(value.name, '表名称');
            ensureUnique(schema.tables, id, name, '表');
            if (!Array.isArray(value.columns)) throw new Error('新表的字段必须是列表');
            const position = value.position || { x: 50, y: Math.max(0, ...schema.tables.map(table => table.position.y + (table.height || 240))) + 80 };
            if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('表位置无效');
            const table = { id, name, comment: value.comment || '', position, columns: [], indexes: [], constraints: [] };
            schema.tables.push(table);
            for (const column of value.columns) table.columns.push(createColumn(schema, table, column));
            schema.tables[schema.tables.length - 1] = normalizeTable(table);
            summary.push(`新增表“${name}”：${table.columns.map(column => `${column.name} ${column.type}`).join("、") || "无字段"}`);
        } else if (op === 'update_table') {
            const table = getTable(schema, operation.table);
            const changes = changesFor(operation.changes, TABLE_FIELDS, '表修改');
            if (changes.name) ensureUnique(schema.tables, table.id, changes.name, '表', table.id);
            summary.push(`修改表“${table.name}”：${formatChanges(changes)}`);
            Object.assign(table, changes);
        } else if (op === 'delete_table') {
            const table = getTable(schema, operation.table);
            schema.tables = schema.tables.filter(item => item.id !== table.id);
            summary.push(`删除表“${table.name}”`);
        } else if (op === 'add_column') {
            const table = getTable(schema, operation.table);
            const column = createColumn(schema, table, operation.column);
            table.columns.push(column);
            summary.push(`在表“${table.name}”新增字段“${column.name}” ${column.type}`);
        } else if (op === 'update_column') {
            const table = getTable(schema, operation.table);
            const column = getColumn(table, operation.column);
            const changes = changesFor(operation.changes, COLUMN_FIELDS, '字段修改');
            if (changes.name) ensureUnique(table.columns, column.id, changes.name, '字段', column.id);
            summary.push(`修改“${table.name}.${column.name}”：${formatChanges(changes)}`);
            Object.assign(column, changes);
        } else if (op === 'delete_column') {
            const table = getTable(schema, operation.table);
            const column = getColumn(table, operation.column);
            table.columns = table.columns.filter(item => item.id !== column.id);
            summary.push(`删除字段“${table.name}.${column.name}”`);
        } else if (['add_index', 'add_constraint'].includes(op)) {
            const table = getTable(schema, operation.table);
            const isIndex = op === 'add_index';
            const item = addDefinition(table, isIndex ? 'indexes' : 'constraints', isIndex ? operation.index : operation.constraint);
            summary.push(`在表“${table.name}”新增${isIndex ? '索引' : '约束'}“${item.name}”：${formatChanges(item)}`);
        } else if (['update_index', 'update_constraint', 'delete_index', 'delete_constraint'].includes(op)) {
            const table = getTable(schema, operation.table);
            const isIndex = op.endsWith('index');
            const kind = isIndex ? 'indexes' : 'constraints';
            const label = isIndex ? '索引' : '约束';
            const item = findUnique(table[kind] || [], isIndex ? operation.index : operation.constraint, label);
            if (op.startsWith('delete')) {
                table[kind] = table[kind].filter(entry => entry.id !== item.id);
                summary.push(`删除表“${table.name}”的${label}“${item.name}”`);
            } else {
                const changes = changesFor(operation.changes, isIndex ? INDEX_FIELDS : CONSTRAINT_FIELDS, `${label}修改`);
                if (changes.name) ensureUnique(table[kind], item.id, changes.name, label, item.id);
                if (changes.columnIds) changes.columnIds = columnRefs(table, changes.columnIds);
                if (!isIndex && changes.type) {
                    changes.type = changes.type.toLowerCase();
                    if (!['primary_key', 'unique', 'check'].includes(changes.type)) throw new Error('不支持的约束类型');
                }
                summary.push(`修改表“${table.name}”的${label}“${item.name}”：${formatChanges(changes)}`);
                Object.assign(item, changes);
            }
        } else if (op === 'add_relationship') {
            const relationship = newRelationship(schema, operation.relationship);
            schema.relationships.push(relationship);
            summary.push(`新增关系：${relationship.fromTable}.${relationship.fromCol} → ${relationship.toTable}.${relationship.toCol}`);
        } else if (op === 'delete_relationship') {
            const relationship = findUnique(schema.relationships, operation.relationship, '关系');
            schema.relationships = schema.relationships.filter(item => item.id !== relationship.id);
            summary.push(`删除关系“${relationship.name || relationship.id}”`);
        } else if (op === 'update_relationship') {
            const relationship = findUnique(schema.relationships, operation.relationship, '关系');
            const changes = changesFor(operation.changes, RELATION_FIELDS, '关系修改');
            const allowed = Object.fromEntries(['id', ...RELATION_FIELDS].filter(key => relationship[key] !== undefined).map(key => [key, relationship[key]]));
            const replacement = newRelationship({ ...schema, relationships: schema.relationships.filter(item => item.id !== relationship.id) }, { ...allowed, ...changes });
            Object.assign(relationship, replacement);
            summary.push(`修改关系“${relationship.name || relationship.id}”：${formatChanges(changes)}`);
        } else {
            throw new Error(`不支持的修改操作：${op}`);
        }
    }

    ensureIntegrity(schema);
    return { schema, changes: summary };
}

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
}

export async function fingerprintSchema(schema) {
    const relevant = {
        tables: (schema.tables || []).map(table => Object.fromEntries(Object.entries(table).filter(([key]) => key !== 'width' && key !== 'height'))),
        relationships: schema.relationships || [],
        bookmarks: schema.bookmarks || [],
        designPreset: schema.designPreset || null,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(canonical(relevant)));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
