import React, { useState } from 'react';
import { useSchema } from '../store/schemaStore';
import Icon from './Icon';

export default function Sidebar({ onLocateTable }) {
    const { state } = useSchema();
    const [expanded, setExpanded] = useState({});
    const [search, setSearch] = useState('');
    const query = search.trim().toLowerCase();
    const matches = item => `${item.name} ${item.comment || ''}`.toLowerCase().includes(query);
    const tables = state.tables.filter(table => !query || `${table.name} ${table.comment || ''}`.toLowerCase().includes(query) || table.columns.some(column => `${column.name} ${column.comment || ''}`.toLowerCase().includes(query)));
    return <aside className="sidebar-shell"><div className="sidebar-top"><div className="sidebar-top-title"><h3>数据结构</h3><span>{state.tables.length} 张表</span></div><div className="sidebar-search"><Icon name="search" size={14} /><input className="ui-input" aria-label="搜索表或字段" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索表、字段或注释…" /></div></div><div className="sidebar-list">
        {!tables.length ? <div className="dashboard-empty" style={{ border: 0, padding: '25px 8px' }}>{state.tables.length ? '没有匹配的表或字段' : '添加第一张表，开始设计'}</div> : tables.map(table => <div key={table.id} className="sidebar-table-card"><div className="sidebar-table-head" onClick={() => setExpanded(previous => ({ ...previous, [table.id]: !previous[table.id] }))}><Icon name={expanded[table.id] || query ? 'down' : 'chevron'} size={11} /><Icon name="table" size={14} className="table-symbol" /><div className="sidebar-table-name"><span>{table.name}</span>{table.comment && <small>{table.comment}</small>}</div><span className="sidebar-table-count">{table.columns.length}</span><button className="icon-button sidebar-locate-btn" title="定位到此表" onClick={event => { event.stopPropagation(); onLocateTable?.(table.id); }}><Icon name="locate" size={13} /></button></div>{(expanded[table.id] || query) && <div className="sidebar-fields">{table.columns.filter(column => !query || matches(table) || matches(column)).map(column => <div className="sidebar-column-row" key={column.id} title={column.comment || column.name}><Icon name={column.isPk ? 'key' : state.relationships.some(relation => relation.fromTable === table.id && relation.fromCol === column.id) ? 'link' : 'minus'} size={11} /><span>{column.name}</span><code>{column.type}</code></div>)}</div>}</div>)}
    </div><div className="sidebar-footnote">点击展开字段 · 定位图标跳转至画布</div></aside>;
}
