import { v4 as uuidv4 } from 'uuid';

export function parseReverseEngResult(jsonInput) {
    let data;
    try {
        // Handle potential array wrapping or single object
        const parsed = JSON.parse(jsonInput);
        // Sometimes users might copy array of one object
        data = Array.isArray(parsed) ? parsed[0] : parsed;
    } catch (e) {
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

        return {
            id: tableId,
            name: t.name,
            comment: t.comment || '',
            position: { x, y },
            columns: (t.columns || []).map(c => {
                const colId = uuidv4();
                colMap.set(`${t.name}.${c.name}`, colId);
                return {
                    id: colId,
                    name: c.name,
                    type: c.type || 'VARCHAR',
                    isPk: c.isPk === true || c.isPk === 'true' || c.isPk === 'YES' || c.isPk === 1,
                    comment: c.comment || ''
                };
            })
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

    return { tables, relationships };
}
