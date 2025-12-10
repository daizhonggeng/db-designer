export const DOPAMINE_COLORS = [
    { name: 'Default', value: 'rgba(255, 255, 255, 0.05)', border: 'var(--glass-border)' },
    { name: 'Neon Pink', value: '#FF6AC1', border: '#FF6AC1' },
    { name: 'Bright Yellow', value: '#FFE66D', border: '#FFE66D' },
    { name: 'Electric Blue', value: '#4D96FF', border: '#4D96FF' },
    { name: 'Lime Green', value: '#6BCB77', border: '#6BCB77' },
    { name: 'Vibrant Purple', value: '#9D4EDD', border: '#9D4EDD' },
    { name: 'Sunset Orange', value: '#FF9F1C', border: '#FF9F1C' },
    { name: 'Cyan', value: '#00F5FF', border: '#00F5FF' },
];

export const hexToRgba = (hex, alpha = 1) => {
    if (typeof hex !== 'string') return hex;
    if (!hex.startsWith('#')) return hex; // Already rgba or var
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
};
