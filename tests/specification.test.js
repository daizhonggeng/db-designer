import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_SPECIFICATION_SIZE, readSpecificationFile, validateSpecificationFile, validateSpecificationText } from '../src/utils/specificationFile.js';

test('拒绝不支持、空文件和超大文件', () => {
    assert.throws(() => validateSpecificationFile({ name: '规范.doc', size: 100 }), /DOCX/);
    assert.throws(() => validateSpecificationFile({ name: '规范.txt', size: 0 }), /为空/);
    assert.throws(() => validateSpecificationFile({ name: '规范.pdf', size: MAX_SPECIFICATION_SIZE + 1 }), /10 MB/);
    assert.doesNotThrow(() => validateSpecificationFile({ name: '规范.DOCX', size: MAX_SPECIFICATION_SIZE }));
});

test('拒绝无法提取正文和超长正文，不静默截断', () => {
    assert.throws(() => validateSpecificationText(' \n\0'), /OCR/);
    assert.throws(() => validateSpecificationText('文'.repeat(60001)), /60,000/);
    assert.equal(validateSpecificationText('文'.repeat(60000)).length, 60000);
});

test('读取 TXT、Markdown 并保留中文、换行和关键约束', async () => {
    for (const name of ['规范.txt', '规范.MD']) {
        const file = new File(['\ufeff## 命名规范\n必须使用 biz_ 前缀。\n金额 DECIMAL(18,2)。\0'], name);
        assert.equal(await readSpecificationFile(file), '## 命名规范\n必须使用 biz_ 前缀。\n金额 DECIMAL(18,2)。');
    }
});
