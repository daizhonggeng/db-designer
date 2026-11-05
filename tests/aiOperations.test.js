import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applySchemaOperations, fingerprintSchema } from '../src/utils/aiOperations.js';

function existingSchema() {
    return {
        tables: [
            { id: 't-users', name: 'users', comment: '客户', position: { x: 20, y: 40 }, width: 320, height: 160,
                columns: [{ id: 'c-id', name: 'id', type: 'INT', isPk: true, nullable: false, comment: '编号' },
                    { id: 'c-name', name: 'name', type: 'VARCHAR(60)', defaultValue: '', comment: '姓名' }],
                indexes: [{ id: 'idx-name', name: 'idx_name', columnIds: ['c-name'], type: 'BTREE', isUnique: false }],
                constraints: [] },
            { id: 't-orders', name: 'orders', comment: '订单', position: { x: 420, y: 40 },
                columns: [{ id: 'c-order', name: 'id', type: 'INT', isPk: true }, { id: 'c-user', name: 'user_id', type: 'INT' }],
                indexes: [], constraints: [] },
        ],
        relationships: [{ id: 'r-user', fromTable: 't-orders', fromCol: 'c-user', toTable: 't-users', toCol: 'c-id' }],
        bookmarks: [{ id: 'b1', title: '分组', x: 1, y: 2, width: 300, height: 200 }],
        designPreset: { rules: '名称使用下划线', sourceName: '规范' },
    };
}

test('基于现有设计修改字段和新增表，保留未修改的属性、关系与项目规范', () => {
    const original = existingSchema();
    const result = applySchemaOperations(original, [
        { op: 'update_column', table: 'users', column: 'name', changes: { type: 'VARCHAR(120)', comment: '客户姓名' } },
        { op: 'add_column', table: 'users', column: { id: 'c-phone', name: 'phone', type: 'VARCHAR(30)', nullable: true } },
        { op: 'add_table', table: { id: 't-items', name: 'order_items', comment: '订单明细', columns: [{ id: 'c-item', name: 'id', type: 'INT', isPk: true }, { id: 'c-parent', name: 'order_id', type: 'INT' }] } },
        { op: 'add_relationship', relationship: { id: 'r-items', fromTable: 't-items', fromCol: 'c-parent', toTable: 't-orders', toCol: 'c-order' } },
    ]);
    assert.equal(result.schema.tables.length, 3);
    assert.equal(result.schema.tables[0].columns[1].type, 'VARCHAR(120)');
    assert.equal(result.schema.tables[0].columns[1].defaultValue, '');
    assert.equal(result.schema.tables[0].indexes[0].id, 'idx-name');
    assert.deepEqual(result.schema.tables[0].position, original.tables[0].position);
    assert.deepEqual(result.schema.bookmarks, original.bookmarks);
    assert.deepEqual(result.schema.designPreset, original.designPreset);
    assert.equal(result.schema.relationships.length, 2);
    assert.equal(result.changes.length, 4);
    assert.equal(original.tables.length, 2);
    assert.equal(original.tables[0].columns[1].type, 'VARCHAR(60)');
});

test('删除被引用字段前必须显式删除相关关系和索引，失败不修改原模型', () => {
    const original = existingSchema();
    assert.throws(() => applySchemaOperations(original, [{ op: 'delete_column', table: 'users', column: 'id' }]), /关系|引用/);
    assert.throws(() => applySchemaOperations(original, [{ op: 'delete_column', table: 'users', column: 'name' }]), /索引|引用/);
    const result = applySchemaOperations(original, [
        { op: 'delete_relationship', relationship: 'r-user' },
        { op: 'delete_index', table: 'users', index: 'idx-name' },
        { op: 'delete_column', table: 'users', column: 'name' },
        { op: 'delete_column', table: 'users', column: 'id' },
    ]);
    assert.equal(result.schema.tables[0].columns.length, 0);
    assert.equal(result.schema.relationships.length, 0);
    assert.equal(original.relationships.length, 1);
    assert.equal(original.tables[0].columns.length, 2);
});

test('支持索引和约束增改删，拒绝未知字段、缺失类型、歧义和重复标识', () => {
    const original = existingSchema();
    const result = applySchemaOperations(original, [
        { op: 'add_index', table: 'orders', index: { id: 'idx-user', name: 'idx_user', columnIds: ['user_id'], type: 'BTREE', isUnique: false } },
        { op: 'update_index', table: 'orders', index: 'idx-user', changes: { isUnique: true } },
        { op: 'add_constraint', table: 'orders', constraint: { id: 'c-check', name: 'chk_id', type: 'check', expression: 'id > 0' } },
        { op: 'update_constraint', table: 'orders', constraint: 'c-check', changes: { expression: 'id >= 0' } },
    ]);
    assert.deepEqual(result.schema.tables[1].indexes[0].columnIds, ['c-user']);
    assert.equal(result.schema.tables[1].indexes[0].isUnique, true);
    assert.equal(result.schema.tables[1].constraints[0].expression, 'id >= 0');
    assert.throws(() => applySchemaOperations(original, [{ op: 'update_table', table: 'users', changes: { badField: 'x' } }]), /不支持/);
    assert.throws(() => applySchemaOperations(original, [{ op: 'add_column', table: 'users', column: { name: 'bad', type: '' } }]), /类型/);
    assert.throws(() => applySchemaOperations(original, [{ op: 'add_table', table: { id: 't-users', name: 'other', columns: [] } }]), /标识|重复/);
    assert.throws(() => applySchemaOperations(original, [{ op: 'delete_table', table: 'missing' }]), /不存在/);
});

test('指纹忽略画布测量尺寸，但会检测字段、布局、关系或规范修改', async () => {
    const original = existingSchema();
    const first = await fingerprintSchema(original);
    const measured = structuredClone(original);
    measured.tables[0].width = 450;
    measured.tables[0].height = 500;
    assert.equal(await fingerprintSchema(measured), first);
    for (const mutate of [
        schema => { schema.tables[0].columns[0].name = 'changed'; },
        schema => { schema.tables[0].position.x += 20; },
        schema => { schema.relationships = []; },
        schema => { schema.designPreset.rules = '不同规范'; },
    ]) {
        const changed = structuredClone(original);
        mutate(changed);
        assert.notEqual(await fingerprintSchema(changed), first);
    }
});

test('拒绝操作顶层不支持的参数', () => {
    assert.throws(() => applySchemaOperations({ tables: [], relationships: [] }, [{ op: 'add_table', table: { name: 'users', columns: [] }, unexpected: true }]), /不支持的字段/);
});
