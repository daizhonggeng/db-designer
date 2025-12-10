import React, { useState } from 'react';
import { useSchema } from '../store/schemaStore';

export default function Sidebar({ onLocateTable }) {
    const { state } = useSchema();
    const [expandedTables, setExpandedTables] = useState({});

    const toggleTable = (tableId) => {
        setExpandedTables(prev => ({
            ...prev,
            [tableId]: !prev[tableId]
        }));
    };

    const handleTableClick = (tableId) => {
        if (onLocateTable) {
            onLocateTable(tableId);
        }
    };

    return (
        <div style={{
            width: '260px',
            background: 'var(--bg-panel)',
            borderRight: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: 'var(--spacing-md)',
                borderBottom: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.03)'
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 'bold'
                }}>
                    📋 数据表
                </h3>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '4px'
                }}>
                    共 {state.tables.length} 张表
                </div>
            </div>

            {/* Tree View */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 'var(--spacing-sm)'
            }}>
                {state.tables.length === 0 ? (
                    <div style={{
                        padding: 'var(--spacing-lg)',
                        textAlign: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem'
                    }}>
                        暂无数据表
                    </div>
                ) : (
                    state.tables.map(table => (
                        <div key={table.id} style={{
                            marginBottom: 'var(--spacing-xs)',
                            borderRadius: 'var(--radius-sm)',
                            overflow: 'hidden',
                            border: '1px solid transparent',
                            transition: 'all 0.2s'
                        }}>
                            {/* Table Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    background: expandedTables[table.id] ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    borderRadius: 'var(--radius-sm)',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => toggleTable(table.id)}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={(e) => e.target.style.background = expandedTables[table.id] ? 'rgba(255,255,255,0.05)' : 'transparent'}
                            >
                                <span style={{
                                    marginRight: '6px',
                                    fontSize: '12px',
                                    transition: 'transform 0.2s',
                                    transform: expandedTables[table.id] ? 'rotate(90deg)' : 'rotate(0deg)',
                                    display: 'inline-block'
                                }}>
                                    ▶
                                </span>
                                <span style={{
                                    flex: 1,
                                    fontSize: '0.85rem',
                                    color: 'var(--text-primary)',
                                    fontWeight: '500'
                                }}>
                                    {table.name}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTableClick(table.id);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--accent-primary)',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        padding: '2px 6px',
                                        borderRadius: 'var(--radius-sm)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = 'rgba(129, 140, 248, 0.2)'}
                                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                    title="定位到此表"
                                >
                                    🎯
                                </button>
                            </div>

                            {/* Columns List */}
                            {expandedTables[table.id] && (
                                <div style={{
                                    paddingLeft: '24px',
                                    paddingRight: '8px',
                                    paddingBottom: '4px'
                                }}>
                                    {table.columns.map(col => {
                                        const isFk = state.relationships.some(r =>
                                            r.fromTable === table.id && r.fromCol === col.id
                                        );

                                        return (
                                            <div
                                                key={col.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '4px 8px',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-secondary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    marginBottom: '2px',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                            >
                                                <span style={{ marginRight: '6px', fontSize: '12px' }}>
                                                    {col.isPk ? '🔑' : (isFk ? '🔗' : '•')}
                                                </span>
                                                <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                                                    {col.name}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--accent-secondary)',
                                                    opacity: 0.7
                                                }}>
                                                    {col.type}
                                                </span>
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
