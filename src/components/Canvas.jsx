import React, { useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSchema } from '../store/schemaStore';
import TableNode from './TableNode';
import BookmarkNode from './BookmarkNode';
import ContextMenu from './ContextMenu';
import { createOrderExample } from '../utils/projectData';
import { fitViewport, canvasPoint } from '../utils/canvasViewport';

const SNAP_SIZE = 20;

const Canvas = forwardRef((props, ref) => {
    const { state, dispatch } = useSchema();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    // History Refs
    const dragStartSnapshotRef = useRef(null);
    const hasMovedRef = useRef(false);

    const [draggingId, setDraggingId] = useState(null);
    const [draggingType, setDraggingType] = useState(null); // 'table' or 'bookmark'
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Connection State
    const [connecting, setConnecting] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Selection & Hover State
    const [selectedRelId, setSelectedRelId] = useState(null);
    const [measurements, setMeasurements] = useState({});
    const measureTable = useCallback((id, measurement) => {
        setMeasurements(previous => JSON.stringify(previous[id]) === JSON.stringify(measurement) ? previous : { ...previous, [id]: measurement });
    }, []);
    const [hoveredTableId, setHoveredTableId] = useState(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null); // { x, y, options }

    // Zoom and Pan State
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const hasFitted = useRef(false);
    const fitView = useCallback(() => {
        if (!containerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();
        const viewport = fitViewport(state.tables, state.bookmarks, width, height);
        setZoom(viewport.zoom);
        setPan(viewport.pan);
    }, [state.tables, state.bookmarks]);

    useEffect(() => {
        if (!state.tables.length || hasFitted.current) return;
        const frame = requestAnimationFrame(() => { fitView(); hasFitted.current = true; });
        return () => cancelAnimationFrame(frame);
    }, [state.tables.length, fitView]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        focusOnTable: (tableId) => {
            const table = state.tables.find(t => t.id === tableId);
            if (!table || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;
            const newPanX = centerX - (table.position.x * zoom) - (120 * zoom);
            const newPanY = centerY - (table.position.y * zoom) - (100 * zoom);
            setPan({ x: newPanX, y: newPanY });
        }
    }));

    // Global Keydown for Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('.modal-overlay')) return;
            if (e.key === 'Escape') { setConnecting(null); setSelectedRelId(null); }
            if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); fitView(); }
            // Delete
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRelId) {
                dispatch({ type: 'DELETE_RELATIONSHIP', payload: selectedRelId });
                setSelectedRelId(null);
            }

            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                dispatch({ type: 'UNDO' });
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                dispatch({ type: 'REDO' });
            }

            // Copy: Ctrl+C (Only if hovering a table to know which one to copy)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && hoveredTableId) {
                e.preventDefault();
                dispatch({ type: 'COPY_TABLE', payload: hoveredTableId });
            }

            // Paste: Ctrl+V
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                dispatch({ type: 'PASTE_TABLE' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedRelId, hoveredTableId, dispatch, fitView]);

    // Close context menu on click
    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    // Fix for passive event listener error
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheelEvent = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prevZoom => Math.max(0.1, Math.min(3, prevZoom * delta)));
        };

        container.addEventListener('wheel', handleWheelEvent, { passive: false });
        return () => container.removeEventListener('wheel', handleWheelEvent);
    }, []);

    const handleMouseDown = (e) => {
        if (e.button === 2) return; // Right click handled by context menu

        const canvasRect = containerRef.current.getBoundingClientRect();
        const { x: mouseX, y: mouseY } = canvasPoint(e.clientX, e.clientY, canvasRect, pan, zoom);

        lastMousePosRef.current = { x: mouseX, y: mouseY };

        // 1. Check for Table Dragging
        const tableNode = e.target.closest('.table-node');
        if (tableNode) {
            const tableId = tableNode.dataset.tableId;
            const table = state.tables.find(t => t.id === tableId);
            if (table) {
                // Record snapshot before drag starts
                dragStartSnapshotRef.current = {
                    tables: state.tables,
                    relationships: state.relationships,
                    bookmarks: state.bookmarks
                };
                hasMovedRef.current = false;

                setDraggingId(tableId);
                setDraggingType('table');
                setDragOffset({
                    x: mouseX - table.position.x,
                    y: mouseY - table.position.y
                });
                return;
            }
        }

        // 2. Check for Bookmark Dragging
        const bookmarkNode = e.target.closest('.bookmark-node');
        if (bookmarkNode) {
            const rect = bookmarkNode.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            if (relativeY < 40) {
                // Record snapshot before drag starts
                dragStartSnapshotRef.current = {
                    tables: state.tables,
                    relationships: state.relationships,
                    bookmarks: state.bookmarks
                };
                hasMovedRef.current = false;

                const bookmarkId = bookmarkNode.dataset.bookmarkId;
                setDraggingId(bookmarkId);
                setDraggingType('bookmark');
                return;
            }
        }

        // 3. Pan Canvas
        if (e.target === canvasRef.current || e.target.tagName === 'svg' || e.target === containerRef.current) {
            setSelectedRelId(null);
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleMouseMove = (e) => {
        if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        const canvasRect = containerRef.current.getBoundingClientRect();
        const { x: rawX, y: rawY } = canvasPoint(e.clientX, e.clientY, canvasRect, pan, zoom);
        setMousePos({ x: rawX, y: rawY });

        if (draggingId) {
            hasMovedRef.current = true; // Mark as moved

            if (draggingType === 'table') {
                // Snap to Grid Logic
                const newX = rawX - dragOffset.x;
                const newY = rawY - dragOffset.y;
                const snappedX = Math.round(newX / SNAP_SIZE) * SNAP_SIZE;
                const snappedY = Math.round(newY / SNAP_SIZE) * SNAP_SIZE;

                dispatch({
                    type: 'MOVE_TABLE',
                    payload: {
                        id: draggingId,
                        position: { x: snappedX, y: snappedY }
                    }
                });
            } else if (draggingType === 'bookmark') {
                const dx = rawX - lastMousePosRef.current.x;
                const dy = rawY - lastMousePosRef.current.y;
                if (dx !== 0 || dy !== 0) {
                    dispatch({
                        type: 'MOVE_BOOKMARK',
                        payload: { id: draggingId, dx, dy }
                    });
                }
            }
        }
        lastMousePosRef.current = { x: rawX, y: rawY };
    };

    const handleMouseUp = () => {
        if (draggingId) {
            // If moved, push the PRE-DRAG state to history
            if (hasMovedRef.current && dragStartSnapshotRef.current) {
                dispatch({ type: 'PUSH_HISTORY', payload: dragStartSnapshotRef.current });
            }

            if (draggingType === 'table') {
                const table = state.tables.find(t => t.id === draggingId);
                if (table) {
                    const tableCenterX = table.position.x + (table.width || 240) / 2;
                    const tableCenterY = table.position.y + 100;
                    const targetBookmark = state.bookmarks?.find(b =>
                        tableCenterX >= b.x &&
                        tableCenterX <= b.x + b.width &&
                        tableCenterY >= b.y &&
                        tableCenterY <= b.y + b.height
                    );

                    if (targetBookmark) {
                        if (table.bookmarkId !== targetBookmark.id) {
                            dispatch({ type: 'ASSIGN_TABLE_TO_BOOKMARK', payload: { tableId: table.id, bookmarkId: targetBookmark.id } });
                        }
                    } else if (table.bookmarkId) {
                        dispatch({ type: 'ASSIGN_TABLE_TO_BOOKMARK', payload: { tableId: table.id, bookmarkId: null } });
                    }
                }
            }
        }
        setDraggingId(null);
        setDraggingType(null);
        setConnecting(null);
        setIsPanning(false);
        dragStartSnapshotRef.current = null;
        hasMovedRef.current = false;
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        const tableNode = e.target.closest('.table-node');
        const bookmarkNode = e.target.closest('.bookmark-node');

        let options = [];

        if (tableNode) {
            const tableId = tableNode.dataset.tableId;
            options = [
                { label: '复制表', icon: '📋', action: () => dispatch({ type: 'COPY_TABLE', payload: tableId }) },
                { label: '删除表', icon: '🗑️', danger: true, action: () => dispatch({ type: 'DELETE_TABLE', payload: tableId }) }
            ];
        } else if (bookmarkNode) {
            const bookmarkId = bookmarkNode.dataset.bookmarkId;
            options = [
                { label: '删除书签', icon: '🗑️', danger: true, action: () => dispatch({ type: 'DELETE_BOOKMARK', payload: bookmarkId }) }
            ];
        } else {
            // Canvas context menu
            options = [
                { label: '新建表', icon: '⊞', action: () => dispatch({ type: 'ADD_TABLE' }) },
                { label: '新建书签', icon: '🔖', action: () => dispatch({ type: 'ADD_BOOKMARK' }) },
                { label: '粘贴表', icon: '📋', action: () => dispatch({ type: 'PASTE_TABLE' }) },
                { label: '重置视图', icon: '👁️', action: () => { setZoom(1); setPan({ x: 0, y: 0 }); } }
            ];
        }

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            options
        });
    };

    const onStartConnect = (tableId, colId, e) => {
        const canvasRect = containerRef.current.getBoundingClientRect();
        setConnecting({
            tableId,
            colId,
            startX: (e.clientX - canvasRect.left - pan.x) / zoom,
            startY: (e.clientY - canvasRect.top - pan.y) / zoom
        });
    };

    const onCompleteConnect = (targetTableId, targetColId) => {
        if (connecting && connecting.tableId !== targetTableId) {
            dispatch({
                type: 'ADD_RELATIONSHIP',
                payload: {
                    id: uuidv4(),
                    fromTable: connecting.tableId,
                    fromCol: connecting.colId,
                    toTable: targetTableId,
                    toCol: targetColId
                }
            });
            setConnecting(null);
        }
    };

    const getColumnPosition = (tableId, colId) => {
        const table = state.tables.find(t => t.id === tableId);
        if (!table) return { x: 0, y: 0 };
        const colIndex = table.columns.findIndex(c => c.id === colId);
        const measured = measurements[tableId];
        const yOffset = measured?.columnOffsets[colId] ?? (145 + colIndex * 44);
        const width = measured?.width || table.width || 360;
        return { x: table.position.x, y: table.position.y + yOffset, width };
    };

    // Zoom controls
    const zoomIn = () => setZoom(Math.min(3, zoom * 1.2));
    const zoomOut = () => setZoom(Math.max(0.1, zoom / 1.2));
    const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

    return (
        <div
            ref={containerRef}
            className="canvas glass"
            style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)), rgba(3, 12, 18, 0.5)',
                outline: 'none',
                borderRadius: '28px',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-lg)'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
            tabIndex={0}
        >
            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextMenu.options}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {state.tables.length === 0 && <div className="canvas-empty" onMouseDown={event => event.stopPropagation()}>
                <span className="empty-icon">▦</span><h2>从第一张表开始设计</h2><p>添加数据表后，双击表头编辑字段。<br />拖动字段旁的连接点，可以建立表之间的关系。</p>
                <div className="session-actions"><button className="btn btn-primary" onClick={() => dispatch({ type: 'ADD_TABLE' })}>+ 添加第一张表</button><button className="btn" onClick={() => dispatch({ type: 'IMPORT_SCHEMA', payload: createOrderExample() })}>载入订单示例</button></div>
            </div>}
            <div style={{
                position: 'absolute',
                top: '16px',
                right: '18px',
                zIndex: 80,
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                justifyContent: 'flex-end'
            }}>
                <span className="project-badge">双击表头编辑</span>
                <span className="project-badge">右键菜单</span>
                <span className="project-badge">F 显示全部 · Ctrl+S 保存版本</span>
            </div>

            {/* Zoom Controls */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(9, 25, 34, 0.84)',
                padding: '10px',
                borderRadius: '18px',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <button className="btn" onClick={fitView} title="显示全部数据表（F）" aria-label="适应画布">⊡</button>
                <button className="btn" onClick={zoomIn} aria-label="放大画布">+</button>
                <button className="btn" onClick={resetZoom} style={{ fontSize: '12px' }}>{Math.round(zoom * 100)}%</button>
                <button className="btn" onClick={zoomOut} aria-label="缩小画布">−</button>
            </div>

            <div
                id="canvas-content"
                ref={canvasRef}
                style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    transformOrigin: '0 0',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    cursor: isPanning ? 'grabbing' : (draggingId ? 'grabbing' : 'default'),
                    backgroundImage: `
                        radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0),
                        linear-gradient(180deg, rgba(90, 209, 195, 0.045), transparent 24%),
                        radial-gradient(circle at top right, rgba(242, 182, 109, 0.08), transparent 22%)
                    `,
                    backgroundSize: `${SNAP_SIZE}px ${SNAP_SIZE}px, auto, auto`,
                    backgroundPosition: `${pan.x}px ${pan.y}px`
                }}
            >
                {state.bookmarks?.map(bookmark => (
                    <BookmarkNode key={bookmark.id} bookmark={bookmark} dispatch={dispatch} zoom={zoom} />
                ))}

                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-secondary)" />
                        </marker>
                        <marker id="arrow-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                        </marker>
                        <marker id="arrow-highlight" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-primary)" />
                        </marker>
                    </defs>

                    {state.relationships.map(rel => {
                        const fromPos = getColumnPosition(rel.fromTable, rel.fromCol);
                        const toPos = getColumnPosition(rel.toTable, rel.toCol);

                        // Calculate centers to determine relative position
                        const fromCenter = fromPos.x + fromPos.width / 2;
                        const toCenter = toPos.x + toPos.width / 2;

                        let x1, x2, cp1x, cp2x;

                        if (fromCenter < toCenter) {
                            // Source is Left, Target is Right -> Connect Source Right to Target Left
                            x1 = fromPos.x + fromPos.width;
                            x2 = toPos.x;
                            const dist = Math.abs(x2 - x1);
                            const cpOffset = Math.max(dist * 0.5, 50);
                            cp1x = x1 + cpOffset;
                            cp2x = x2 - cpOffset;
                        } else {
                            // Source is Right, Target is Left -> Connect Source Left to Target Right
                            x1 = fromPos.x;
                            x2 = toPos.x + toPos.width;
                            const dist = Math.abs(x2 - x1);
                            const cpOffset = Math.max(dist * 0.5, 50);
                            cp1x = x1 - cpOffset;
                            cp2x = x2 + cpOffset;
                        }

                        const y1 = fromPos.y;
                        const y2 = toPos.y;

                        const path = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;

                        const isSelected = selectedRelId === rel.id;
                        // Highlight if either connected table is hovered
                        const isHighlighted = hoveredTableId && (rel.fromTable === hoveredTableId || rel.toTable === hoveredTableId);
                        const isDimmed = hoveredTableId && !isHighlighted;

                        return (
                            <g
                                key={rel.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedRelId(rel.id); }}
                                style={{
                                    cursor: 'pointer',
                                    pointerEvents: 'all',
                                    opacity: isDimmed ? 0.1 : 1,
                                    transition: 'opacity 0.2s'
                                }}
                            >
                                <path d={path} stroke="transparent" strokeWidth="15" fill="none" />
                                <path
                                    d={path}
                                    stroke={isSelected ? "#ef4444" : (isHighlighted ? "var(--accent-primary)" : "var(--accent-secondary)")}
                                    strokeWidth={isSelected || isHighlighted ? "3" : "2"}
                                    fill="none"
                                    opacity={isSelected || isHighlighted ? "1" : "0.6"}
                                    markerEnd={isSelected ? "url(#arrow-selected)" : (isHighlighted ? "url(#arrow-highlight)" : "url(#arrow)")}
                                />
                            </g>
                        );
                    })}

                    {connecting && (
                        <line
                            x1={connecting.startX} y1={connecting.startY} x2={mousePos.x} y2={mousePos.y}
                            stroke="var(--accent-primary)" strokeWidth="2" strokeDasharray="5,5" pointerEvents="none"
                        />
                    )}
                </svg>

                {state.tables.map(table => {
                    const isHovered = hoveredTableId === table.id;
                    const isRelated = hoveredTableId && state.relationships.some(r =>
                        (r.fromTable === hoveredTableId && r.toTable === table.id) ||
                        (r.toTable === hoveredTableId && r.fromTable === table.id)
                    );
                    const isDimmed = hoveredTableId && !isHovered && !isRelated;

                    return (
                        <div
                            key={table.id}
                            onMouseEnter={() => setHoveredTableId(table.id)}
                            onMouseLeave={() => setHoveredTableId(null)}
                            style={{
                                position: 'absolute', // Ensure wrapper is positioned
                                opacity: isDimmed ? 0.3 : 1,
                                transition: 'opacity 0.2s',
                                zIndex: isHovered ? 10 : 1
                            }}
                        >
                            <TableNode
                                table={table}
                                onMeasure={measureTable}
                                onStartConnect={onStartConnect}
                                onCompleteConnect={onCompleteConnect}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

Canvas.displayName = 'Canvas';

export default Canvas;
