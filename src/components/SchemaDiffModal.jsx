import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiGet } from '../services/api';
import { diffSchemas, formatDiffAsText } from '../utils/schema';

export default function SchemaDiffModal({ projectId, schema, onClose }) {
    const [baselineSchema, setBaselineSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function loadBaseline() {
            try {
                setLoading(true);
                setError('');
                const project = await apiGet(`/api/projects/${projectId}`);

                if (!cancelled) {
                    setBaselineSchema(project?.schema_data || {});
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError.message || '加载已保存版本失败');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadBaseline();
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    const diffResult = useMemo(() => {
        if (!baselineSchema) {
            return null;
        }

        return diffSchemas(baselineSchema, schema);
    }, [baselineSchema, schema]);

    const handleCopySummary = async () => {
        if (!diffResult) {
            return;
        }

        await navigator.clipboard.writeText(formatDiffAsText(diffResult));
        alert('差异摘要已复制到剪贴板');
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content glass"
                onClick={(event) => event.stopPropagation()}
                style={{ width: '860px', maxWidth: '94vw', maxHeight: '84vh', display: 'flex', flexDirection: 'column', borderRadius: '24px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <div className="project-badge" style={{ marginBottom: '0.45rem', color: 'var(--accent-secondary)' }}>Version Intelligence</div>
                        <h2 className="panel-heading" style={{ margin: 0, color: 'var(--text-primary)' }}>与已保存版本对比</h2>
                        <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            对比当前画布与服务器上最近一次保存的项目结构
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!loading && !error && diffResult && (
                            <button className="btn" onClick={handleCopySummary}>复制摘要</button>
                        )}
                        <button className="btn" onClick={onClose}>&times;</button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        正在加载基线版本...
                    </div>
                ) : error ? (
                    <div style={{
                        padding: '1rem 1.25rem',
                        borderRadius: '18px',
                        color: '#f87171',
                        background: 'rgba(248, 113, 113, 0.12)',
                        border: '1px solid rgba(248, 113, 113, 0.22)'
                    }}>
                        {error}
                    </div>
                ) : diffResult && (
                    <>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                            gap: '12px',
                            marginBottom: '1rem'
                        }}>
                            {[
                                { label: '总变更', value: diffResult.summary.totalChanges, color: 'var(--accent-primary)' },
                                { label: '表', value: diffResult.summary.tableAdded + diffResult.summary.tableRemoved + diffResult.summary.tableUpdated, color: '#60a5fa' },
                                { label: '字段', value: diffResult.summary.columnAdded + diffResult.summary.columnRemoved + diffResult.summary.columnUpdated, color: '#4ade80' },
                                { label: '索引', value: diffResult.summary.indexAdded + diffResult.summary.indexRemoved + diffResult.summary.indexUpdated, color: '#fbbf24' },
                                { label: '约束', value: diffResult.summary.constraintAdded + diffResult.summary.constraintRemoved + diffResult.summary.constraintUpdated, color: '#f472b6' },
                            ].map((item) => (
                                <div key={item.label} style={{
                                    padding: '14px',
                                    borderRadius: '18px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'rgba(255,255,255,0.04)'
                                }}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.label}</div>
                                    <div style={{ marginTop: '6px', fontSize: '1.4rem', fontWeight: '800', color: item.color }}>
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {diffResult.changes.length === 0 ? (
                                <div style={{
                                    padding: '2rem',
                                    textAlign: 'center',
                                    color: '#4ade80',
                                    borderRadius: '18px',
                                    background: 'rgba(74, 222, 128, 0.12)',
                                    border: '1px solid rgba(74, 222, 128, 0.22)'
                                }}>
                                    当前画布与已保存版本没有结构差异。
                                </div>
                            ) : (
                                diffResult.changes.map((change) => (
                                    <div key={change.id} style={{
                                        padding: '12px 14px',
                                        borderRadius: '18px',
                                        border: '1px solid var(--glass-border)',
                                        background: 'rgba(255,255,255,0.04)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                                            <strong style={{ color: 'var(--accent-primary)' }}>
                                                {change.category}.{change.action}
                                            </strong>
                                        </div>
                                        <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                            {change.message}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
