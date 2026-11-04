import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { MAX_PDM_SIZE, parsePDM, readPDMFile } from '../src/utils/pdmParser.js';
import { generateSchemaSQL } from '../src/utils/sqlGenerator.js';

// 浏览器原生 DOMParser 会返回 parsererror；Node 测试环境将 XML 错误直接抛出。
globalThis.DOMParser = class extends DOMParser {
    constructor() {
        super({ onError: () => { throw new Error('Invalid XML'); } });
    }
};
const xml = readFileSync(new URL('./fixtures/example.pdm', import.meta.url), 'utf8');

test('解析表、包内表、字段顺序、中文注释、域与类型参数', () => {
    const { tables } = parsePDM(xml);
    assert.deepEqual(tables.map(table => table.name), ['users', 'orders']);
    assert.equal(tables[0].comment, '用户 & 账号');
    assert.equal(tables[1].comment, '订单');
    assert.deepEqual(tables[0].columns.map(column => column.name), ['id', 'tenant_id', 'name']);
    assert.equal(tables[0].columns[0].comment, '用户编号');
    assert.equal(tables[0].columns[2].type, 'varchar(80)');
    assert.equal(tables[1].columns[3].type, 'decimal(18,2)');
    assert.equal(tables[1].columns[3].comment, '金额 < 10000');
    assert.notDeepEqual(tables[0].position, tables[1].position);
});

test('仅将 PrimaryKey 指定的键标记为主键，保留复合主键', () => {
    const { tables } = parsePDM(xml);
    assert.deepEqual(tables[0].columns.map(column => column.isPk), [true, true, false]);
    assert.deepEqual(tables[1].columns.map(column => column.isPk), [true, false, false, false]);
});

test('复合外键按字段对映射为子表到父表的关系，重复解析使用独立 ID', () => {
    const schema = parsePDM(xml);
    const [parent, child] = schema.tables;
    assert.equal(schema.relationships.length, 2);
    for (const [index, relation] of schema.relationships.entries()) {
        assert.equal(relation.fromTable, child.id);
        assert.equal(relation.toTable, parent.id);
        assert.equal(relation.fromCol, child.columns[index + 1].id);
        assert.equal(relation.toCol, parent.columns[index].id);
    }
    const next = parsePDM(xml);
    const ids = schema.tables.flatMap(table => [table.id, ...table.columns.map(column => column.id)])
        .concat(schema.relationships.map(relation => relation.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(next.tables.every(table => !ids.includes(table.id)));
    assert.match(generateSchemaSQL(schema), /ALTER TABLE `orders` ADD FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\)/);
});

test('按 namespace 而非固定前缀解析，Name 可作为缺少 Code 时的名称', () => {
    const renamed = xml.replaceAll('xmlns:o=', 'xmlns:obj=').replaceAll('<o:', '<obj:').replaceAll('</o:', '</obj:');
    assert.equal(parsePDM(renamed).tables.length, 2);
    assert.equal(parsePDM(xml.replace('<a:Code>users</a:Code>', '')).tables[0].name, '用户');
});

test('支持没有主键或外键的模型，忽略图形中的表引用', () => {
    const noKeys = xml.replace(/<c:PrimaryKey>[\s\S]*?<\/c:PrimaryKey>/g, '')
        .replace(/<c:References>[\s\S]*?<\/c:References>/g, '');
    const schema = parsePDM(noKeys);
    assert.equal(schema.tables.length, 2);
    assert.equal(schema.relationships.length, 0);
    assert.ok(schema.tables.every(table => table.columns.every(column => !column.isPk)));
});

test('拒绝空文件、非法 XML、错误模型、无表模型及实体声明', () => {
    assert.throws(() => parsePDM('  '), /为空/);
    assert.throws(() => parsePDM('<Model><broken></Model>'), /XML 格式错误/);
    assert.throws(() => parsePDM('<html/>'), /物理模型/);
    assert.throws(() => parsePDM('<o:Model xmlns:o="object" Id="m"/>'), /没有可导入/);
    assert.throws(() => parsePDM('<!DOCTYPE Model>' + xml), /DTD/);
});

test('拒绝损坏的主外键、缺失类型和重复标识，不静默丢失结构', () => {
    assert.throws(() => parsePDM(xml.replace('Ref="orders_pk"', 'Ref="missing"')), /主键引用无效/);
    assert.throws(() => parsePDM(xml.replace('Ref="user_id"', 'Ref="missing"')), /主键包含无效字段/);
    assert.throws(() => parsePDM(xml.replace('Ref="order_user_id"', 'Ref="missing"')), /无效的字段引用/);
    assert.throws(() => parsePDM(xml.replace('Ref="users"', 'Ref="missing"')), /关联.*不完整/);
    assert.throws(() => parsePDM(xml.replace('<a:DataType>bigint</a:DataType>', '')), /缺少数据类型/);
    assert.throws(() => parsePDM(xml.replace('<a:Length>18</a:Length>', '')), /长度或精度/);
    assert.throws(() => parsePDM(xml.replace('Id="order_id"', 'Id="user_id"')), /重复的字段标识/);
    assert.throws(() => parsePDM(xml.replace('Id="orders"', 'Id="users"')), /重复的表标识/);
});

test('读取 UTF-8、UTF-16 LE/BE 文件，接受大写扩展名', async () => {
    const utf16 = Buffer.from(xml.replace('UTF-8', 'UTF-16'), 'utf16le');
    for (const bytes of [Buffer.from(xml), Buffer.concat([Buffer.from([0xff, 0xfe]), utf16]),
        Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(utf16).swap16()]), utf16]) {
        const schema = await readPDMFile(new File([bytes], '模型.PDM'));
        assert.equal(schema.tables[0].comment, '用户 & 账号');
    }
});

test('拒绝错误扩展名、超大文件及无法读取的编码', async () => {
    await assert.rejects(readPDMFile(new File([xml], 'model.xml')), /\.pdm/);
    await assert.rejects(readPDMFile(new File([], 'model.pdm')), /为空/);
    await assert.rejects(readPDMFile({ name: 'model.pdm', size: MAX_PDM_SIZE + 1 }), /20 MB/);
    await assert.rejects(readPDMFile(new File([xml.replace('UTF-8', 'invalid-encoding')], 'model.pdm')), /编码/);
    await assert.rejects(readPDMFile(new File([new Uint8Array([0xff])], 'model.pdm')), /编码/);
});

test('按 XML 声明解码 GBK 中文', async () => {
    const bytes = Buffer.concat([
        Buffer.from('<?xml version="1.0" encoding="GBK"?><o:Model xmlns:o="object" xmlns:c="collection" xmlns:a="attribute" Id="m"><c:Tables><o:Table Id="t"><a:Code>test</a:Code><a:Name>'),
        Buffer.from('d6d0cec4', 'hex'),
        Buffer.from('</a:Name><c:Columns><o:Column Id="col"><a:Code>id</a:Code><a:DataType>int</a:DataType></o:Column></c:Columns></o:Table></c:Tables></o:Model>')
    ]);
    const schema = await readPDMFile(new File([bytes], 'gbk.pdm'));
    assert.equal(schema.tables[0].comment, '中文');
});
