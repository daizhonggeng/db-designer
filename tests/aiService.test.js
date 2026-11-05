import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const configuredProfiles = [{ id: 'default', name: '账号配置', active: true, settings: { apiKey: 'test-only-key', apiUrl: 'https://example.test/v1', modelText: 'text-model', modelVision: 'vision-model' } }];
const source = readFileSync(new URL('../src/services/aiService.js', import.meta.url), 'utf8').replace("import { apiGet, apiPut } from './api';", `const apiGet = async () => globalThis.testAIProfiles === undefined ? ${JSON.stringify(configuredProfiles)} : globalThis.testAIProfiles; const apiPut = async (_path, data) => { globalThis.testAIProfiles = data; };`);
const { generateSchema, summarizeSpecification } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('未保存账号配置时显示空列表，不读取浏览器旧配置', async (t) => {
    globalThis.testAIProfiles = null;
    let localReads = 0;
    globalThis.localStorage = { getItem: () => { localReads += 1; throw new Error('不应读取旧配置'); } };
    t.after(() => { delete globalThis.testAIProfiles; delete globalThis.localStorage; });
    const service = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    assert.deepEqual(await service.getAIProfiles(), []);
    await assert.rejects(service.getAISettings(), /新增并启用/);
    assert.equal(localReads, 0);
});

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
    globalThis.testAIProfiles = [];
    t.after(() => { delete globalThis.testAIProfiles; });
    const unconfigured = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('不应请求'); });
    await assert.rejects(unconfigured.generateSchema('客户管理'), /新增并启用/);
    await assert.rejects(unconfigured.summarizeSpecification('命名规范'), /新增并启用/);
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

test('设计说明来自结构化输出，并兼容旧格式及缺少说明的响应', async (t) => {
    const mock = t.mock.method(globalThis, 'fetch');
    for (const [content, expected] of [
        ['```json\n{"design_summary":"按客户和订单建表。","tables":[],"relationships":[]}\n```', '按客户和订单建表。'],
        ['客户与订单是一对多关系。\n```json\n{"tables":[],"relationships":[]}\n```', '客户与订单是一对多关系。'],
        ['{"tables":[],"relationships":[]}', '模型未提供设计说明。']
    ]) {
        const event = { choices: [{ delta: { content } }] };
        mock.mock.mockImplementation(async () => new Response(`data: ${JSON.stringify(event)}\n\n`));
        const result = await generateSchema('客户订单');
        assert.equal(result.reasoning, expected);
        assert.deepEqual(result.schema, { tables: [], relationships: [] });
    }
});

test('账号保存的配置立即用于规范总结和设计请求', async (t) => {
    globalThis.testAIProfiles = [{ id: 'one', name: '测试', active: true, settings: { apiKey: 'local-key', apiUrl: 'https://local.test/v1', modelText: 'text-model', modelVision: 'vision-model' } }];
    t.after(() => { delete globalThis.testAIProfiles; });
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

test('账号配置只能单选生效，不读取浏览器旧配置', async (t) => {
    let localReads = 0;
    globalThis.localStorage = { getItem: () => { localReads += 1; return 'legacy'; } };
    t.after(() => { delete globalThis.localStorage; delete globalThis.testAIProfiles; });
    const service = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    const original = (await service.getAIProfiles())[0];
    const next = { id: 'second', name: '第二个', active: true, settings: { ...original.settings, modelText: 'new' } };
    await service.saveAIProfiles([{ ...original, active: false }, next]);
    assert.equal((await service.getAISettings()).modelText, 'new');
    assert.equal((await service.getAIProfiles()).length, 2);
    await assert.rejects(service.saveAIProfiles([{ ...original, active: false }]), /只能选择一个/);
    await assert.rejects(service.saveAIProfiles([original, next]), /只能选择一个/);
    assert.equal(localReads, 0);
});

test('测试配置使用当前填写的文字和图片模型并检查响应', async (t) => {
    const { testAISettings } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
    const settings = { apiUrl: 'https://example.test/v1', apiKey: 'unsaved-key', modelText: 'text-model', modelVision: 'vision-model' };
    const requests = [];
    const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({ url, options, body: JSON.parse(options.body) });
        return Response.json({ choices: [{ message: { content: '成功' } }] });
    });
    await testAISettings(settings, 'text');
    await testAISettings(settings, 'vision');
    assert.equal(requests[0].url, 'https://example.test/v1/chat/completions');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer unsaved-key');
    assert.equal(requests[0].body.model, 'text-model');
    assert.equal(requests[1].body.model, 'vision-model');
    assert.equal(requests[1].body.messages[0].content[1].type, 'image_url');
    mock.mock.mockImplementation(async () => Response.json({ error: { message: '密钥无效' } }, { status: 401 }));
    await assert.rejects(testAISettings(settings, 'text'), /密钥无效/);
    mock.mock.mockImplementation(async () => Response.json({ choices: [] }));
    await assert.rejects(testAISettings(settings, 'text'), /未返回有效内容/);
    await assert.rejects(testAISettings({ ...settings, apiUrl: 'javascript:alert(1)' }, 'text'), /接口地址/);
});
