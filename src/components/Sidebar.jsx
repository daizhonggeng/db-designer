import React, { useMemo, useState } from 'react';
import { useSchema } from '../store/schemaStore';

export default function Sidebar({ onLocateTable }) {
    const { state } = useSchema();
    const [expandedTables, setExpandedTables] = useState({});
    const [searchTerm, setSearchTerm] = useState('');

    const schemaStats = useMemo(() => ({
        tableCount: state.tables.length,
        columnCount: state.tables.reduce((total, table) => total + table.columns.length, 0),
        relationshipCount: state.relationships.length,
        indexCount: state.tables.reduce((total, table) => total + (table.indexes?.length || 0), 0),
    }), [state.relationships.length, state.tables]);

    const filteredTables = useMemo(() => {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        if (!normalizedSearchTerm) {
            return state.tables;
        }

        return state.tables.filter((table) => (
            table.name.toLowerCase().includes(normalizedSearchTerm)
            || table.columns.some((column) => column.name.toLowerCase().includes(normalizedSearchTerm))
        ));
    }, [searchTerm, state.tables]);

    const toggleTable = (tableId) => {
        setExpandedTables((prev) => ({
            ...prev,
            [tableId]: !prev[tableId],
        }));
    };

    return (
        <div className="sidebar-shell glass sidebar-industrial">
            <div className="sidebar-top sidebar-top-industrial">
                <span className="ui-kicker">Schema Index</span>
                <h3 className="panel-heading" style={{ margin: '0.7rem 0 0.3rem', fontSize: '1rem' }}>数据表导航</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
                    检索表、字段和关系，并快速定位到画布中的对应位置。
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', marginTop: '12px' }}>
                    {[
                        { label: '表', value: schemaStats.tableCount },
                        { label: '字段', value: schemaStats.columnCount },
                        { label: '关系', value: schemaStats.relationshipCount },
                        { label: '索引', value: schemaStats.indexCount },
                    ].map((item) => (
                        <div key={item.label} className="sidebar-stat-card">
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.label}</div>
                            <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '700', marginTop: '2px' }}>{item.value}</div>
                        </div>
                    ))}
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '10px' }}>
                    共 {filteredTables.length} / {state.tables.length} 张表
                </div>

                <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="搜索表名或字段名"
                    className="ui-input"
                    style={{ marginTop: '10px' }}
                />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem' }}>
                {filteredTables.length === 0 ? (
                    <div className="dashboard-empty" style={{ padding: '1.2rem' }}>
                        {state.tables.length === 0 ? '暂无数据表' : '没有匹配的表或字段'}
                    </div>
                ) : (
                    filteredTables.map((table) => (
                        <div key={table.id} className="sidebar-table-card">
                            <div
                                className="sidebar-table-head"
                                onClick={() => toggleTable(table.id)}
                            >
                                <span style={{ marginRight: '6px', fontSize: '12px', transform: expandedTables[table.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    ▶
                                </span>
                                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                                    {table.name}
                                </span>
                                <span className="project-badge" style={{ marginRight: '0.35rem' }}>{table.columns.length}</span>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (onLocateTable) {
                                            onLocateTable(table.id);
                                        }
                                    }}
                                    className="sidebar-locate-btn"
                                    title="定位到此表"
                                >
                                    🎯
                                </button>
                            </div>

                            {expandedTables[table.id] && (
                                <div style={{ padding: '0.3rem 0.4rem 0.5rem 1.2rem' }}>
                                    {table.columns
                                        .filter((column) => {
                                            const normalizedSearchTerm = searchTerm.trim().toLowerCase();
                                            return !normalizedSearchTerm || table.name.toLowerCase().includes(normalizedSearchTerm) || column.name.toLowerCase().includes(normalizedSearchTerm);
                                        })
                                        .map((column) => {
                                            const isFk = state.relationships.some((relationship) => relationship.fromTable === table.id && relationship.fromCol === column.id);
                                            return (
                                                <div key={column.id} className="sidebar-column-row">
                                                    <span style={{ marginRight: '6px', fontSize: '12px' }}>
                                                        {column.isPk ? '🔑' : (isFk ? '🔗' : '•')}
                                                    </span>
                                                    <span style={{ flex: 1, color: 'var(--text-primary)' }}>{column.name}</span>
                                                    <span style={{ fontSize: '0.74rem', color: 'var(--accent-secondary)', opacity: 0.8 }}>{column.type}</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
