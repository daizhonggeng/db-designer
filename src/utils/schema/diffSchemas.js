import {
    normalizeSchema,
    resolveColumnReference,
    resolveTableReference,
} from './normalize';

function toKey(value) {
    return String(value || '').trim().toLowerCase();
}

function pairEntities(previousItems, currentItems, getName) {
    const currentById = new Map(currentItems.map(item => [item.id, item]));
    const usedCurrentIds = new Set();
    const pairs = [];
    const removed = [];
    const added = [];

    previousItems.forEach((previous) => {
        const currentBySameId = currentById.get(previous.id);
        if (currentBySameId) {
            pairs.push({ previous, current: currentBySameId });
            usedCurrentIds.add(currentBySameId.id);
            return;
        }

        const previousNameKey = toKey(getName(previous));
        const currentByName = currentItems.find(
            item => !usedCurrentIds.has(item.id) && toKey(getName(item)) === previousNameKey
        );

        if (currentByName) {
            pairs.push({ previous, current: currentByName });
            usedCurrentIds.add(currentByName.id);
        } else {
            removed.push(previous);
        }
    });

    currentItems.forEach((current) => {
        if (!usedCurrentIds.has(current.id)) {
            added.push(current);
        }
    });

    return { pairs, removed, added };
}

function createChangeCollector() {
    const changes = [];
    let serial = 0;

    const addChange = (category, action, message, extra = {}) => {
        serial += 1;
        changes.push({
            id: `${category}.${action}.${serial}`,
            category,
            action,
            message,
            ...extra,
        });
    };

    return { changes, addChange };
}

function compareScalarFields(changeCollector, category, table, previous, current, fields) {
    fields.forEach((field) => {
        if (previous[field] === current[field]) {
            return;
        }

        changeCollector.addChange(
            category,
            'update',
            `${category === 'table' ? '表' : '字段'} "${table.name}${category === 'column' ? `.${current.name}` : ''}" 的 ${field} 发生变化。`,
            {
                tableId: table.id,
                columnId: category === 'column' ? current.id : undefined,
                field,
                before: previous[field],
                after: current[field],
            }
        );
    });
}

function normalizeRefColumns(table, refs) {
    return refs
        .map(ref => resolveColumnReference(table, ref))
        .filter(Boolean)
        .map(column => column.id);
}

function compareRelationshipSets(previousSchema, currentSchema, changeCollector) {
    const serialize = (relationship, schema) => {
        const fromTable = resolveTableReference(schema, relationship.fromTable);
        const toTable = resolveTableReference(schema, relationship.toTable);
        const fromColumn = fromTable ? resolveColumnReference(fromTable, relationship.fromCol) : null;
        const toColumn = toTable ? resolveColumnReference(toTable, relationship.toCol) : null;

        return {
            key: [
                fromTable?.name || relationship.fromTable,
                fromColumn?.name || relationship.fromCol,
                toTable?.name || relationship.toTable,
                toColumn?.name || relationship.toCol,
            ].map(part => toKey(part)).join('::'),
            display: `${fromTable?.name || relationship.fromTable}.${fromColumn?.name || relationship.fromCol} -> ${toTable?.name || relationship.toTable}.${toColumn?.name || relationship.toCol}`,
            relationship,
        };
    };

    const previousSerialized = previousSchema.relationships.map(item => serialize(item, previousSchema));
    const currentSerialized = currentSchema.relationships.map(item => serialize(item, currentSchema));

    const previousKeys = new Set(previousSerialized.map(item => item.key));
    const currentKeys = new Set(currentSerialized.map(item => item.key));

    currentSerialized.forEach((item) => {
        if (!previousKeys.has(item.key)) {
            changeCollector.addChange(
                'relationship',
                'add',
                `新增关系 ${item.display}。`,
                { relationshipId: item.relationship.id }
            );
        }
    });

    previousSerialized.forEach((item) => {
        if (!currentKeys.has(item.key)) {
            changeCollector.addChange(
                'relationship',
                'remove',
                `删除关系 ${item.display}。`,
                { relationshipId: item.relationship.id }
            );
        }
    });
}

function compareTableDetails(previousTable, currentTable, changeCollector) {
    compareScalarFields(changeCollector, 'table', currentTable, previousTable, currentTable, ['name', 'comment']);

    const columnPairs = pairEntities(previousTable.columns, currentTable.columns, item => item.name);
    columnPairs.added.forEach((column) => {
        changeCollector.addChange(
            'column',
            'add',
            `表 "${currentTable.name}" 新增字段 "${column.name}"。`,
            { tableId: currentTable.id, columnId: column.id, after: column }
        );
    });
    columnPairs.removed.forEach((column) => {
        changeCollector.addChange(
            'column',
            'remove',
            `表 "${currentTable.name}" 删除字段 "${column.name}"。`,
            { tableId: currentTable.id, columnId: column.id, before: column }
        );
    });
    columnPairs.pairs.forEach(({ previous, current }) => {
        compareScalarFields(
            changeCollector,
            'column',
            currentTable,
            previous,
            current,
            ['name', 'type', 'comment', 'isPk', 'nullable', 'isUnique', 'isAutoIncrement', 'defaultValue']
        );
    });

    const indexPairs = pairEntities(previousTable.indexes, currentTable.indexes, item => item.name);
    indexPairs.added.forEach((indexItem) => {
        changeCollector.addChange(
            'index',
            'add',
            `表 "${currentTable.name}" 新增索引 "${indexItem.name}"。`,
            { tableId: currentTable.id, indexId: indexItem.id, after: indexItem }
        );
    });
    indexPairs.removed.forEach((indexItem) => {
        changeCollector.addChange(
            'index',
            'remove',
            `表 "${currentTable.name}" 删除索引 "${indexItem.name}"。`,
            { tableId: currentTable.id, indexId: indexItem.id, before: indexItem }
        );
    });
    indexPairs.pairs.forEach(({ previous, current }) => {
        const previousCols = normalizeRefColumns(previousTable, previous.columns).join(',');
        const currentCols = normalizeRefColumns(currentTable, current.columns).join(',');
        if (previousCols !== currentCols || previous.isUnique !== current.isUnique || previous.type !== current.type) {
            changeCollector.addChange(
                'index',
                'update',
                `表 "${currentTable.name}" 的索引 "${current.name}" 发生变化。`,
                {
                    tableId: currentTable.id,
                    indexId: current.id,
                    before: previous,
                    after: current,
                }
            );
        }
    });

    const constraintPairs = pairEntities(previousTable.constraints, currentTable.constraints, item => item.name);
    constraintPairs.added.forEach((constraint) => {
        changeCollector.addChange(
            'constraint',
            'add',
            `表 "${currentTable.name}" 新增约束 "${constraint.name}"。`,
            { tableId: currentTable.id, constraintId: constraint.id, after: constraint }
        );
    });
    constraintPairs.removed.forEach((constraint) => {
        changeCollector.addChange(
            'constraint',
            'remove',
            `表 "${currentTable.name}" 删除约束 "${constraint.name}"。`,
            { tableId: currentTable.id, constraintId: constraint.id, before: constraint }
        );
    });
    constraintPairs.pairs.forEach(({ previous, current }) => {
        const previousCols = normalizeRefColumns(previousTable, previous.columns).join(',');
        const currentCols = normalizeRefColumns(currentTable, current.columns).join(',');
        const previousRef = toKey(previous.referenceTable);
        const currentRef = toKey(current.referenceTable);
        const previousRefCols = previous.referenceColumns.map(toKey).join(',');
        const currentRefCols = current.referenceColumns.map(toKey).join(',');

        if (
            previous.type !== current.type ||
            previous.expression !== current.expression ||
            previousCols !== currentCols ||
            previousRef !== currentRef ||
            previousRefCols !== currentRefCols
        ) {
            changeCollector.addChange(
                'constraint',
                'update',
                `表 "${currentTable.name}" 的约束 "${current.name}" 发生变化。`,
                {
                    tableId: currentTable.id,
                    constraintId: current.id,
                    before: previous,
                    after: current,
                }
            );
        }
    });
}

function buildSummary(changes, previousSchema, currentSchema) {
    const countBy = (category, action) => changes.filter(item => item.category === category && item.action === action).length;
    return {
        previousTableCount: previousSchema.tables.length,
        currentTableCount: currentSchema.tables.length,
        tableAdded: countBy('table', 'add'),
        tableRemoved: countBy('table', 'remove'),
        tableUpdated: countBy('table', 'update'),
        columnAdded: countBy('column', 'add'),
        columnRemoved: countBy('column', 'remove'),
        columnUpdated: countBy('column', 'update'),
        indexAdded: countBy('index', 'add'),
        indexRemoved: countBy('index', 'remove'),
        indexUpdated: countBy('index', 'update'),
        constraintAdded: countBy('constraint', 'add'),
        constraintRemoved: countBy('constraint', 'remove'),
        constraintUpdated: countBy('constraint', 'update'),
        relationshipAdded: countBy('relationship', 'add'),
        relationshipRemoved: countBy('relationship', 'remove'),
        totalChanges: changes.length,
    };
}

export function diffSchemas(previousRawSchema, currentRawSchema) {
    const previousSchema = normalizeSchema(previousRawSchema);
    const currentSchema = normalizeSchema(currentRawSchema);
    const changeCollector = createChangeCollector();

    const tablePairs = pairEntities(previousSchema.tables, currentSchema.tables, item => item.name);

    tablePairs.added.forEach((table) => {
        changeCollector.addChange(
            'table',
            'add',
            `新增表 "${table.name}"。`,
            { tableId: table.id, after: table }
        );
    });

    tablePairs.removed.forEach((table) => {
        changeCollector.addChange(
            'table',
            'remove',
            `删除表 "${table.name}"。`,
            { tableId: table.id, before: table }
        );
    });

    tablePairs.pairs.forEach(({ previous, current }) => {
        compareTableDetails(previous, current, changeCollector);
    });

    compareRelationshipSets(previousSchema, currentSchema, changeCollector);

    return {
        previousSchema,
        currentSchema,
        changes: changeCollector.changes,
        summary: buildSummary(changeCollector.changes, previousSchema, currentSchema),
    };
}

export function formatDiffAsText(diffResult) {
    if (!diffResult || !Array.isArray(diffResult.changes)) {
        return '没有可用的差异结果。';
    }

    if (diffResult.changes.length === 0) {
        return '两个 schema 没有结构差异。';
    }

    return diffResult.changes
        .map(change => `- [${change.category}.${change.action}] ${change.message}`)
        .join('\n');
}
