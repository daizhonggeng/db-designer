import React from 'react';

export default function Logo({ size = 32, showText = true, color = 'var(--accent-primary)' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                </defs>
                {/* Database Stack Effect */}
                <path d="M16 4C9.37 4 4 6.24 4 9C4 11.76 9.37 14 16 14C22.63 14 28 11.76 28 9C28 6.24 22.63 4 16 4ZM16 12C10.5 12 6.22 10.22 6.02 8.07C6.67 10.15 10.87 11.9 16 11.9C21.13 11.9 25.33 10.15 25.98 8.07C25.78 10.22 21.5 12 16 12Z" fill="url(#logoGradient)" opacity="0.9" />
                <path d="M28 14C27.95 14.6 27.5 15.17 26.65 15.68C25.33 16.48 23.23 17.11 20.67 17.53C19.32 17.75 17.75 17.89 16.03 17.9C15.93 17.9 15.93 17.9 15.83 17.9C14.1 17.89 12.52 17.75 11.17 17.53C8.6 17.11 6.5 16.48 5.18 15.68C4.38 15.2 3.96 14.67 3.86 14.1C3.84 14.28 3.84 14.47 3.84 14.67C3.84 17.62 9.21 20 15.83 20C22.46 20 27.83 17.62 27.83 14.67C27.83 14.43 27.8 14.21 27.76 13.99C27.87 13.99 27.94 14 28 14Z" fill="url(#logoGradient)" opacity="0.7" />
                <path d="M28 19.67C27.95 20.27 27.5 20.84 26.65 21.35C25.33 22.15 23.23 22.78 20.67 23.2C19.32 23.42 17.75 23.56 16.03 23.57C15.93 23.57 15.93 23.57 15.83 23.57C14.1 23.56 12.52 23.42 11.17 23.2C8.6 22.78 6.5 22.15 5.18 21.35C4.38 20.87 3.96 20.34 3.86 19.77C3.84 19.95 3.84 20.14 3.84 20.34C3.84 23.29 9.21 25.67 15.83 25.67C22.46 25.67 27.83 23.29 27.83 20.34C27.83 20.1 27.8 19.88 27.76 19.66C27.87 19.66 27.94 19.67 28 19.67Z" fill="url(#logoGradient)" opacity="0.5" />
            </svg>
            {showText && (
                <span style={{
                    fontWeight: '800',
                    fontSize: '1.2rem',
                    background: 'linear-gradient(to right, #818cf8, #c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.5px'
                }}>
                    DB Designer
                </span>
            )}
        </div>
    );
}
