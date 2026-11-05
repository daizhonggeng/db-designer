import React, { useEffect, useRef, useState } from 'react';
import { testAISettings } from '../services/aiService';
import Icon from './Icon';

export default function AISettingsModal({ profile, isNew, onSave, onClose }) {
    const [name, setName] = useState(profile.name);
    const [settings, setSettings] = useState(() => ({ ...profile.settings }));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState('');
    const controllerRef = useRef(null);
    useEffect(() => () => { controllerRef.current?.abort(); controllerRef.current = null; }, []);

    const update = (field, value) => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setTesting('');
        setTestResult(null);
        setError('');
        setSettings(current => ({ ...current, [field]: value }));
    };
    const test = async kind => {
        const controller = new AbortController();
        controllerRef.current = controller;
        setTesting(kind);
        setTestResult(null);
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            await testAISettings(settings, kind, controller.signal);
            setTestResult({ ok: true, message: `${kind === 'vision' ? '图片' : '文字'}模型测试成功。` });
        } catch (failure) {
            if (controller.signal.aborted && controllerRef.current !== controller) return;
            setTestResult({ ok: false, message: controller.signal.aborted ? '测试超时，请检查网络或服务地址。' : `测试失败：${failure instanceof TypeError ? '无法连接，请检查网络、接口地址及服务端跨域设置。' : failure.message}` });
        } finally {
            clearTimeout(timer);
            if (controllerRef.current === controller) { controllerRef.current = null; setTesting(''); }
        }
    };
    const save = async event => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            await onSave({ ...profile, name, settings });
        } catch (failure) {
            setError(failure.message || '保存失败，请重试');
        } finally {
            setSaving(false);
        }
    };

    return <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
        <form className="modal-content ai-settings-form" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" onClick={event => event.stopPropagation()} onSubmit={save}>
            <div className="modal-heading"><div><h2 id="ai-settings-title">{isNew ? '新增 AI 配置' : '编辑 AI 配置'}</h2><p>填写兼容 OpenAI 的接口和模型，保存后返回配置列表。</p></div><button type="button" className="icon-button" aria-label="关闭" disabled={saving} onClick={onClose}><Icon name="close" /></button></div>
            <label className="form-label">配置名称<input className="ui-input" aria-label="配置名称" autoFocus required maxLength={255} value={name} onChange={event => setName(event.target.value)} placeholder="例如：日常设计、图片识别" disabled={saving} /></label>
            <label className="form-label">接口地址<input className="ui-input" aria-label="接口地址" type="url" required maxLength={4096} value={settings.apiUrl} onChange={event => update('apiUrl', event.target.value)} placeholder="https://api.openai.com/v1" disabled={saving} /></label>
            <label className="form-label">API 密钥<input className="ui-input" aria-label="API 密钥" type="password" required autoComplete="off" maxLength={4096} value={settings.apiKey} onChange={event => update('apiKey', event.target.value)} disabled={saving} /></label>
            <div className="ai-settings-models"><label className="form-label">文字模型<input className="ui-input" aria-label="文字模型" required maxLength={4096} value={settings.modelText} onChange={event => update('modelText', event.target.value)} disabled={saving} /></label><label className="form-label">图片模型<input className="ui-input" aria-label="图片模型" required maxLength={4096} value={settings.modelVision} onChange={event => update('modelVision', event.target.value)} disabled={saving} /></label></div>
            <p className="ai-settings-note">配置保存在当前账号，密钥加密保存。{isNew && profile.active ? '这是第一项配置，保存后会自动生效。' : '保存后可在列表中单选生效配置。'}</p>
            <div className="session-actions"><button className="btn" type="button" disabled={!!testing || saving} onClick={() => test('text')}>{testing === 'text' ? '测试中…' : '测试文字模型'}</button><button className="btn" type="button" disabled={!!testing || saving} onClick={() => test('vision')}>{testing === 'vision' ? '测试中…' : '测试图片模型'}</button></div>
            <p className="ai-settings-note">连接测试会向服务发送简短请求，可能产生费用。</p>
            {testResult && <p role="status" className={testResult.ok ? 'ai-profiles-notice' : 'inline-error'}>{testResult.message}</p>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <div className="modal-footer"><button type="button" className="btn" disabled={saving} onClick={onClose}>取消</button><button className="btn btn-primary" type="submit" disabled={saving || !!testing}>{saving ? '保存中…' : '保存配置'}</button></div>
        </form>
    </div>;
}
