import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/aiService.js', import.meta.url), 'utf8');
const testConfig = { VITE_AI_API_KEY: 'test-only-key', VITE_AI_API_URL: 'https://example.test/v1' };
const { generateSchema, summarizeSpecification } = await import(`data:text/javascript,${encodeURIComponent(source.replace('import.meta.env', JSON.stringify(testConfig)))}`);

test('总结使用配置的文字接口并保留规范正文', async (t) => {
    const controller = new AbortController();
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        assert.equal(_url, 'https://example.test/v1/chat/completions');
        const body = JSON.parse(options.body);
        assert.equal(body.stream, false);
        assert.match(body.messages[0].content, /不添加惯例或虚构要求/);
        assert.match(body.messages[1].content, /金额必须使用 DECIMAL\(18,2\)/);
        assert.equal(options.signal, controller.signal);
        return Response.json({ choices: [{ message: { content: ' ## 字段\n- 金额必须使用 DECIMAL(18,2)。 ' }, finish_reason: 'stop' }] });
    });
    assert.equal(await summarizeSpecification('金额必须使用 DECIMAL(18,2)', controller.signal), '## 字段\n- 金额必须使用 DECIMAL(18,2)。');
});

test('未配置凭据时不发送总结或设计请求', async (t) => {
    const unconfigured = await import(`data:text/javascript,${encodeURIComponent(source.replace('import.meta.env', '{}'))}`);
    const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('不应请求'); });
    await assert.rejects(unconfigured.generateSchema('客户管理'), /VITE_AI_API_KEY/);
    await assert.rejects(unconfigured.summarizeSpecification('命名规范'), /VITE_AI_API_KEY/);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('无效正文不会发送请求', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('不应请求'); });
    await assert.rejects(summarizeSpecification(' \n'), /为空/);
    await assert.rejects(summarizeSpecification('文'.repeat(60001)), /60,000/);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('总结失败、空结果或截断时显示错误，不保存不完整结果', async (t) => {
    const cases = [
        [Response.json({ error: { message: '额度不足' } }, { status: 429 }), /额度不足/],
        [new Response('Bad gateway', { status: 502 }), /502/],
        [Response.json({ choices: [{ message: { content: '' } }] }), /未返回/],
        [Response.json({ choices: [{ message: { content: '部分规则' }, finish_reason: 'length' }] }), /截断/],
        [Response.json({ choices: [{ message: { content: '文'.repeat(20001) } }] }), /20,000/]
    ];
    const fetchMock = t.mock.method(globalThis, 'fetch');
    for (const [response, expected] of cases) {
        fetchMock.mock.mockImplementation(async () => response);
        await assert.rejects(summarizeSpecification('规范正文'), expected);
    }
});

test('取消总结传递给请求', async (t) => {
    const controller = new AbortController();
    controller.abort();
    t.mock.method(globalThis, 'fetch', async (_url, options) => options.signal.throwIfAborted());
    await assert.rejects(summarizeSpecification('规范正文', controller.signal), { name: 'AbortError' });
});

test('文字和图片设计均使用最终编辑后的项目规则，空预设兼容旧项目', async (t) => {
    let requestBody;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
        requestBody = JSON.parse(options.body);
        const event = { choices: [{ delta: { content: '```json\n{"tables":[],"relationships":[]}\n```' } }] };
        return new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`);
    });

    const preset = { rules: '表名前缀必须为 crm_；禁止物理外键。' };
    for (const image of [null, 'data:image/png;base64,test']) {
        const result = await generateSchema('客户管理', image, preset);
        assert.deepEqual(result.schema, { tables: [], relationships: [] });
        assert.match(requestBody.messages[0].content, /表名前缀必须为 crm_；禁止物理外键/);
        assert.equal(Array.isArray(requestBody.messages[1].content), Boolean(image));
    }
    await generateSchema('旧项目');
    assert.doesNotMatch(requestBody.messages[0].content, /<design_rules>/);
});

test('AI 设计正确拼接跨网络分块的 JSON 和中文字符', async (t) => {
    const schema = { tables: [{ id: 'customer', name: 'crm_customer', comment: '客户' }], relationships: [] };
    const event = { choices: [{ delta: { content: '```json\n' + JSON.stringify(schema) + '\n```' } }] };
    const bytes = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\ndata: [DONE]`);
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
        start(controller) {
            for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
            controller.close();
        }
    })));
    assert.deepEqual((await generateSchema('客户管理', null, { rules: '使用 crm_ 前缀' })).schema, schema);
});

test('浏览器保存的配置立即用于规范总结和设计请求', async (t) => {
    let stored = '';
    globalThis.localStorage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
    t.after(() => { delete globalThis.localStorage; });
    const { saveAISettings } = await import(`data:text/javascript,${encodeURIComponent(source.replace('import.meta.env', JSON.stringify(testConfig)))}`);
    saveAISettings({ apiKey: 'local-key', apiUrl: 'https://local.test/v1', modelText: 'text-model', modelVision: 'vision-model' });
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, options, body: JSON.parse(options.body) });
        if (!JSON.parse(options.body).stream) return Response.json({ choices: [{ message: { content: '规则' } }] });
        return new Response('data: {"choices":[{"delta":{"content":"{\\"tables\\":[],\\"relationships\\":[]}"}}]}\n\n');
    });
    await summarizeSpecification('规范');
    await generateSchema('设计', 'data:image/png;base64,test');
    assert.equal(calls[0].url, 'https://local.test/v1/chat/completions');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer local-key');
    assert.equal(calls[0].body.model, 'text-model');
    assert.equal(calls[1].body.model, 'vision-model');
});
