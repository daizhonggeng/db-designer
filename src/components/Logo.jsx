import React from 'react';

export default function Logo({ size = 32, showText = true }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#5ad1c3" />
                        <stop offset="55%" stopColor="#77d2c4" />
                        <stop offset="100%" stopColor="#f2b66d" />
                    </linearGradient>
                </defs>
                <path d="M16 3.8C9.55 3.8 4.3 6.18 4.3 9.12C4.3 12.06 9.55 14.44 16 14.44C22.45 14.44 27.7 12.06 27.7 9.12C27.7 6.18 22.45 3.8 16 3.8ZM16 12.2C10.48 12.2 6.34 10.56 6.08 8.78C6.8 10.62 10.91 11.93 16 11.93C21.09 11.93 25.2 10.62 25.92 8.78C25.66 10.56 21.52 12.2 16 12.2Z" fill="url(#logoGradient)" opacity="0.95" />
                <path d="M27.7 14.38C27.7 17.53 22.45 19.77 16 19.77C9.55 19.77 4.3 17.53 4.3 14.38C4.3 14.23 4.31 14.09 4.34 13.94C5.09 16.66 10.98 18.53 16 18.53C21.02 18.53 26.91 16.66 27.66 13.94C27.69 14.09 27.7 14.23 27.7 14.38Z" fill="url(#logoGradient)" opacity="0.72" />
                <path d="M27.7 20.12C27.7 23.27 22.45 25.6 16 25.6C9.55 25.6 4.3 23.27 4.3 20.12C4.3 19.97 4.31 19.83 4.34 19.67C5.09 22.4 10.98 24.26 16 24.26C21.02 24.26 26.91 22.4 27.66 19.67C27.69 19.83 27.7 19.97 27.7 20.12Z" fill="url(#logoGradient)" opacity="0.48" />
                <path d="M23.9 5.4L26.8 2.6" stroke="#f2b66d" strokeWidth="1.4" strokeLinecap="round" opacity="0.65" />
                <circle cx="27.4" cy="2.2" r="1.2" fill="#f2b66d" opacity="0.75" />
            </svg>
            {showText && (
                <span style={{
                    fontFamily: 'Bahnschrift, "Segoe UI Variable Display", "Segoe UI", sans-serif',
                    fontWeight: '700',
                    fontSize: '1.12rem',
                    background: 'linear-gradient(92deg, var(--accent-primary), var(--accent-secondary))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                }}>
                    Db Designer
                </span>
            )}
        </div>
    );
}
