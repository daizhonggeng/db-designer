import React, { useState, useEffect } from 'react';
import { useSettings } from '../store/settingsStore';
import { generateSchemaSQL } from '../utils/sqlGenerator';

export default function ExportModal({ onClose, schema }) {
    const { dbDialect } = useSettings();
    const [sql, setSql] = useState('');

    useEffect(() => {
        const generated = generateSchemaSQL(schema, dbDialect);
        setSql(generated);
    }, [dbDialect, schema]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sql);
        alert('SQL 已复制到剪贴板！');
    };

    const downloadSQL = () => {
        const blob = new Blob([sql], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schema-${dbDialect}-${new Date().getTime()}.sql`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '600px', maxHeight: '80vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ color: 'var(--accent-primary)' }}>导出 SQL ({dbDialect === 'mysql' ? 'MySQL' : dbDialect === 'postgresql' ? 'PostgreSQL' : 'Oracle'})</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <textarea
                    value={sql}
                    readOnly
                    style={{
                        width: '100%',
                        height: '300px',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        marginBottom: '1rem'
                    }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="btn" onClick={copyToClipboard}>📋 复制</button>
                    <button className="btn" onClick={downloadSQL}>💾 下载 .sql</button>
                </div>
            </div>
        </div>
    );
}
