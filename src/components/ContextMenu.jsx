import React from 'react';

export default function ContextMenu({ x, y, options, onClose }) {
    if (!options || options.length === 0) return null;

    return (
        <div
            className="context-menu glass"
            style={{
                position: 'fixed',
                top: y,
                left: x,
                zIndex: 10000,
                minWidth: '160px',
                padding: '4px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-panel)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {options.map((opt, index) => (
                <button
                    key={index}
                    onClick={(e) => {
                        e.stopPropagation();
                        opt.action();
                        onClose();
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'transparent',
                        color: opt.danger ? '#ef4444' : 'var(--text-primary)',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = opt.danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <span style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
