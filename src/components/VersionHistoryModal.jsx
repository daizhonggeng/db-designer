import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { apiGet, apiPut } from '../services/api';

export default function VersionHistoryModal({ projectId, onClose, onRestore }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Editing state
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    const fetchVersions = useCallback(async () => {
        try {
            const data = await apiGet(`/api/projects/${projectId}/versions`);
            setVersions(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const handleRestore = async (versionId) => {
        if (!confirm('确定要回退到此版本吗？当前未保存的修改将丢失。')) return;
        try {
            const data = await apiGet(`/api/versions/${versionId}`);

            if (!data.schema) {
                throw new Error('版本数据为空');
            }

            onRestore(data.schema);
            onClose();
        } catch (err) {
            console.error('Restore error:', err);
            alert('回退失败: ' + err.message);
        }
    };

    const startEditing = (v) => {
        setEditingId(v.id);
        setEditValue(v.description || '');
    };

    const saveDescription = async (versionId) => {
        try {
            await apiPut(`/api/versions/${versionId}`, { description: editValue });
            setVersions(versions.map(v => v.id === versionId ? { ...v, description: editValue } : v));
            setEditingId(null);
        } catch {
            alert('更新备注失败');
        }
    };

    const formatTime = (str) => {
        return str;
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ width: '700px', maxWidth: '94vw', maxHeight: '84vh', display: 'flex', flexDirection: 'column', borderRadius: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                        <span className="ui-kicker">Version Ledger</span>
                        <div>
                            <h3 className="panel-heading" style={{ margin: 0 }}>版本历史</h3>
                            <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)' }}>
                                浏览每次保存快照，也可以给关键版本补上说明后再回退。
                            </p>
                        </div>
                    </div>
                    <button className="btn" onClick={onClose}>&times;</button>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span className="project-badge">{versions.length} 个版本</span>
                    <span className="project-badge">Project #{projectId}</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px' }}>
                    {loading ? <p style={{ color: 'var(--text-secondary)' }}>加载中...</p> : (
                        versions.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>暂无历史版本</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {versions.map(v => (
                                    <div key={v.id} style={{
                                        padding: '14px',
                                        background: 'rgba(255,255,255,0.04)',
                                        borderRadius: '18px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: '1rem',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        <div style={{ flex: 1, marginRight: '10px' }}>
                                            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                {formatTime(v.created_at)}
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    background: 'rgba(255,255,255,0.08)',
                                                    padding: '0.24rem 0.58rem',
                                                    borderRadius: '999px',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {v.created_by || 'Unknown'}
                                                </span>
                                            </div>

                                            {editingId === v.id ? (
                                                <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
                                                    <input
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        className="ui-input"
                                                        style={{ flex: 1 }}
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveDescription(v.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                    />
                                                    <button className="btn btn-primary" style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem' }} onClick={() => saveDescription(v.id)}>保存</button>
                                                    <button className="btn" style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem' }} onClick={() => setEditingId(null)}>取消</button>
                                                </div>
                                            ) : (
                                                <div
                                                    style={{
                                                        fontSize: '0.9rem',
                                                        marginTop: '6px',
                                                        color: v.description ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}
                                                    onClick={() => startEditing(v)}
                                                    title="点击修改备注"
                                                >
                                                    {v.description || '点击添加备注...'}
                                                    <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>✎</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleRestore(v.id)}
                                            style={{ fontSize: '0.82rem', padding: '0.5rem 0.95rem', whiteSpace: 'nowrap' }}
                                        >
                                            回退
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
