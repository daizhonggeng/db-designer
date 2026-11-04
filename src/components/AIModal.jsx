import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { generateSchema } from '../services/aiService';
import { useSchema } from '../store/schemaStore';

export default function AIModal({ onClose }) {
    const { state, dispatch } = useSchema();
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const fileInputRef = useRef(null);

    const handleGenerate = async () => {
        if (!description.trim() && !image) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const data = await generateSchema(description, image, state.designPreset);
            setResult(data);
        } catch (err) {
            setError(err.message || '生成失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (result?.schema) {
            dispatch({ type: 'APPEND_SCHEMA', payload: result.schema });
            onClose();
        }
    };

    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handlePaste = (event) => {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i += 1) {
            if (items[i].type.includes('image')) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onloadend = () => setImage(reader.result);
                reader.readAsDataURL(blob);
            }
        }
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999, padding: '1rem' }} onClick={onClose}>
            <div className="modal-content glass ai-modal-shell ai-modal-industrial" onClick={(event) => event.stopPropagation()} onPaste={handlePaste}>
                <div className="ai-modal-header">
                    <div>
                        <span className="ui-kicker">AI Assistant</span>
                        <h2 className="panel-heading" style={{ margin: '0.65rem 0 0.35rem', fontSize: '1.36rem' }}>AI 自动设计</h2>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                            输入需求或附带参考图，让模型生成一版可直接追加到画布的结构草案。
                        </p>
                    </div>
                    <button className="btn" onClick={onClose}>&times;</button>
                </div>

                {!result ? (
                    <div className="ai-modal-grid ai-modal-grid-industrial">
                        <section className="ui-card ai-panel-industrial">
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="ui-kicker">Brief</span>
                                <h3 className="panel-heading" style={{ margin: 0, fontSize: '1.02rem' }}>需求说明</h3>
                            </div>
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="例如：设计一个支持租户、角色权限、订单、退款和审计日志的业务数据库..."
                                className="ui-textarea"
                                style={{ minHeight: '280px' }}
                            />
                            {state.designPreset?.rules && (
                                <details style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <summary>已启用项目规范预设（点击查看）</summary>
                                    <div style={{ whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto', paddingTop: '8px' }}>{state.designPreset.rules}</div>
                                </details>
                            )}
                            <div className="ai-prompt-hints">
                                <span className="project-badge">实体越明确越好</span>
                                <span className="project-badge">关系尽量写清楚</span>
                            </div>
                        </section>

                        <section className="ui-card ai-panel-industrial">
                            <div style={{ display: 'grid', gap: '0.45rem' }}>
                                <span className="ui-kicker">Reference Image</span>
                                <h3 className="panel-heading" style={{ margin: 0, fontSize: '1.02rem' }}>图片输入</h3>
                            </div>
                            <div className="ai-dropzone ai-dropzone-industrial" onClick={() => fileInputRef.current?.click()}>
                                {image ? (
                                    <>
                                        <img src={image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        <div className="ai-dropzone-caption">点击更换图片，或直接 Ctrl+V 粘贴</div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', display: 'grid', gap: '0.65rem' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>上传参考图</strong>
                                        <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            支持 ER 图、旧系统截图或草图
                                        </span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                            </div>
                            <div className="ui-card" style={{ padding: '0.9rem', borderRadius: '16px' }}>
                                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.84rem' }}>
                                    可只用文本，也可把图片和文本一起交给模型，生成结果后仍然能继续手工调整。
                                </div>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="ai-result-layout ai-result-layout-industrial">
                        <section className="ui-card ai-panel-industrial">
                            <span className="ui-kicker">Output</span>
                            <h3 className="panel-heading" style={{ margin: '0.7rem 0 0.4rem', fontSize: '1.02rem' }}>结构草案已生成</h3>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                                可以直接追加到当前画布，也可以先阅读设计说明再决定是否应用。
                            </p>
                        </section>

                        <section className="ui-card ai-panel-industrial">
                            <div style={{ marginBottom: '0.75rem' }}>
                                <span className="ui-kicker">Design notes</span>
                                <h3 className="panel-heading" style={{ margin: '0.6rem 0 0', fontSize: '1.02rem' }}>设计说明</h3>
                            </div>
                            <div className="ai-reasoning-box ai-reasoning-box-industrial">
                                {result.reasoning}
                            </div>
                        </section>
                    </div>
                )}

                {error && (
                    <div className="auth-error-box" style={{ marginBottom: 0 }}>
                        {error}
                    </div>
                )}

                <div className="ai-modal-footer">
                    <button className="btn" onClick={onClose} disabled={loading}>取消</button>
                    {!result ? (
                        <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || (!description.trim() && !image)} style={{ minWidth: '120px' }}>
                            {loading ? '生成中...' : '开始生成'}
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={handleApply} style={{ minWidth: '120px' }}>
                            应用设计
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
