import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { readSpecificationFile } from '../utils/specificationFile';
import { summarizeSpecification } from '../services/aiService';
import './ProjectPresetModal.css';

export default function ProjectPresetModal({ initialPreset, creating = false, library = false, onSave, onClose }) {
    const [name, setName] = useState(initialPreset?.name || '');
    const [rules, setRules] = useState(initialPreset?.rules || '');
    const [sourceName, setSourceName] = useState(initialPreset?.sourceName || '');
    const [document, setDocument] = useState(null);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const requestRef = useRef(null);
    const busy = Boolean(status);

    useEffect(() => () => requestRef.current?.abort(), []);

    const handleUpload = async (event) => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        setError('');
        setDocument(null);
        setStatus('reading');
        try {
            const text = await readSpecificationFile(file);
            setDocument({ name: file.name, text });
        } catch (err) {
            setError(err.message || '读取文件失败，请检查文件格式。');
        } finally {
            setStatus('');
        }
    };

    const handleSummarize = async () => {
        setError('');
        setStatus('summarizing');
        const controller = new AbortController();
        requestRef.current = controller;
        try {
            const summary = await summarizeSpecification(document.text, controller.signal);
            setRules(summary);
            setSourceName(document.name);
            setDocument({ ...document, summarized: true });
        } catch (err) {
            if (err.name !== 'AbortError') setError(err.message || '规范总结失败，请重试。');
        } finally {
            setStatus('');
        }
    };

    const handleSave = async (event) => {
        event.preventDefault();
        setError('');
        setStatus('saving');
        try {
            await onSave({
                name: name.trim(),
                preset: rules.trim() ? { rules: rules.trim(), sourceName } : null
            });
        } catch (err) {
            setError(err.message || '保存失败，请重试。');
        } finally {
            setStatus('');
        }
    };

    return createPortal(
        <div className="modal-overlay preset-overlay">
            <form className="modal-content preset-modal" role="dialog" aria-modal="true" aria-labelledby="preset-title"
                onClick={event => event.stopPropagation()} onSubmit={handleSave}>
                <div className="preset-header">
                    <div>
                        <h2 id="preset-title">{creating ? '新建数据库设计项目' : '规范预设'}</h2>
                        <p>上传设计规范，让 AI 提炼规则，再按需编辑。</p>
                    </div>
                    <button type="button" className="btn" aria-label="关闭" onClick={onClose} disabled={status === 'saving'}>×</button>
                </div>

                <div className="preset-body">
                    {(creating || library) && (
                        <label className="preset-field">
                            <span>{library ? '预设名称' : '项目名称'} <span aria-hidden="true">*</span></span>
                            <input autoFocus required maxLength={255} value={name} disabled={busy}
                                onChange={event => setName(event.target.value)} placeholder="例如：客户管理数据库" />
                        </label>
                    )}

                    <section className="preset-upload" aria-labelledby="preset-upload-title">
                        <h3 id="preset-upload-title">1. 上传规范文件（可选）</h3>
                        <p>支持 PDF、DOCX、TXT、Markdown，最大 10 MB，正文最多 60,000 字符。</p>
                        <input type="file" aria-label="上传规范文件" accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={handleUpload} />
                        {status === 'reading' && <p role="status">正在读取文件…</p>}
                        {document && <p className="preset-filename">已读取：{document.name} · {document.text.length.toLocaleString()} 字符</p>}
                        <div className="preset-upload-actions">
                            <button type="button" className="btn" disabled={busy || !document} onClick={handleSummarize}>
                                {status === 'summarizing' ? 'AI 正在总结…' : rules.trim() ? '重新总结规范（替换下方内容）' : 'AI 总结规范'}
                            </button>
                            <span>点击后将正文发送至已配置的 AI 服务。</span>
                        </div>
                    </section>

                    <label className="preset-field">
                        <span>2. 确认并编辑规范预设</span>
                        <span className="preset-help">可修改 AI 总结，也可直接输入规则。保存后，AI 设计会自动参考这些规则。</span>
                        {sourceName && <span className="preset-help">规则来源：{sourceName}</span>}
                        <textarea aria-label="规范预设内容" rows={11} value={rules} disabled={busy} maxLength={20000}
                            onChange={event => setRules(event.target.value)}
                            placeholder={'例如：\n## 命名规范\n- 表名、字段名使用小写字母与下划线。\n\n## 公共字段\n- 每张表包含创建时间和更新时间。'} />
                        <span className="preset-help">{rules.length.toLocaleString()} / 20,000 字符；留空表示不使用规范预设。</span>
                    </label>
                    {document && !document.summarized && (
                        <p className="preset-help">当前文件尚未总结；保存将使用编辑框中的内容。</p>
                    )}
                    {error && <p className="preset-error" role="alert">{error}</p>}
                </div>

                <div className="preset-footer">
                    <button type="submit" className="btn btn-primary" disabled={busy || ((creating || library) && !name.trim()) || (library && !rules.trim())}>
                        {status === 'saving' ? '保存中…' : creating ? '创建项目' : '保存预设'}
                    </button>
                </div>
            </form>
        </div>,
        window.document.body
    );
}
