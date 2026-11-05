import { v4 as uuidv4 } from 'uuid';

export const MAX_PDM_SIZE = 20 * 1024 * 1024;

const children = (node, namespace, name) => Array.from(node?.childNodes || [])
    .filter(child => child.nodeType === 1 && child.namespaceURI === namespace && child.localName === name);
const collection = (node, name) => children(node, 'collection', name)[0];
const attribute = (node, name) => children(node, 'attribute', name)[0]?.textContent.trim() || '';
const objects = (node, name) => Array.from(node.getElementsByTagNameNS('object', name))
    .filter(element => element.hasAttribute('Id'));
const reference = (node, name) => Array.from(collection(node, name)?.childNodes || [])
    .find(child => child.nodeType === 1 && child.hasAttribute('Ref'))?.getAttribute('Ref');

function objectName(node) {
    const name = attribute(node, 'Code') || attribute(node, 'Name');
    if (!name) throw new Error('PDM 中存在没有名称的表或字段，请补全后重试。');
    return name;
}

function objectComment(node, name) {
    const label = attribute(node, 'Name');
    return attribute(node, 'Comment') || (label !== name ? label : '');
}

function columnType(node, domains) {
    const domain = domains.get(reference(node, 'Domain'));
    const type = attribute(node, 'DataType') || attribute(domain, 'DataType');
    if (!type) return '';

    const length = attribute(node, 'Length') || attribute(domain, 'Length');
    const precision = attribute(node, 'Precision') || attribute(domain, 'Precision');
    const resolved = type.replace(/%[ns]/gi, length).replace(/%p/gi, precision);
    if (/%[a-z]/i.test(resolved) || /\(\s*(?:,|\))|,\s*\)/.test(resolved)) {
        throw new Error(`字段“${objectName(node)}”的数据类型缺少长度或精度。`);
    }
    return resolved;
}

export function parsePDM(xml) {
    if (typeof xml !== 'string' || !xml.trim()) throw new Error('PDM 文件为空。');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不支持包含 DTD 或实体声明的 PDM 文件。');

    let document;
    try {
        document = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        throw new Error('PDM XML 格式错误，请确认文件完整。');
    }
    if (document.getElementsByTagNameNS('*', 'parsererror').length) {
        throw new Error('PDM XML 格式错误，请确认文件完整。');
    }
    const model = objects(document, 'Model')[0];
    if (!model) throw new Error('未找到 PowerDesigner 物理模型，请选择 .pdm 文件。');
    const tableNodes = objects(model, 'Table');
    if (!tableNodes.length) throw new Error('PDM 中没有可导入的数据表。');

    const domains = new Map(objects(model, 'PhysicalDomain').map(node => [node.getAttribute('Id'), node]));
    const tableMap = new Map();
    const columnMap = new Map();
    const tables = tableNodes.map(node => {
        const pdmId = node.getAttribute('Id');
        if (tableMap.has(pdmId)) throw new Error('PDM 中存在重复的表标识。');
        const name = objectName(node);
        const primaryKeyId = reference(node, 'PrimaryKey');
        const primaryKey = children(collection(node, 'Keys'), 'object', 'Key')
            .find(key => key.getAttribute('Id') === primaryKeyId);
        if (primaryKeyId && !primaryKey) throw new Error(`表“${name}”的主键引用无效。`);
        const primaryColumns = new Set(children(collection(primaryKey, 'Key.Columns'), 'object', 'Column')
            .map(column => column.getAttribute('Ref')));
        const table = {
            id: uuidv4(), name, comment: objectComment(node, name),
            position: { x: 0, y: 0 },
            columns: children(collection(node, 'Columns'), 'object', 'Column').map(column => {
                const columnId = column.getAttribute('Id');
                if (!columnId || columnMap.has(columnId)) throw new Error(`表“${name}”中存在缺失或重复的字段标识。`);
                const columnName = objectName(column);
                const result = {
                    id: uuidv4(), name: columnName, type: columnType(column, domains),
                    isPk: primaryColumns.has(columnId), comment: objectComment(column, columnName)
                };
                columnMap.set(columnId, { column: result, tableId: pdmId });
                return result;
            })
        };
        if (!table.columns.length) throw new Error(`表“${name}”没有可导入的字段。`);
        if ([...primaryColumns].some(id => columnMap.get(id)?.tableId !== pdmId)) {
            throw new Error(`表“${name}”的主键包含无效字段。`);
        }
        tableMap.set(pdmId, table);
        return table;
    });

    // 根据实际字段数排列，避免大表遮挡下一行。
    let rowY = 50;
    for (let start = 0; start < tables.length; start += 4) {
        const row = tables.slice(start, start + 4);
        row.forEach((table, index) => { table.position = { x: 50 + index * 320, y: rowY }; });
        rowY += Math.max(...row.map(table => 100 + table.columns.length * 40), 300) + 80;
    }

    const relationships = [];
    for (const node of objects(model, 'Reference')) {
        const parentId = reference(node, 'ParentTable');
        const childId = reference(node, 'ChildTable');
        const parent = tableMap.get(parentId);
        const child = tableMap.get(childId);
        const joins = children(collection(node, 'Joins'), 'object', 'ReferenceJoin');
        if (!parent || !child || !joins.length) {
            throw new Error(`关联“${attribute(node, 'Code') || attribute(node, 'Name') || node.getAttribute('Id')}”不完整，或引用了外部模型的表。`);
        }
        for (const join of joins) {
            // PowerDesigner 的 Object1 为父表列，Object2 为子表外键列。
            const parentColumn = columnMap.get(reference(join, 'Object1'));
            const childColumn = columnMap.get(reference(join, 'Object2'));
            if (parentColumn?.tableId !== parentId || childColumn?.tableId !== childId) {
                throw new Error('PDM 外键关联包含无效的字段引用，请修正后重新导入。');
            }
            relationships.push({
                id: uuidv4(), fromTable: child.id, fromCol: childColumn.column.id,
                toTable: parent.id, toCol: parentColumn.column.id
            });
        }
    }
    return { tables, relationships };
}

export async function readPDMFile(file) {
    if (!file || !/\.pdm$/i.test(file.name)) throw new Error('请选择 PowerDesigner .pdm 文件。');
    if (!file.size) throw new Error('PDM 文件为空。');
    if (file.size > MAX_PDM_SIZE) throw new Error('PDM 文件不能超过 20 MB。');

    const bytes = new Uint8Array(await file.arrayBuffer());
    let encoding = 'utf-8';
    if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0x3c && bytes[1] === 0)) {
        encoding = 'utf-16le';
    } else if ((bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0 && bytes[1] === 0x3c)) {
        encoding = 'utf-16be';
    } else {
        const header = new TextDecoder().decode(bytes.slice(0, 200));
        encoding = header.match(/^\s*<\?xml\b[^?]*encoding\s*=\s*["']([^"']+)["']/i)?.[1] || encoding;
    }
    let xml;
    try {
        xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
        throw new Error('无法读取 PDM 文件编码，请在 PowerDesigner 中另存为 UTF-8 后重试。');
    }
    return parsePDM(xml);
}
