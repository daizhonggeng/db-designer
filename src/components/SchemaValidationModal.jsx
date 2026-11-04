import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { validateSchema } from '../utils/schema';

const LEVEL_META = {
    error: { label: '错误', color: '#f87171', background: 'rgba(248, 113, 113, 0.12)' },
    warning: { label: '警告', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)' },
    info: { label: '提示', color: '#60a5fa', background: 'rgba(96, 165, 250, 0.12)' },
};

export default function SchemaValidationModal({ schema, onClose }) {
    const validation = useMemo(() => validateSchema(schema), [schema]);
    const { summary, issues } = validation;

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content glass"
                onClick={(event) => event.stopPropagation()}
                style={{ width: '760px', maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', borderRadius: '24px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <div className="project-badge" style={{ marginBottom: '0.45rem', color: 'var(--accent-primary)' }}>Quality Report</div>
                        <h2 className="panel-heading" style={{ margin: 0, color: 'var(--text-primary)' }}>Schema 体检</h2>
                        <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            保存前检查表结构、关系、索引与约束的一致性
                        </div>
                    </div>
                    <button className="btn" onClick={onClose}>&times;</button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '12px',
                    marginBottom: '1rem'
                }}>
                    {[
                        { label: '表', value: summary.tableCount, color: 'var(--accent-primary)' },
                        { label: '关系', value: summary.relationshipCount, color: 'var(--accent-secondary)' },
                        { label: '错误', value: summary.errorCount, color: '#f87171' },
                        { label: '警告', value: summary.warningCount, color: '#fbbf24' },
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

                <div style={{
                    padding: '12px 14px',
                    borderRadius: '18px',
                    marginBottom: '1rem',
                    color: summary.isValid ? '#4ade80' : '#fbbf24',
                    background: summary.isValid ? 'rgba(74, 222, 128, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                    border: `1px solid ${summary.isValid ? 'rgba(74, 222, 128, 0.25)' : 'rgba(251, 191, 36, 0.25)'}`
                }}>
                    {summary.isValid
                        ? '当前 schema 没有阻止保存的结构错误。'
                        : '发现结构错误，建议修复后再保存。'}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {issues.length === 0 ? (
                        <div style={{
                            padding: '2rem',
                            textAlign: 'center',
                            color: 'var(--text-secondary)',
                            border: '1px dashed var(--glass-border)',
                            borderRadius: '18px'
                        }}>
                            当前没有发现问题。
                        </div>
                    ) : (
                        issues.map((issue) => {
                            const levelMeta = LEVEL_META[issue.level] || LEVEL_META.info;
                            return (
                                <div key={issue.id} style={{
                                    padding: '12px 14px',
                                    borderRadius: '18px',
                                    border: '1px solid var(--glass-border)',
                                    background: levelMeta.background
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                                        <strong style={{ color: levelMeta.color }}>{levelMeta.label}</strong>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{issue.code}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                        {issue.message}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
