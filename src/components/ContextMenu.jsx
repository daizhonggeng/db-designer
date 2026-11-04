import React from 'react';
import Icon from './Icon';

export default function ContextMenu({ x, y, options, onClose }) {
    if (!options?.length) return null;
    return <div className="context-menu dropdown-panel" style={{ position: 'fixed', top: y, left: x, zIndex: 10000 }} onClick={event => event.stopPropagation()}>{options.map((option, index) => <button className="btn btn-ghost" key={index} style={{ color: option.danger ? 'var(--accent-danger)' : undefined }} onClick={event => { event.stopPropagation(); option.action(); onClose(); }}><Icon name={option.danger ? 'trash' : option.label.includes('复制') || option.label.includes('粘贴') ? 'copy' : option.label.includes('编辑') ? 'edit' : option.label.includes('SQL') ? 'file' : 'table'} size={14} />{option.label}</button>)}</div>;
}
