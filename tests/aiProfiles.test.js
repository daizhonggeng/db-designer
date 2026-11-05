import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activateAIProfile, validateAIProfile } from '../src/utils/aiProfiles.js';

const profile = () => ({
    id: 'one',
    name: ' 主配置 ',
    active: true,
    settings: { apiUrl: ' https://example.test/v1 ', apiKey: ' test-only ', modelText: ' text ', modelVision: ' vision ' },
});

test('保存配置前清理空白，保留配置身份和生效状态', () => {
    const draft = profile();
    const saved = validateAIProfile(draft);
    assert.equal(saved.name, '主配置');
    assert.equal(saved.settings.apiUrl, 'https://example.test/v1');
    assert.equal(saved.settings.modelText, 'text');
    assert.equal(saved.id, draft.id);
    assert.equal(saved.active, true);
    assert.equal(draft.name, ' 主配置 ');
});

test('拒绝空白名称、无效接口和缺少模型的配置', () => {
    assert.throws(() => validateAIProfile({ ...profile(), name: '  ' }), /名称/);
    for (const apiUrl of ['not-url', 'javascript:alert(1)', 'https://name@example.test/v1', 'https://example.test/v1?key=test', 'https://example.test/v1#fragment']) {
        const draft = profile();
        draft.settings.apiUrl = apiUrl;
        assert.throws(() => validateAIProfile(draft), /接口地址/);
    }
    for (const field of ['apiKey', 'modelText', 'modelVision']) {
        const draft = profile();
        draft.settings[field] = ' ';
        assert.throws(() => validateAIProfile(draft), /密钥、文字模型和图片模型/);
    }
});

test('切换生效配置只修改 active，不更改模型和密钥', () => {
    const first = validateAIProfile(profile());
    const second = { ...first, id: 'two', name: '备用', active: false, settings: { ...first.settings, modelText: 'other-model' } };
    const switched = activateAIProfile([first, second], 'two');
    assert.equal(switched.filter(item => item.active).length, 1);
    assert.equal(switched.find(item => item.active).id, 'two');
    assert.deepEqual(switched[0].settings, first.settings);
    assert.deepEqual(switched[1].settings, second.settings);
    assert.equal(first.active, true);
    assert.throws(() => activateAIProfile([first, second], 'missing'), /不存在/);
});
