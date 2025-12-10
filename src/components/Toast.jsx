import React, { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColor = type === 'success'
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : type === 'error'
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';

    return (
        <div
            style={{
                position: 'fixed',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: bgColor,
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                animation: 'slideDown 0.3s ease-out',
                backdropFilter: 'blur(10px)'
            }}
        >
            <span style={{ fontSize: '1.2rem' }}>
                {type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
            </span>
            {message}
        </div>
    );
}
