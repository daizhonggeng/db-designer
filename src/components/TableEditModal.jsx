import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { v4 as uuidv4 } from 'uuid';

export default function TableEditModal({ table, onClose, onSave }) {
    const [editedTable, setEditedTable] = useState(null);

    useEffect(() => {
        if (table) {
            setEditedTable(JSON.parse(JSON.stringify(table)));
        }
    }, [table]);

    if (!editedTable) return null;

    const handleTableNameChange = (e) => {
        setEditedTable({ ...editedTable, name: e.target.value });
    };

    const handleTableCommentChange = (e) => {
        setEditedTable({ ...editedTable, comment: e.target.value });
    };

    const handleColumnChange = (id, field, value) => {
        const newColumns = editedTable.columns.map(col =>
            col.id === id ? { ...col, [field]: value } : col
        );
        setEditedTable({ ...editedTable, columns: newColumns });
    };

    const addColumn = () => {
        const newCol = {
            id: uuidv4(),
            name: 'new_column',
            type: 'VARCHAR(255)',
            isPk: false,
            comment: ''
        };
        setEditedTable({
            ...editedTable,
            columns: [...editedTable.columns, newCol]
        });
    };

    const removeColumn = (id) => {
        setEditedTable({
            ...editedTable,
            columns: editedTable.columns.filter(c => c.id !== id)
        });
    };

    const handleSave = () => {
        onSave(editedTable);
        onClose();
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(8px)'
        }}>
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{
                width: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-lg)', padding: '2rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '1.5rem' }}>编辑表结构</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>表名</label>
                        <input
                            value={editedTable.name}
                            onChange={handleTableNameChange}
                            style={{
                                width: '100%', padding: '0.75rem',
                                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)', borderRadius: 'var(--radius-md)',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>表注释</label>
                        <input
                            value={editedTable.comment || ''}
                            onChange={handleTableCommentChange}
                            placeholder="添加表说明..."
                            style={{
                                width: '100%', padding: '0.75rem',
                                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)', borderRadius: 'var(--radius-md)',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.2)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.03)', position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'center', width: '60px', borderBottom: '1px solid var(--glass-border)' }}>PK</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>字段名</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>类型</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>注释</th>
                                <th style={{ padding: '1rem', textAlign: 'center', width: '60px', borderBottom: '1px solid var(--glass-border)' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {editedTable.columns.map((col, idx) => (
                                <tr key={col.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={col.isPk}
                                            onChange={(e) => handleColumnChange(col.id, 'isPk', e.target.checked)}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <input
                                            value={col.name}
                                            onChange={(e) => handleColumnChange(col.id, 'name', e.target.value)}
                                            style={{
                                                width: '100%', background: 'transparent', border: 'none',
                                                color: 'var(--text-primary)', padding: '0.5rem',
                                                borderRadius: '4px'
                                            }}
                                            onFocus={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                            onBlur={e => e.target.style.background = 'transparent'}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <input
                                            value={col.type}
                                            onChange={(e) => handleColumnChange(col.id, 'type', e.target.value)}
                                            style={{
                                                width: '100%', background: 'transparent', border: 'none',
                                                color: 'var(--accent-secondary)', padding: '0.5rem',
                                                borderRadius: '4px', fontFamily: 'monospace'
                                            }}
                                            onFocus={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                            onBlur={e => e.target.style.background = 'transparent'}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <input
                                            value={col.comment || ''}
                                            onChange={(e) => handleColumnChange(col.id, 'comment', e.target.value)}
                                            placeholder="添加注释..."
                                            style={{
                                                width: '100%', background: 'transparent', border: 'none',
                                                color: 'var(--text-secondary)', padding: '0.5rem',
                                                borderRadius: '4px'
                                            }}
                                            onFocus={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                            onBlur={e => e.target.style.background = 'transparent'}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                        <button
                                            onClick={() => removeColumn(col.id)}
                                            style={{
                                                background: 'transparent', border: 'none', color: '#ef4444',
                                                cursor: 'pointer', fontSize: '1.2rem', padding: '4px',
                                                opacity: 0.7, transition: 'opacity 0.2s'
                                            }}
                                            onMouseEnter={e => e.target.style.opacity = 1}
                                            onMouseLeave={e => e.target.style.opacity = 0.7}
                                            title="删除字段"
                                        >
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={addColumn}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--text-secondary)',
                            color: 'var(--text-primary)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'var(--text-secondary)';
                        }}
                    >
                        <span>+</span> 添加字段
                    </button>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '0.75rem 2rem', background: 'transparent',
                                border: '1px solid var(--glass-border)', color: 'var(--text-secondary)',
                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--text-primary)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn-primary"
                            style={{
                                padding: '0.75rem 2rem',
                                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                fontWeight: 'bold', boxShadow: '0 4px 12px rgba(var(--accent-primary-rgb), 0.3)'
                            }}
                        >
                            保存更改
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
