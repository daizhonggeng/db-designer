import React from 'react';
import { DOPAMINE_COLORS } from '../utils/colors';

export default function ColorPicker({ onSelect, currentColor }) {
    return (
        <div
            className="color-picker"
            style={{
                display: 'flex',
                gap: '6px',
                padding: '6px',
                background: 'rgba(20, 20, 20, 0.8)',
                borderRadius: '20px',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
        >
            {DOPAMINE_COLORS.map((c) => (
                <div
                    key={c.name}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(c);
                    }}
                    title={c.name}
                    style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: c.value,
                        border: currentColor === c.value ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        transform: currentColor === c.value ? 'scale(1.1)' : 'scale(1)'
                    }}
                    onMouseEnter={e => {
                        e.target.style.transform = 'scale(1.2)';
                        e.target.style.zIndex = 10;
                    }}
                    onMouseLeave={e => {
                        e.target.style.transform = currentColor === c.value ? 'scale(1.1)' : 'scale(1)';
                        e.target.style.zIndex = 1;
                    }}
                />
            ))}
        </div>
    );
}
