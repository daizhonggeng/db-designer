import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { apiDelete, apiGet, apiPost, apiPut } from '../services/api';
import { generateConversationReply, selectConversationContext } from '../services/aiService';
import { applySchemaOperations, fingerprintSchema } from '../utils/aiOperations';
import { projectSnapshot } from '../utils/projectData';
import { useSchema } from '../store/schemaStore';
import './AIModal.css';

export default function AIModal({ projectId, onClose }) {
    const { state, dispatch } = useSchema();
    const stateRef = useRef(state);
    stateRef.current = state;
    const controller = useRef(null);
    const fileInput = useRef(null);
    const bottom = useRef(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [images, setImages] = useState([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [error, setError] = useState('');
    const [omitted, setOmitted] = useState(0);
    const path = `/api/projects/${projectId}/ai-messages`;

    useEffect(() => {
        const abort = new AbortController();
        setLoading(true);
        apiGet(path, { signal: abort.signal }).then(data => { setMessages(data); setLoaded(true); setError(''); }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
        return () => { abort.abort(); controller.current?.abort(); };
    }, [path, loadAttempt]);
    useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

    const ask = async (history, existingController) => {
        const abort = existingController || new AbortController();
        controller.current = abort;
        setBusy(true);
        setError('');
        try {
            const snapshot = structuredClone(projectSnapshot(stateRef.current));
            const baseFingerprint = await fingerprintSchema(snapshot);
            setOmitted(selectConversationContext(history).omitted);
            const reply = await generateConversationReply({ messages: history, schema: snapshot, signal: abort.signal });
            const preview = applySchemaOperations(snapshot, reply.operations);
            const proposal = reply.operations.length ? { operations: reply.operations, changes: preview.changes } : null;
            const saved = await apiPost(path, { id: uuidv4(), role: 'assistant', text: reply.message, proposal, baseFingerprint: proposal ? baseFingerprint : null }, { signal: abort.signal });
            setMessages(previous => [...previous, saved]);
        } catch (err) {
            if (err.name !== 'AbortError') setError(`${err.message || 'AI 请求失败'}。可以重试上一条消息。`);
        } finally {
            if (!abort.signal.aborted) setBusy(false);
            if (controller.current === abort) controller.current = null;
        }
    };
    const send = async () => {
        if (busy || loading || !loaded || (!text.trim() && !images.length)) return;
        setBusy(true);
        setError('');
        const abort = new AbortController();
        controller.current = abort;
        try {
            const saved = await apiPost(path, { id: uuidv4(), role: 'user', text: text.trim(), images }, { signal: abort.signal });
            const history = [...messages, saved];
            setMessages(history);
            setText(''); setImages([]);
            await ask(history, abort);
        } catch (err) { if (err.name !== 'AbortError') { setError(err.message); setBusy(false); } }
    };
    const apply = async message => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const snapshot = projectSnapshot(stateRef.current);
            if (await fingerprintSchema(snapshot) !== message.baseFingerprint || await fingerprintSchema(projectSnapshot(stateRef.current)) !== message.baseFingerprint) throw new Error('画布或项目规范已变化，请重新描述需求以生成新方案');
            const result = applySchemaOperations(snapshot, message.proposal.operations);
            dispatch({ type: 'IMPORT_SCHEMA', payload: result.schema });
            setMessages(previous => previous.map(item => item.id === message.id ? { ...item, applied: true } : item));
            try { await apiPut(`${path}/${message.id}`, { applied: true }); }
            catch { setError('画布已更新，但方案状态保存失败；刷新后请勿重复应用此方案。'); }
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };
    const addFiles = async files => {
        const chosen = Array.from(files);
        if (images.length + chosen.length > 2) { setError('每条消息最多添加两张图片。'); return; }
        try {
            const loaded = await Promise.all(chosen.map(file => new Promise((resolve, reject) => {
                if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 3140000) { reject(new Error('图片须为 PNG、JPEG、WebP 或 GIF，单张不超过约 3 MB。')); return; }
                const reader = new FileReader();
                reader.onload = () => resolve({ name: (file.name || '粘贴的图片').slice(0, 255), dataUrl: reader.result });
                reader.onerror = () => reject(new Error('读取图片失败'));
                reader.readAsDataURL(file);
            })));
            setImages(previous => [...previous, ...loaded]); setError('');
        } catch (err) { setError(err.message); }
    };
    const clear = async () => {
        if (!window.confirm('新建对话将清除当前账号在此项目中的对话记录，继续吗？')) return;
        try { await apiDelete(path); setMessages([]); setOmitted(0); setError(''); }
        catch (err) { setError(err.message); }
    };
    return <aside className="ai-chat" aria-label="AI 助手">
        <header className="ai-chat-header"><div><strong>AI 助手</strong><small>结合当前设计持续对话</small></div><button className="btn" onClick={clear} disabled={busy || loading || !loaded}>新建对话</button><button className="btn" aria-label="关闭 AI 助手" onClick={onClose}>×</button></header>
        <div className="ai-chat-notice">发送时会将当前设计、项目规范和所选对话及图片发送给当前 AI 服务；对话按项目和账号保存。</div>
        <div className="ai-chat-history" aria-live="polite">
            {loading && <p>正在加载对话…</p>}
            {!loading && !messages.length && <p className="ai-chat-empty">描述想要的修改，也可以添加或粘贴图片。AI 会先给出方案，确认后应用。</p>}
            {messages.map(message => <article key={message.id} className={`ai-chat-message ${message.role}`}><strong>{message.role === 'user' ? '你' : 'AI 助手'}</strong><div className="ai-chat-text">{message.text}</div>{message.images?.length > 0 && <div className="ai-chat-images">{message.images.map((image, index) => <img key={index} src={image.dataUrl} alt={image.name} />)}</div>}{message.proposal && <div className="ai-chat-proposal"><strong>建议修改</strong><ul>{(message.proposal.changes || []).map((change, index) => <li key={index}>{change}</li>)}</ul><button className="btn btn-primary" disabled={busy || message.applied} onClick={() => apply(message)}>{message.applied ? '已应用' : '应用修改'}</button><small>应用后可使用画布撤销。</small></div>}</article>)}
            {busy && <p>AI 正在处理…</p>}{omitted > 0 && <p>本次请求因上下文长度省略了较早的 {omitted} 条消息。</p>}<div ref={bottom} />
        </div>
        {error && <div className="ai-chat-error" role="alert">{error}{!loaded && <button className="btn" onClick={() => setLoadAttempt(value => value + 1)}>重新加载</button>}{messages.at(-1)?.role === 'user' && !busy && <button className="btn" onClick={() => ask(messages)}>重试</button>}</div>}
        <div className="ai-chat-compose" onPaste={event => { const files = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/')); if (files.length) { event.preventDefault(); addFiles(files); } }}>
            {images.length > 0 && <div className="ai-chat-images">{images.map((image, index) => <div key={index}><img src={image.dataUrl} alt={image.name} /><button aria-label={`移除${image.name}`} onClick={() => setImages(previous => previous.filter((_, i) => i !== index))}>×</button></div>)}</div>}
            <textarea className="ui-textarea" value={text} maxLength={20000} onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} placeholder="描述需求，Enter 发送，Shift+Enter 换行" />
            <div className="ai-chat-actions"><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={event => { addFiles(event.target.files); event.target.value = ''; }} /><button className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>添加图片</button><button className="btn btn-primary" disabled={busy || loading || !loaded || (!text.trim() && !images.length)} onClick={send}>发送</button></div>
        </div>
    </aside>;
}
