import { normalizeSchema } from './schemaModel.js';

export function projectSnapshot(state) {
    return { tables: state.tables || [], relationships: state.relationships || [], bookmarks: state.bookmarks || [] };
}

export function parseProjectFile(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('文件不是有效的 JSON，请选择从本工具导出的项目备份');
    }
    const schema = data?.schema || data?.schema_data || data;
    if (!schema || !Array.isArray(schema.tables) || !Array.isArray(schema.relationships)) {
        throw new Error('项目文件需要包含 tables 和 relationships 数组');
    }
    if (schema.tables.some(table => !table || typeof table.name !== 'string' || !Array.isArray(table.columns)
        || table.columns.some(column => !column || typeof column.name !== 'string'))) {
        throw new Error('文件中的表或字段格式不完整');
    }
    return { name: typeof data.name === 'string' ? data.name : '', schema: normalizeSchema(schema) };
}

export function downloadProject(name, schema) {
    const blob = new Blob([JSON.stringify({ format: 'db-designer', version: 1, name, schema: projectSnapshot(schema) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(name || '数据库项目').replace(/[<>:"/\\|?*]/g, '_')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createOrderExample() {
    return normalizeSchema({
        tables: [
            { id: 'customers', name: 'customers', comment: '客户', position: { x: 70, y: 110 }, columns: [
                { id: 'customer-id', name: 'id', type: 'INT', isPk: true, isAutoIncrement: true },
                { id: 'customer-name', name: 'name', type: 'VARCHAR(100)', nullable: false, comment: '客户姓名' },
                { id: 'customer-email', name: 'email', type: 'VARCHAR(255)', isUnique: true, comment: '邮箱' },
            ] },
            { id: 'orders', name: 'orders', comment: '订单', position: { x: 510, y: 110 }, columns: [
                { id: 'order-id', name: 'id', type: 'INT', isPk: true, isAutoIncrement: true },
                { id: 'order-customer', name: 'customer_id', type: 'INT', nullable: false, comment: '所属客户' },
                { id: 'order-total', name: 'total_amount', type: 'DECIMAL(12,2)', nullable: false, defaultValue: '0', comment: '订单金额' },
                { id: 'order-created', name: 'created_at', type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP', comment: '下单时间' },
            ] },
            { id: 'order-items', name: 'order_items', comment: '订单明细', position: { x: 950, y: 110 }, columns: [
                { id: 'item-id', name: 'id', type: 'INT', isPk: true, isAutoIncrement: true },
                { id: 'item-order', name: 'order_id', type: 'INT', nullable: false, comment: '所属订单' },
                { id: 'item-name', name: 'product_name', type: 'VARCHAR(200)', nullable: false, comment: '商品名称' },
                { id: 'item-count', name: 'quantity', type: 'INT', nullable: false, defaultValue: '1', comment: '购买数量' },
            ] },
        ],
        relationships: [
            { id: 'orders-customers', fromTable: 'orders', fromCol: 'order-customer', toTable: 'customers', toCol: 'customer-id' },
            { id: 'items-orders', fromTable: 'order-items', fromCol: 'item-order', toTable: 'orders', toCol: 'order-id' },
        ],
        bookmarks: [],
    });
}

export function rememberProject(userId, projectId) {
    localStorage.setItem(`db-designer:recent:${userId}`, String(projectId));
}

export function mostRecentProject(projects, userId) {
    const recentId = localStorage.getItem(`db-designer:recent:${userId}`);
    return projects.find(project => String(project.id) === recentId)
        || [...projects].sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))[0]
        || null;
}
