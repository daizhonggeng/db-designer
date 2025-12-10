import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useSchema } from '../store/schemaStore';
import { useSettings } from '../store/settingsStore';
import ColorPicker from './ColorPicker';
import { hexToRgba } from '../utils/colors';
import { generateTableSQL } from '../utils/sqlGenerator';
import TableEditModal from './TableEditModal';

export default function TableNode({ table, onStartConnect, onCompleteConnect, onMouseEnter, onMouseLeave }) {
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
    }, [table.id, dispatch]);

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

    const containerStyle = {
        position: 'absolute',
        left: table.position.x,
        top: table.position.y,
        minWidth: '240px',
        width: 'auto',
        display: 'inline-flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        boxShadow: isCustomColor
            ? `0 8px 32px -4px ${hexToRgba(baseColor, 0.2)}`
            : 'var(--shadow-lg)',
        background: isCustomColor ? hexToRgba(baseColor, 0.05) : 'var(--bg-card)',
        border: isCustomColor
            ? `1px solid ${hexToRgba(baseColor, 0.3)}`
            : '1px solid var(--glass-border)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        backdropFilter: 'blur(12px)'
    };

    const headerStyle = {
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: isCustomColor ? hexToRgba(baseColor, 0.15) : 'rgba(255,255,255,0.03)',
        borderBottom: isCustomColor
            ? `1px solid ${hexToRgba(baseColor, 0.2)}`
            : '1px solid var(--glass-border)',

        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'grab',
        borderTopLeftRadius: 'var(--radius-lg)',
        borderTopRightRadius: 'var(--radius-lg)'
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{
                        fontWeight: 'bold',
                        color: isCustomColor ? baseColor : 'var(--accent-primary)',
                        fontSize: '1rem',
                        textShadow: isCustomColor ? `0 0 10px ${hexToRgba(baseColor, 0.3)}` : 'none'
                    }}>
                        {table.name}
                    </span>
                    {table.comment && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            <span title={table.comment}>ℹ️</span>
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '1rem'
                        }}
                        title="编辑表结构"
                    >
                        ✏️
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(!showColorPicker);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-highlight)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                        onClick={deleteTable}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            marginLeft: '0.2rem',
                            opacity: 0.6
                        }}
                        onMouseEnter={e => e.target.style.opacity = 1}
                        onMouseLeave={e => e.target.style.opacity = 0.6}
                    >
                        &times;
                    </button>
                </div>

                {showColorPicker && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: '4px' }}>
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
                        background: 'var(--bg-card)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '4px',
                        zIndex: 10000,
                        minWidth: '160px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(12px)'
                    }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={exportTableSQL}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
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
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span>✏️</span> 编辑表结构
                        </button>
                        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
                        <button
                            onClick={() => {
                                deleteTable();
                                setShowContextMenu(false);
                            }}
                            style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
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
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', zIndex: 10000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    backdropFilter: 'blur(4px)'
                }} onClick={() => setShowSqlModal(false)}>
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1.5rem',
                        width: '600px',
                        maxWidth: '90vw',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: 0, color: 'var(--accent-primary)' }}>SQL 预览 - {table.name}</h3>
                        <textarea
                            value={sqlContent}
                            readOnly
                            style={{
                                width: '100%',
                                height: '300px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                padding: '1rem',
                                fontFamily: 'monospace',
                                resize: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(sqlContent);
                                    alert('已复制到剪贴板');
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                复制
                            </button>
                            <button
                                onClick={() => setShowSqlModal(false)}
                                className="btn-primary"
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Columns */}
            <div style={{ padding: 'var(--spacing-sm)' }}>
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

function ColumnRow({ tableId, column, dispatch, index, onStartConnect, onCompleteConnect, isFk, accentColor }) {
    const [isHovered, setIsHovered] = useState(false);

    const updateColumn = (updates) => {
        dispatch({ type: 'UPDATE_COLUMN', payload: { tableId, columnId: column.id, updates } });
    };

    const deleteColumn = () => {
        dispatch({ type: 'DELETE_COLUMN', payload: { tableId, columnId: column.id } });
    };

    const handleDotMouseDown = (e, side) => {
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
                marginBottom: '4px',
                alignItems: 'center',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent'
            }}
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
                <span style={{ color: 'var(--text-primary)', marginRight: '4px' }}>{column.name}</span>
                {column.comment && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ({column.comment})
                    </span>
                )}
            </div>

            <span style={{
                fontSize: '0.85rem',
                color: activeColor,
                marginLeft: '8px',
                marginRight: '8px'
            }}>
                {column.type}
            </span>

            <div
                onClick={() => updateColumn({ isPk: !column.isPk })}
                style={{
                    cursor: 'pointer',
                    color: column.isPk ? '#fbbf24' : 'var(--text-secondary)',
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