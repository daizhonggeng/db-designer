import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useSchema } from '../store/schemaStore';
import { useSettings } from '../store/settingsStore';
import ColorPicker from './ColorPicker';
import { hexToRgba } from '../utils/colors';
import { generateTableSQL } from '../utils/sqlGenerator';
import TableEditModal from './TableEditModal';

export default function TableNode({ table, onStartConnect, onCompleteConnect, onMouseEnter, onMouseLeave, onMeasure }) {
    const { state, dispatch } = useSchema();
    const { dbDialect } = useSettings();
    const nodeRef = useRef(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [sqlContent, setSqlContent] = useState('');

    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Measure size and update store
    useEffect(() => {
        if (!nodeRef.current) return;

        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                const columnOffsets = Object.fromEntries(Array.from(nodeRef.current.querySelectorAll('[data-column-id]')).map(row => [row.dataset.columnId, row.offsetTop + row.offsetHeight / 2]));
                onMeasure(table.id, { width, height, columnOffsets });
                requestAnimationFrame(() => {
                    dispatch({
                        type: 'RESIZE_TABLE',
                        payload: { id: table.id, width: width, height: height }
                    });
                });
            }
        });

        observer.observe(nodeRef.current);
        return () => observer.disconnect();
    }, [table.id, table.columns, dispatch, onMeasure]);

    const handleSaveTable = (updatedTable) => {
        dispatch({
            type: 'UPDATE_TABLE',
            payload: updatedTable
        });
        setIsEditing(false);
    };

    const deleteTable = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (confirm('确定要删除这张表吗？')) {
            dispatch({ type: 'DELETE_TABLE', payload: table.id });
        }
    };

    const handleColorSelect = (colorObj) => {
        dispatch({
            type: 'UPDATE_TABLE',
            payload: { id: table.id, color: colorObj.value }
        });
        setShowColorPicker(false);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    };

    const exportTableSQL = () => {
        const sql = generateTableSQL(table, dbDialect);
        setSqlContent(sql);
        setShowSqlModal(true);
        setShowContextMenu(false);
    };

    // Calculate styles based on table color
    const baseColor = table.color || 'rgba(255, 255, 255, 0.05)';
    const isCustomColor = table.color && !table.color.startsWith('rgba(255, 255, 255');
    const accentTone = isCustomColor ? baseColor : 'var(--accent-primary)';
    const primaryCount = table.columns.filter((column) => column.isPk).length;
    const relationCount = state.relationships.filter((rel) => rel.fromTable === table.id || rel.toTable === table.id).length;

    const containerStyle = {
        position: 'absolute',
        left: table.position.x,
        top: table.position.y,
        minWidth: '280px',
        width: '360px',
        display: 'inline-flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isCustomColor
            ? `0 18px 44px -12px ${hexToRgba(baseColor, 0.24)}`
            : 'var(--shadow-lg)',
        background: isCustomColor
            ? `linear-gradient(180deg, ${hexToRgba(baseColor, 0.14)}, ${hexToRgba(baseColor, 0.05)})`
            : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)), var(--bg-card)',
        border: isCustomColor
            ? `1px solid ${hexToRgba(baseColor, 0.3)}`
            : '1px solid var(--glass-border)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden'
    };

    const headerStyle = {
        padding: '0.9rem 1rem 0.85rem',
        background: isCustomColor ? hexToRgba(baseColor, 0.15) : 'rgba(255,255,255,0.04)',
        borderBottom: isCustomColor
            ? `1px solid ${hexToRgba(baseColor, 0.2)}`
            : '1px solid var(--glass-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.7rem',
        cursor: 'grab',
        borderTopLeftRadius: 'var(--radius-lg)',
        borderTopRightRadius: 'var(--radius-lg)'
    };

    const iconButtonStyle = {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '0.42rem 0.55rem',
        borderRadius: '999px',
        fontSize: '0.88rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '34px'
    };

    return (
        <div
            ref={nodeRef}
            className="table-node glass"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={containerStyle}
            data-table-id={table.id}
            onContextMenu={handleContextMenu}
        >
            {/* Header */}
            <div
                className="table-header"
                style={headerStyle}
                onDoubleClick={() => setIsEditing(true)}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                    <div style={{ display: 'grid', gap: '0.38rem', minWidth: 0 }}>
                        <span style={{
                            fontWeight: 800,
                            color: accentTone,
                            fontSize: '1.05rem',
                            letterSpacing: '0.01em',
                            textShadow: isCustomColor ? `0 0 10px ${hexToRgba(baseColor, 0.3)}` : 'none'
                        }}>
                            {table.name}
                        </span>
                        {table.comment && (
                            <span title={table.comment} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                {table.comment}
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowColorPicker(!showColorPicker);
                            }}
                            style={iconButtonStyle}
                            title="更改颜色"
                        >
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: baseColor,
                                border: '1px solid var(--text-secondary)'
                            }} />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            style={iconButtonStyle}
                            title="编辑表结构"
                        >
                            ✎
                        </button>
                        <button
                            onClick={deleteTable}
                            style={{ ...iconButtonStyle, color: 'var(--accent-danger)' }}
                            title="删除表"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.55rem', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span className="project-badge">{table.columns.length} 字段</span>
                        <span className="project-badge" style={{ color: 'var(--accent-secondary)' }}>{primaryCount} 主键</span>
                        <span className="project-badge">{relationCount} 关系</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Double click to edit
                    </span>
                </div>

                {showColorPicker && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: '6px' }}>
                        <ColorPicker
                            onSelect={handleColorSelect}
                            currentColor={table.color}
                        />
                    </div>
                )}
            </div>

            {/* Table Edit Modal */}
            {isEditing && (
                <TableEditModal
                    key={table.id}
                    table={table}
                    onClose={() => setIsEditing(false)}
                    onSave={handleSaveTable}
                />
            )}

            {/* Context Menu */}
            {showContextMenu && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999,
                        background: 'transparent'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowContextMenu(false);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setShowContextMenu(false);
                    }}
                >
                    <div style={{
                        position: 'fixed',
                        top: contextMenuPos.y,
                        left: contextMenuPos.x,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), var(--bg-card)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '18px',
                        padding: '0.35rem',
                        zIndex: 10000,
                        minWidth: '180px',
                        boxShadow: 'var(--shadow-md)',
                        backdropFilter: 'blur(16px)'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={exportTableSQL}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.7rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.92rem',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>📤</span> 导出 SQL
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(true);
                                setShowContextMenu(false);
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.7rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.92rem',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>✏️</span> 编辑表结构
                        </button>
                        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.3rem 0' }} />
                        <button
                            onClick={() => {
                                deleteTable();
                                setShowContextMenu(false);
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.7rem 0.85rem',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-danger)',
                                cursor: 'pointer',
                                fontSize: '0.92rem',
                                borderRadius: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 122, 112, 0.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>🗑️</span> 删除表
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* SQL Preview Modal */}
            {showSqlModal && ReactDOM.createPortal(
                <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowSqlModal(false)}>
                    <div className="modal-content glass" style={{
                        width: '640px',
                        maxWidth: '92vw',
                        padding: '1.35rem',
                        borderRadius: '24px',
                        gap: '1rem'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                            <div>
                                <span className="ui-kicker">SQL Preview</span>
                                <h3 className="panel-heading" style={{ margin: '0.55rem 0 0', color: 'var(--text-primary)' }}>SQL 预览 - {table.name}</h3>
                            </div>
                            <button className="btn" onClick={() => setShowSqlModal(false)}>&times;</button>
                        </div>
                        <textarea
                            value={sqlContent}
                            readOnly
                            className="ui-textarea"
                            style={{ minHeight: '320px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn" onClick={() => {
                                navigator.clipboard.writeText(sqlContent);
                                alert('已复制到剪贴板');
                            }}>复制</button>
                            <button onClick={() => setShowSqlModal(false)} className="btn btn-primary">关闭</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Columns */}
            <div style={{ padding: '0.65rem', display: 'grid', minWidth: 0, gap: '0.32rem', background: 'rgba(4, 14, 20, 0.2)' }}>
                {table.columns.map((col, index) => (
                    <ColumnRow
                        key={col.id}
                        tableId={table.id}
                        column={col}
                        dispatch={dispatch}
                        index={index}
                        onStartConnect={onStartConnect}
                        onCompleteConnect={onCompleteConnect}
                        isFk={state.relationships.some(r => r.fromTable === table.id && r.fromCol === col.id)}
                        accentColor={isCustomColor ? baseColor : null}
                    />
                ))}
            </div>
        </div>
    );
}

function ColumnRow({ tableId, column, dispatch, onStartConnect, onCompleteConnect, isFk, accentColor }) {
    const [isHovered, setIsHovered] = useState(false);

    const updateColumn = (updates) => {
        dispatch({ type: 'UPDATE_COLUMN', payload: { tableId, columnId: column.id, updates } });
    };

    const deleteColumn = () => {
        dispatch({ type: 'DELETE_COLUMN', payload: { tableId, columnId: column.id } });
    };

    const handleDotMouseDown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onStartConnect(tableId, column.id, e);
    };

    const handleDotMouseUp = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onCompleteConnect(tableId, column.id);
    };

    const activeColor = accentColor || 'var(--accent-secondary)';

    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                gap: '8px',
                marginBottom: '0',
                alignItems: 'center',
                padding: '0.48rem 0.52rem',
                borderRadius: '12px',
                background: isHovered ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isHovered ? 'rgba(255,255,255,0.08)' : 'transparent'}`
            }}
            data-column-id={column.id}
            className="table-column"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Left Connection Dot */}
            <div
                style={{
                    position: 'absolute',
                    left: '-12px',
                    width: '10px',
                    height: '10px',
                    background: isHovered || isFk ? activeColor : 'transparent',
                    border: isHovered || isFk ? 'none' : '2px solid var(--text-secondary)',
                    borderRadius: '50%',
                    cursor: 'crosshair',
                    opacity: isHovered || isFk ? 1 : 0,
                    transition: 'all 0.2s',
                    zIndex: 10,
                    transform: 'scale(0.8)',
                    boxShadow: (isHovered || isFk) && accentColor ? `0 0 8px ${activeColor}` : 'none'
                }}
                onMouseDown={(e) => handleDotMouseDown(e, 'left')}
                onMouseUp={handleDotMouseUp}
                title="拖拽连接"
            />

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <span style={{ color: 'var(--text-primary)', marginRight: '4px', fontWeight: 600 }}>{column.name}</span>
                {column.comment && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ({column.comment})
                    </span>
                )}
            </div>

            <span style={{
                fontSize: '0.8rem',
                color: activeColor,
                marginLeft: '8px',
                marginRight: '8px',
                padding: '0.15rem 0.45rem',
                borderRadius: '999px',
                background: accentColor ? hexToRgba(activeColor, 0.14) : 'rgba(242, 182, 109, 0.12)'
            }}>
                {column.type}
            </span>

            <div
                onClick={() => updateColumn({ isPk: !column.isPk })}
                style={{
                    cursor: 'pointer',
                    color: column.isPk ? '#fbbf24' : (isFk ? 'var(--accent-primary)' : 'var(--text-secondary)'),
                    fontSize: '0.8rem',
                    padding: '0 4px',
                    opacity: column.isPk || isFk || isHovered ? 1 : 0.3
                }}
                title={column.isPk ? "主键" : (isFk ? "外键" : "普通字段")}
            >
                {column.isPk ? '🔑' : (isFk ? '🔗' : '📄')}
            </div>

            <button
                onClick={deleteColumn}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    opacity: isHovered ? 1 : 0,
                    fontSize: '1rem',
                    padding: '0 4px'
                }}
                title="删除列"
            >
                ×
            </button>

            {/* Right Connection Dot */}
            <div
                style={{
                    position: 'absolute',
                    right: '-12px',
                    width: '10px',
                    height: '10px',
                    background: isHovered || isFk ? activeColor : 'transparent',
                    border: isHovered || isFk ? 'none' : '2px solid var(--text-secondary)',
                    borderRadius: '50%',
                    cursor: 'crosshair',
                    opacity: isHovered || isFk ? 1 : 0,
                    transition: 'all 0.2s',
                    zIndex: 10,
                    transform: 'scale(0.8)',
                    boxShadow: (isHovered || isFk) && accentColor ? `0 0 8px ${activeColor}` : 'none'
                }}
                onMouseDown={(e) => handleDotMouseDown(e, 'right')}
                onMouseUp={handleDotMouseUp}
                title="拖拽连接"
            />
        </div>
    );
}
