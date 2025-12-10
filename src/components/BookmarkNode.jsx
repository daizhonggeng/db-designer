import React, { useState } from 'react';
import ColorPicker from './ColorPicker';
import { hexToRgba } from '../utils/colors';

export default function BookmarkNode({ bookmark, dispatch, zoom }) {
    const [isResizing, setIsResizing] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(bookmark.name);
    const [showColorPicker, setShowColorPicker] = useState(false);

    const handleNameSubmit = () => {
        setIsEditingName(false);
        if (name !== bookmark.name) {
            dispatch({
                type: 'UPDATE_BOOKMARK',
                payload: { id: bookmark.id, updates: { name } }
            });
        }
    };

    const handleColorSelect = (colorObj) => {
        // User requested high transparency for bookmarks
        const transparentColor = hexToRgba(colorObj.value, 0.1);
        dispatch({
            type: 'UPDATE_BOOKMARK',
            payload: { id: bookmark.id, updates: { color: transparentColor } }
        });
        setShowColorPicker(false);
    };

    const handleResizeStart = (e) => {
        e.stopPropagation();
        setIsResizing(true);
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = bookmark.width;
        const startHeight = bookmark.height;

        const handleMouseMove = (moveEvent) => {
            const deltaX = (moveEvent.clientX - startX) / zoom;
            const deltaY = (moveEvent.clientY - startY) / zoom;

            dispatch({
                type: 'UPDATE_BOOKMARK',
                payload: {
                    id: bookmark.id,
                    updates: {
                        width: Math.max(100, startWidth + deltaX),
                        height: Math.max(100, startHeight + deltaY)
                    }
                }
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="bookmark-node"
            data-bookmark-id={bookmark.id}
            style={{
                position: 'absolute',
                left: bookmark.x,
                top: bookmark.y,
                width: bookmark.width,
                height: bookmark.height,
                backgroundColor: bookmark.color,
                border: '1px dashed var(--accent-secondary)',
                borderRadius: 'var(--radius-md)',
                pointerEvents: 'all',
                zIndex: 0, // Behind tables
                transition: 'background-color 0.3s ease',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Header / Drag Handle */}
            <div
                style={{
                    padding: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'relative', // For absolute positioning of color picker
                    flexShrink: 0
                }}
            >
                {isEditingName ? (
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleNameSubmit}
                        onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{
                            background: 'rgba(0,0,0,0.5)',
                            border: 'none',
                            color: 'white',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            width: '100%'
                        }}
                    />
                ) : (
                    <span
                        onDoubleClick={() => setIsEditingName(true)}
                        style={{
                            color: 'var(--text-secondary)',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            userSelect: 'none',
                            flex: 1
                        }}
                    >
                        {bookmark.name}
                    </span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                            background: bookmark.color,
                            border: '1px solid var(--text-secondary)'
                        }} />
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('确定删除书签吗？(表不会被删除)')) {
                                dispatch({ type: 'DELETE_BOOKMARK', payload: bookmark.id });
                            }
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            lineHeight: 1,
                            padding: '0 4px'
                        }}
                        title="删除书签"
                    >
                        ×
                    </button>
                </div>

                {showColorPicker && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, marginTop: '4px' }}>
                        <ColorPicker
                            onSelect={handleColorSelect}
                            currentColor={bookmark.color} // This might not match exactly due to transparency, but it's okay
                        />
                    </div>
                )}
            </div>

            {/* Separator Line */}
            <div style={{
                height: '1px',
                background: 'var(--glass-border)',
                width: '100%',
                flexShrink: 0
            }} />

            {/* Resize Handle */}
            <div
                onMouseDown={handleResizeStart}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '15px',
                    height: '15px',
                    cursor: 'nwse-resize',
                    background: 'linear-gradient(135deg, transparent 50%, var(--accent-secondary) 50%)',
                    borderBottomRightRadius: 'var(--radius-md)'
                }}
            />
        </div>
    );
}
