import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readChatFile } from '../src/utils/chatFile.js';

test('保留不同文件的原始二进制内容及名称', async () => {
    const bytes = new Uint8Array([0, 255, 12, 128, 42]);
    for (const name of ['设计.xlsx', 'diagram.pdm', '文档.pdf']) {
        const result = await readChatFile(new File([bytes], name, { type: 'application/octet-stream' }));
        assert.equal(result.name, name);
        assert.deepEqual(Uint8Array.from(atob(result.dataUrl.split(',')[1]), c => c.charCodeAt(0)), bytes);
    }
});

test('拒绝空文件和超大文件', async () => {
    await assert.rejects(readChatFile(new File([], '空.txt')), /为空/);
    await assert.rejects(readChatFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], '大.bin')), /10 MB/);
});


test('允许 10 MB 原始文件且保留内容', async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024);
    bytes[0] = 42; bytes[bytes.length - 1] = 255;
    const result = await readChatFile(new File([bytes], 'large.bin'));
    const decoded = Uint8Array.from(atob(result.dataUrl.split(',')[1]), c => c.charCodeAt(0));
    assert.equal(decoded.length, bytes.length);
    assert.equal(decoded[0], 42);
    assert.equal(decoded.at(-1), 255);
});
