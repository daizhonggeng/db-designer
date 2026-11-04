import React, { useEffect, useRef, useState } from 'react';
import { getAISettings, saveAISettings, testAISettings } from '../services/aiService';
import Icon from './Icon';

export default function AISettingsModal({ onClose }) {
    const [settings, setSettings] = useState(getAISettings);
    const [error, setError] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState('');
    const controllerRef = useRef(null);
    useEffect(() => () => controllerRef.current?.abort(), []);
    const update = (field, value) => {
        controllerRef.current?.abort();
        controllerRef.current = null;
        setTesting('');
        setTestResult(null);
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
        } catch (err) {
            if (controller.signal.aborted && controllerRef.current !== controller) return;
            setTestResult({ ok: false, message: controller.signal.aborted ? '测试超时，请检查网络或服务地址。' : `测试失败：${err instanceof TypeError ? '无法连接，请检查网络、接口地址及服务端跨域设置。' : err.message}` });
        } finally {
            clearTimeout(timer);
            if (controllerRef.current === controller) { controllerRef.current = null; setTesting(''); }
        }
    };
    const save = event => {
        event.preventDefault();
        try {
            const url = new URL(settings.apiUrl.trim());
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
            if (!settings.apiKey.trim() || !settings.modelText.trim() || !settings.modelVision.trim()) {
                setError('请填写密钥和模型名称。');
                return;
            }
            saveAISettings(Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value.trim()])));
            onClose();
        } catch {
            setError('请输入有效的 HTTP(S) 接口地址，并确认浏览器允许本地存储。');
        }
    };
    return <div className="modal-overlay" onClick={onClose}>
        <form className="modal-content" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto' }} onClick={event => event.stopPropagation()} onSubmit={save}>
            <div className="modal-heading"><div><h2>AI 配置</h2><p>配置兼容 OpenAI 的聊天补全接口。</p></div><button type="button" className="icon-button" aria-label="关闭" onClick={onClose}><Icon name="close" /></button></div>
            <label className="form-label">接口地址<input className="ui-input" type="url" required value={settings.apiUrl} onChange={event => update('apiUrl', event.target.value)} placeholder="https://api.openai.com/v1" /></label>
            <label className="form-label">API 密钥<input className="ui-input" type="password" required autoComplete="off" value={settings.apiKey} onChange={event => update('apiKey', event.target.value)} /></label>
            <label className="form-label">文字模型<input className="ui-input" required value={settings.modelText} onChange={event => update('modelText', event.target.value)} /></label>
            <label className="form-label">图片模型<input className="ui-input" required value={settings.modelVision} onChange={event => update('modelVision', event.target.value)} /></label>
            <p>配置保存在当前浏览器中，密钥可被此浏览器访问；AI 请求直接发送到配置的服务。请只在可信设备使用。</p>
            <div className="session-actions"><button className="btn" type="button" disabled={!!testing} onClick={() => test('text')}>{testing === 'text' ? '测试中…' : '测试文字模型'}</button><button className="btn" type="button" disabled={!!testing} onClick={() => test('vision')}>{testing === 'vision' ? '测试中…' : '测试图片模型'}</button></div>
            <p>测试会向服务发送简短请求，可能产生费用；图片测试会发送一张小图片。</p>
            {testResult && <p role="status" className={testResult.ok ? '' : 'inline-error'}>{testResult.message}</p>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <div className="modal-footer"><button type="button" className="btn" onClick={onClose}>取消</button><button className="btn btn-primary" type="submit">保存配置</button></div>
        </form>
    </div>;
}
