import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { v4 as uuidv4 } from 'uuid';

const TABS = ['columns', 'indexes', 'constraints'];
const INDEX_TYPES = ['BTREE', 'HASH', 'GIN', 'GIST', 'FULLTEXT', 'OTHER'];
const CONSTRAINT_TYPES = ['PRIMARY_KEY', 'UNIQUE', 'CHECK'];

const normalizeColumn = (column) => {
    const isPk = Boolean(column?.isPk);
    return {
        id: column?.id || uuidv4(),
        name: column?.name || 'new_column',
        type: column?.type || 'VARCHAR(255)',
        isPk,
        nullable: typeof column?.nullable === 'boolean' ? column.nullable : !isPk,
        defaultValue: typeof column?.defaultValue === 'string' ? column.defaultValue : '',
        isUnique: typeof column?.isUnique === 'boolean' ? column.isUnique : isPk,
        isAutoIncrement: Boolean(column?.isAutoIncrement),
        comment: column?.comment || '',
    };
};

const normalizeTable = (table) => {
    const columns = Array.isArray(table?.columns) ? table.columns.map(normalizeColumn) : [];
    const columnIds = new Set(columns.map((column) => column.id));
    return {
        ...table,
        name: table?.name || 'new_table',
        comment: table?.comment || '',
        columns,
        indexes: (table?.indexes || []).map((index) => ({
            id: index?.id || uuidv4(),
            name: index?.name || 'idx_name',
            type: INDEX_TYPES.includes(index?.type) ? index.type : 'BTREE',
            isUnique: Boolean(index?.isUnique),
            columns: Array.isArray(index?.columns) ? index.columns.filter((id) => columnIds.has(id)) : [],
            comment: index?.comment || '',
        })),
        constraints: (table?.constraints || []).map((constraint) => ({
            id: constraint?.id || uuidv4(),
            type: CONSTRAINT_TYPES.includes(constraint?.type) ? constraint.type : 'UNIQUE',
            name: constraint?.name || 'cons_name',
            columns: Array.isArray(constraint?.columns) ? constraint.columns.filter((id) => columnIds.has(id)) : [],
            expression: constraint?.expression || '',
        })),
    };
};

const validateTable = (table) => {
    if (!table.name.trim()) return '表名不能为空';
    if (!table.columns.length) return '至少需要一个字段';
    const names = new Set();
    for (const column of table.columns) {
        const name = column.name.trim().toLowerCase();
        if (!name) return '字段名不能为空';
        if (!column.type.trim()) return `字段 ${column.name} 缺少类型`;
        if (names.has(name)) return `字段名重复: ${column.name}`;
        names.add(name);
    }
    for (const index of table.indexes) {
        if (!index.name.trim()) return '索引名称不能为空';
        if (!index.columns.length) return `索引 ${index.name || '(未命名)'} 至少选择一个字段`;
    }
    for (const constraint of table.constraints) {
        if (!constraint.name.trim()) return '约束名称不能为空';
        if (constraint.type === 'CHECK' && !constraint.expression.trim()) return `检查约束 ${constraint.name || '(未命名)'} 需要表达式`;
        if (constraint.type !== 'CHECK' && !constraint.columns.length) return `约束 ${constraint.name || '(未命名)'} 至少选择一个字段`;
    }
    return '';
};

const toSavePayload = (table) => {
    const columns = table.columns.map((column) => ({
        ...column,
        name: column.name.trim(),
        type: column.type.trim(),
        defaultValue: (column.defaultValue || '').trim(),
        comment: (column.comment || '').trim(),
    }));
    const pkColumns = columns.filter((column) => column.isPk).map((column) => column.id);
    const autoPk = pkColumns.length ? [{ id: uuidv4(), type: 'PRIMARY_KEY', name: `pk_${table.name.trim() || 'table'}`, columns: pkColumns, expression: '' }] : [];
    return {
        ...table,
        name: table.name.trim(),
        comment: table.comment.trim(),
        columns,
        indexes: table.indexes.map((index) => ({ ...index, name: index.name.trim(), comment: index.comment.trim() })),
        constraints: [...autoPk, ...table.constraints.filter((constraint) => constraint.type !== 'PRIMARY_KEY')].map((constraint) => ({
            ...constraint,
            name: constraint.name.trim(),
            expression: (constraint.expression || '').trim(),
        })),
    };
};

function Toggle({ checked, label, onChange }) {
    return <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.45rem 0.72rem', borderRadius: '999px', border: checked ? '1px solid rgba(90,209,195,0.26)' : '1px solid var(--glass-border)', background: checked ? 'rgba(90,209,195,0.12)' : 'rgba(255,255,255,0.03)', color: checked ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.84rem', cursor: 'pointer' }}><input type="checkbox" checked={checked} onChange={onChange} />{label}</label>;
}

export default function TableEditModal({ table, onClose, onSave }) {
    const [editedTable, setEditedTable] = useState(() => normalizeTable(table));
    const [activeTab, setActiveTab] = useState('columns');
    const [error, setError] = useState('');

    const updateColumn = (columnId, patch) => setEditedTable((prev) => ({ ...prev, columns: prev.columns.map((column) => column.id === columnId ? { ...column, ...patch } : column) }));
    const removeColumn = (columnId) => setEditedTable((prev) => ({ ...prev, columns: prev.columns.filter((column) => column.id !== columnId), indexes: prev.indexes.map((index) => ({ ...index, columns: index.columns.filter((id) => id !== columnId) })), constraints: prev.constraints.map((constraint) => ({ ...constraint, columns: constraint.columns.filter((id) => id !== columnId) })) }));
    const save = () => { const nextError = validateTable(editedTable); if (nextError) return setError(nextError); onSave(toSavePayload(editedTable)); onClose(); };
    const stats = [
        ['字段', editedTable.columns.length, 'var(--accent-primary)'],
        ['主键列', editedTable.columns.filter((column) => column.isPk).length, 'var(--accent-secondary)'],
        ['索引', editedTable.indexes.length, 'var(--accent-tertiary)'],
        ['约束', editedTable.constraints.length, 'var(--accent-success)'],
    ];

    return ReactDOM.createPortal(
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999, padding: '1rem' }}>
            <div className="modal-content glass" onClick={(event) => event.stopPropagation()} style={{ width: 'min(1180px, 96vw)', maxHeight: '92vh', padding: 0, borderRadius: '28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), var(--bg-card)' }}>
                <div style={{ padding: '1.35rem 1.45rem 1.1rem', borderBottom: '1px solid var(--glass-border)', display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ display: 'grid', gap: '0.42rem' }}>
                            <span className="ui-kicker">Structure Composer</span>
                            <div>
                                <h2 className="panel-heading" style={{ margin: 0, fontSize: '1.42rem' }}>表结构设计器</h2>
                                <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.5 }}>统一维护字段、索引和约束，减少画布和数据库定义之间的割裂。</p>
                            </div>
                        </div>
                        <button className="btn" onClick={onClose}>&times;</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.95fr)', gap: '0.85rem' }}>
                        <div className="ui-card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                                <input className="ui-input" value={editedTable.name} onChange={(event) => setEditedTable((prev) => ({ ...prev, name: event.target.value }))} placeholder="表名" />
                                <input className="ui-input" value={editedTable.comment || ''} onChange={(event) => setEditedTable((prev) => ({ ...prev, comment: event.target.value }))} placeholder="表注释" />
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>保存时会自动整理主键约束，并清理已删除字段的索引和约束引用。</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                            {stats.map(([label, value, color]) => <div key={label} className="ui-card ui-stat-tile"><span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{label}</span><strong style={{ color }}>{value}</strong></div>)}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                        {TABS.map((tab) => <button key={tab} type="button" className={`ui-tab ${activeTab === tab ? 'is-active' : ''}`} onClick={() => setActiveTab(tab)}>{tab === 'columns' ? '字段设计' : tab === 'indexes' ? '索引设计' : '约束设计'}</button>)}
                    </div>
                </div>

                <div className="ui-scroll" style={{ padding: '1.25rem 1.45rem', overflowY: 'auto', flex: 1, display: 'grid', gap: '1rem' }}>
                    {activeTab === 'columns' && <><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}><div><span className="ui-kicker">Columns</span><p style={{ margin: '0.55rem 0 0', color: 'var(--text-secondary)' }}>字段名、类型、默认值和约束都在这里维护。</p></div><button type="button" className="btn btn-primary" onClick={() => setEditedTable((prev) => ({ ...prev, columns: [...prev.columns, normalizeColumn({ id: uuidv4(), name: `column_${prev.columns.length + 1}` })] }))}>+ 添加字段</button></div>{editedTable.columns.map((column, index) => <div key={column.id} className="ui-card" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}><div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}><span className="project-badge">字段 {index + 1}</span>{column.isPk && <span className="project-badge" style={{ color: 'var(--accent-secondary)' }}>Primary Key</span>}</div><button type="button" onClick={() => removeColumn(column.id)} style={{ border: '1px solid rgba(255,122,112,0.35)', background: 'rgba(255,122,112,0.12)', color: 'var(--accent-danger)', borderRadius: '999px', padding: '0.55rem 0.95rem', cursor: 'pointer' }}>删除字段</button></div><div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.9fr 0.8fr', gap: '0.7rem' }}><input className="ui-input" value={column.name} onChange={(event) => updateColumn(column.id, { name: event.target.value })} placeholder="字段名" /><input className="ui-input" value={column.type} onChange={(event) => updateColumn(column.id, { type: event.target.value })} placeholder="类型" /><input className="ui-input" value={column.defaultValue || ''} onChange={(event) => updateColumn(column.id, { defaultValue: event.target.value })} placeholder="默认值" /></div><input className="ui-input" value={column.comment || ''} onChange={(event) => updateColumn(column.id, { comment: event.target.value })} placeholder="字段注释" /><div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}><Toggle checked={column.isPk} label="主键" onChange={(event) => updateColumn(column.id, { isPk: event.target.checked, nullable: event.target.checked ? false : column.nullable, isUnique: event.target.checked ? true : column.isUnique })} /><Toggle checked={!column.nullable} label="非空" onChange={(event) => updateColumn(column.id, { nullable: !event.target.checked })} /><Toggle checked={column.isUnique} label="唯一" onChange={(event) => updateColumn(column.id, { isUnique: event.target.checked })} /><Toggle checked={column.isAutoIncrement} label="自增" onChange={(event) => updateColumn(column.id, { isAutoIncrement: event.target.checked })} /></div></div>)}</>}

                    {activeTab === 'indexes' && <><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}><div><span className="ui-kicker">Indexes</span><p style={{ margin: '0.55rem 0 0', color: 'var(--text-secondary)' }}>用字段组合描述最重要的查询路径。</p></div><button type="button" className="btn btn-primary" onClick={() => setEditedTable((prev) => ({ ...prev, indexes: [...prev.indexes, { id: uuidv4(), name: `idx_${prev.indexes.length + 1}`, type: 'BTREE', isUnique: false, columns: [], comment: '' }] }))}>+ 添加索引</button></div>{editedTable.indexes.map((index) => <div key={index.id} className="ui-card" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}><div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.8fr auto auto', gap: '0.7rem', alignItems: 'center' }}><input className="ui-input" value={index.name} onChange={(event) => setEditedTable((prev) => ({ ...prev, indexes: prev.indexes.map((item) => item.id === index.id ? { ...item, name: event.target.value } : item) }))} placeholder="索引名" /><select className="ui-select" value={index.type} onChange={(event) => setEditedTable((prev) => ({ ...prev, indexes: prev.indexes.map((item) => item.id === index.id ? { ...item, type: event.target.value } : item) }))}>{INDEX_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select><Toggle checked={index.isUnique} label="唯一索引" onChange={(event) => setEditedTable((prev) => ({ ...prev, indexes: prev.indexes.map((item) => item.id === index.id ? { ...item, isUnique: event.target.checked } : item) }))} /><button type="button" onClick={() => setEditedTable((prev) => ({ ...prev, indexes: prev.indexes.filter((item) => item.id !== index.id) }))} style={{ border: '1px solid rgba(255,122,112,0.35)', background: 'rgba(255,122,112,0.12)', color: 'var(--accent-danger)', borderRadius: '999px', padding: '0.55rem 0.95rem', cursor: 'pointer' }}>删除</button></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}><select className="ui-select" multiple value={index.columns} onChange={(event) => setEditedTable((prev) => ({ ...prev, indexes: prev.indexes.map((item) => item.id === index.id ? { ...item, columns: Array.from(event.target.selectedOptions).map((option) => option.value) } : item) }))} style={{ minHeight: '120px' }}>{editedTable.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select><textarea className="ui-textarea" value={index.comment || ''} onChange={(event) => setEditedTable((prev) => ({ ...prev, indexes: prev.indexes.map((item) => item.id === index.id ? { ...item, comment: event.target.value } : item) }))} placeholder="索引用途说明" style={{ minHeight: '120px' }} /></div></div>)}</>}

                    {activeTab === 'constraints' && <><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}><div><span className="ui-kicker">Constraints</span><p style={{ margin: '0.55rem 0 0', color: 'var(--text-secondary)' }}>统一定义唯一约束、检查规则和列组合限制。</p></div><button type="button" className="btn btn-primary" onClick={() => setEditedTable((prev) => ({ ...prev, constraints: [...prev.constraints, { id: uuidv4(), type: 'UNIQUE', name: `cons_${prev.constraints.length + 1}`, columns: [], expression: '' }] }))}>+ 添加约束</button></div>{editedTable.constraints.map((constraint) => <div key={constraint.id} className="ui-card" style={{ padding: '1rem', display: 'grid', gap: '0.8rem' }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 0.85fr auto', gap: '0.7rem' }}><input className="ui-input" value={constraint.name} onChange={(event) => setEditedTable((prev) => ({ ...prev, constraints: prev.constraints.map((item) => item.id === constraint.id ? { ...item, name: event.target.value } : item) }))} placeholder="约束名" /><select className="ui-select" value={constraint.type} onChange={(event) => setEditedTable((prev) => ({ ...prev, constraints: prev.constraints.map((item) => item.id === constraint.id ? { ...item, type: event.target.value, columns: event.target.value === 'CHECK' ? [] : item.columns, expression: event.target.value === 'CHECK' ? item.expression : '' } : item) }))}>{CONSTRAINT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select><button type="button" onClick={() => setEditedTable((prev) => ({ ...prev, constraints: prev.constraints.filter((item) => item.id !== constraint.id) }))} style={{ border: '1px solid rgba(255,122,112,0.35)', background: 'rgba(255,122,112,0.12)', color: 'var(--accent-danger)', borderRadius: '999px', padding: '0.55rem 0.95rem', cursor: 'pointer' }}>删除</button></div>{constraint.type === 'CHECK' ? <textarea className="ui-textarea" value={constraint.expression || ''} onChange={(event) => setEditedTable((prev) => ({ ...prev, constraints: prev.constraints.map((item) => item.id === constraint.id ? { ...item, expression: event.target.value } : item) }))} placeholder="例如: amount > 0" style={{ minHeight: '120px' }} /> : <select className="ui-select" multiple value={constraint.columns} onChange={(event) => setEditedTable((prev) => ({ ...prev, constraints: prev.constraints.map((item) => item.id === constraint.id ? { ...item, columns: Array.from(event.target.selectedOptions).map((option) => option.value) } : item) }))} style={{ minHeight: '120px' }}>{editedTable.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select>}</div>)}</>}
                </div>

                <div style={{ borderTop: '1px solid var(--glass-border)', padding: '0.95rem 1.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ color: error ? 'var(--accent-danger)' : 'var(--text-secondary)', fontSize: '0.88rem' }}>{error || '保存后会同步更新当前画布中的表结构、索引与约束。'}</div>
                    <div style={{ display: 'flex', gap: '0.65rem' }}><button type="button" className="btn" onClick={onClose}>取消</button><button type="button" className="btn btn-primary" onClick={save}>保存更改</button></div>
                </div>
            </div>
        </div>,
        document.body
    );
}
