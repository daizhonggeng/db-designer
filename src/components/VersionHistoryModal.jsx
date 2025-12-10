import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import ReactDOM from 'react-dom';

export default function VersionHistoryModal({ projectId, onClose, onRestore }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Editing state
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        fetchVersions();
    }, [projectId]);

    const fetchVersions = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/versions`);
            const data = await res.json();
            setVersions(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (versionId) => {
        if (!confirm('确定要回退到此版本吗？当前未保存的修改将丢失。')) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/versions/${versionId}`);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: '获取版本失败' }));
                throw new Error(errorData.error || '获取版本数据失败');
            }

            const data = await res.json();

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
            const res = await fetch(`${API_BASE_URL}/api/versions/${versionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: editValue })
            });
            if (res.ok) {
                setVersions(versions.map(v => v.id === versionId ? { ...v, description: editValue } : v));
                setEditingId(null);
            } else {
                throw new Error('Update failed');
            }
        } catch (err) {
            alert('更新备注失败');
        }
    };

    const formatTime = (str) => {
        return str;
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>🕒 版本历史</h3>
                    <button className="btn" onClick={onClose}>&times;</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', minHeight: '200px' }}>
                    {loading ? <p>加载中...</p> : (
                        versions.length === 0 ? <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>暂无历史版本</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {versions.map(v => (
                                    <div key={v.id} style={{
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        borderLeft: '3px solid var(--accent-secondary)'
                                    }}>
                                        <div style={{ flex: 1, marginRight: '10px' }}>
                                            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {formatTime(v.created_at)}
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    background: 'rgba(255,255,255,0.1)',
                                                    padding: '2px 6px',
                                                    borderRadius: '10px'
                                                }}>
                                                    {v.created_by || 'Unknown'}
                                                </span>
                                            </div>

                                            {editingId === v.id ? (
                                                <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
                                                    <input
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        style={{
                                                            flex: 1,
                                                            background: 'rgba(0,0,0,0.2)',
                                                            border: '1px solid var(--glass-border)',
                                                            color: 'white',
                                                            padding: '4px 8px',
                                                            borderRadius: '4px'
                                                        }}
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') saveDescription(v.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                    />
                                                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => saveDescription(v.id)}>保存</button>
                                                    <button className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => setEditingId(null)}>取消</button>
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
                                            className="btn"
                                            onClick={() => handleRestore(v.id)}
                                            style={{ fontSize: '0.8rem', padding: '4px 12px', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}
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
