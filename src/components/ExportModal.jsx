import React, { useMemo } from 'react';
import { useSettings } from '../store/settingsStore';
import { generateSchemaSQL } from '../utils/sqlGenerator';

export default function ExportModal({ onClose, schema }) {
    const { dbDialect } = useSettings();
    const result = useMemo(() => {
        try {
            return { sql: generateSchemaSQL(schema, dbDialect), error: '' };
        } catch (error) {
            return { sql: '', error: error.message || '生成 SQL 失败' };
        }
    }, [dbDialect, schema]);
    const { sql, error } = result;
    const dialectLabel = dbDialect === 'mysql' ? 'MySQL' : dbDialect === 'postgresql' ? 'PostgreSQL' : 'Oracle';

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
            <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ width: '680px', maxWidth: '92vw', maxHeight: '84vh', borderRadius: '24px', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <span className="ui-kicker">Schema Export</span>
                        <div>
                            <h2 className="panel-heading" style={{ margin: 0, color: 'var(--text-primary)' }}>导出 SQL</h2>
                            <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)' }}>
                                当前按 <span style={{ color: 'var(--accent-primary)' }}>{dialectLabel}</span> 方言生成，可直接复制或落盘。
                            </p>
                        </div>
                    </div>
                    <button className="btn" onClick={onClose}>&times;</button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="project-badge">{dialectLabel}</span>
                    <span className="project-badge">{sql.split('\n').filter(Boolean).length} 行</span>
                </div>

                {error && <p className="inline-error" role="alert">{error}</p>}
                <textarea value={sql} readOnly className="ui-textarea" style={{ minHeight: '360px' }} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="btn" onClick={copyToClipboard} disabled={!!error}>📋 复制</button>
                    <button className="btn btn-primary" onClick={downloadSQL} disabled={!!error}>💾 下载 .sql</button>
                </div>
            </div>
        </div>
    );
}
