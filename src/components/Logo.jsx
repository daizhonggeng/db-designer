import React from 'react';

export default function Logo({ size = 32, showText = true }) {
    return <div className="brand">
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#4263eb" />
            <path d="M10 9h5v5h-5zM18 18h5v5h-5zM9 20h4M12.5 14v3.5a3 3 0 0 0 3 3H18M18 10h5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {showText && <span>DB Designer<span className="brand-dot">.</span></span>}
    </div>;
}
