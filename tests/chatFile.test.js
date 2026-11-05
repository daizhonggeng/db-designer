import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readChatFile } from '../src/utils/chatFile.js';

test('读取 SQL、JSON、CSV 和文字文件并保留文件名和正文', async () => {
    for (const name of ['schema.sql', 'config.json', 'tables.CSV', '说明.md']) {
        assert.deepEqual(await readChatFile(new File(['字段中文\nvalue'], name)), { name, text: '字段中文\nvalue' });
    }
});

test('拒绝不支持、空文件和超过限制的正文', async () => {
    await assert.rejects(readChatFile(new File(['x'], '未知.exe')), /不支持/);
    await assert.rejects(readChatFile(new File([], '空.txt')), /为空/);
    await assert.rejects(readChatFile(new File(['x'.repeat(60001)], '长.sql')), /60,000/);
});

test('PDM 文件解析为可供对话参考的结构', async () => {
    const { readFileSync } = await import('node:fs');
    const { DOMParser } = await import('@xmldom/xmldom');
    globalThis.DOMParser = class extends DOMParser { constructor() { super({ onError: () => { throw new Error('Invalid XML'); } }); } };
    try {
        const xml = readFileSync(new URL('./fixtures/example.pdm', import.meta.url));
        const attachment = await readChatFile(new File([xml], '模型.pdm'));
        const schema = JSON.parse(attachment.text);
        assert.deepEqual(schema.tables.map(table => table.name), ['users', 'orders']);
        assert.equal(schema.relationships.length, 2);
    } finally { delete globalThis.DOMParser; }
});
