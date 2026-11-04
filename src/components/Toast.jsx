import React, { useEffect } from 'react';
import Icon from './Icon';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
    useEffect(() => { const timer = setTimeout(onClose, duration); return () => clearTimeout(timer); }, [onClose, duration]);
    return <div className={`toast ${type === 'error' ? 'is-error' : ''}`} role={type === 'error' ? 'alert' : 'status'}><Icon name={type === 'error' ? 'info' : 'check'} size={17} />{message}</div>;
}
