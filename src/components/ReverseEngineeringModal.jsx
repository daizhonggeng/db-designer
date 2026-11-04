import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { SCRIPTS } from '../utils/reveng/sqlScripts';
import { parseReverseEngResult } from '../utils/reveng/parser';
import { useSchema } from '../store/schemaStore';
import { apiPost } from '../services/api';

export default function ReverseEngineeringModal({ onClose }) {
    const { dispatch } = useSchema();
    const [activeTab, setActiveTab] = useState('script'); // 'script' | 'direct'
    const [dbType, setDbType] = useState('mysql'); // 'mysql', 'postgresql', 'oracle'
    const [jsonResult, setJsonResult] = useState('');
    const [error, setError] = useState(null);

    // Direct Mode State
    const [connConfig, setConnConfig] = useState({
        host: 'localhost',
        port: '5432',
        database: '',
        user: '',
        password: ''
    });

    const handleImportScript = () => {
        try {
            if (!jsonResult.trim()) throw new Error('请输入查询结果 JSON');
            const schema = parseReverseEngResult(jsonResult);
            // Import into current project
            dispatch({ type: 'APPEND_SCHEMA', payload: schema });
            onClose();
            alert(`成功导入 ${schema.tables.length} 张表！`);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCopyScript = () => {
        navigator.clipboard.writeText(SCRIPTS[dbType].query);
        alert('SQL 脚本已复制到剪贴板');
    };

    const handleDirectImport = async () => {
        try {
            setError(null);
            const data = await apiPost('/api/db/introspect', { type: 'postgresql', config: connConfig });
            const schema = parseReverseEngResult(JSON.stringify(data));
            dispatch({ type: 'APPEND_SCHEMA', payload: schema });
            onClose();
            alert(`成功导入 ${schema.tables.length} 张表！`);
        } catch (err) {
            setError(err.message);
        }
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" style={{ zIndex: 2000, padding: '1rem' }} onClick={onClose}>
            <div className="glass" style={{
                width: '980px', maxWidth: '96vw', height: '82vh', background: 'var(--bg-panel)',
                borderRadius: '26px', border: '1px solid var(--glass-border)',
                display: 'flex', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
            }} onClick={e => e.stopPropagation()}>

                {/* Sidebar */}
                <div style={{ width: '230px', background: 'rgba(0,0,0,0.18)', borderRight: '1px solid var(--glass-border)', padding: '1.1rem', display: 'grid', alignContent: 'start', gap: '1rem' }}>
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                        <span className="ui-kicker">Reverse Engineering</span>
                        <h3 className="panel-heading" style={{ color: 'var(--text-primary)', marginTop: 0 }}>数据库逆向</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                            先选数据库，再决定走脚本导入还是直连采集。
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.keys(SCRIPTS).map(type => (
                            <button
                                key={type}
                                onClick={() => { setDbType(type); setError(null); }}
                                className={`btn ${dbType === type ? 'btn-primary' : ''}`}
                                style={{ justifyContent: 'flex-start', textAlign: 'left', opacity: dbType === type ? 1 : 0.7 }}
                            >
                                {type === 'mysql' && '🐬'}
                                {type === 'postgresql' && '🐘'}
                                {type === 'oracle' && '☕'}
                                {' ' + type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.35rem', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <h3 className="panel-heading" style={{ margin: 0 }}>导入数据库结构</h3>
                            <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)' }}>
                                选择适合当前环境的采集方式，把现有库表结构带回设计画布。
                            </p>
                        </div>
                        <button className="btn" onClick={onClose}>&times;</button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <button
                            className={`ui-tab ${activeTab === 'script' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('script')}
                        >
                            📜 SQL 脚本导入
                        </button>
                        <button
                            className={`ui-tab ${activeTab === 'direct' ? 'is-active' : ''}`}
                            onClick={() => setActiveTab('direct')}
                        >
                            🔌 直接连接
                        </button>
                    </div>

                    {activeTab === 'script' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            <div className="ui-card" style={{ padding: '1rem' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-primary)' }}>第一步：执行查询</h4>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    {SCRIPTS[dbType].description}
                                </p>
                                <div style={{ position: 'relative', marginTop: '8px' }}>
                                    <pre style={{
                                        maxHeight: '180px', overflow: 'auto', background: 'rgba(4,16,22,0.48)',
                                        padding: '12px', borderRadius: '14px', fontSize: '12px', color: '#a5f3fc',
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        {SCRIPTS[dbType].query}
                                    </pre>
                                    <button className="btn" onClick={handleCopyScript} style={{ position: 'absolute', top: '12px', right: '12px', padding: '0.4rem 0.7rem', fontSize: '12px' }}>
                                        复制 SQL
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                <h4 style={{ margin: 0, color: 'var(--accent-primary)' }}>第二步：粘贴结果</h4>
                                <textarea
                                    value={jsonResult}
                                    onChange={(e) => { setJsonResult(e.target.value); setError(null); }}
                                    placeholder="在此处粘贴查询结果 (JSON 格式)..."
                                    className="ui-textarea"
                                    style={{ flex: 1, minHeight: '220px' }}
                                />
                            </div>

                            {error && <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>❌ {error}</div>}

                            <div style={{ display: 'flex', justifySelf: 'flex-end', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button className="btn" onClick={onClose}>取消</button>
                                <button className="btn btn-primary" onClick={handleImportScript} disabled={!jsonResult}>
                                    开始导入
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
                            {dbType === 'postgresql' ? (
                                <div style={{
                                    padding: '2rem', border: '1px solid var(--glass-border)', borderRadius: '22px',
                                    textAlign: 'left', width: '100%', maxWidth: '560px', background: 'rgba(0,0,0,0.18)',
                                    display: 'flex', flexDirection: 'column', gap: '1rem'
                                }}>
                                    <h3 style={{ margin: 0, textAlign: 'center' }}>🐘 PostgreSQL 连接</h3>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Host</label>
                                        <input className="ui-input" value={connConfig.host} onChange={e => setConnConfig({ ...connConfig, host: e.target.value })} placeholder="localhost" />
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Port</label>
                                            <input className="ui-input" value={connConfig.port} onChange={e => setConnConfig({ ...connConfig, port: e.target.value })} placeholder="5432" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Database</label>
                                            <input className="ui-input" value={connConfig.database} onChange={e => setConnConfig({ ...connConfig, database: e.target.value })} placeholder="mydb" />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>User</label>
                                            <input className="ui-input" value={connConfig.user} onChange={e => setConnConfig({ ...connConfig, user: e.target.value })} placeholder="postgres" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
                                            <input className="ui-input" type="password" value={connConfig.password} onChange={e => setConnConfig({ ...connConfig, password: e.target.value })} />
                                        </div>
                                    </div>

                                    {error && <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>❌ {error}</div>}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
                                        <button className="btn" onClick={onClose}>取消</button>
                                        <button className="btn btn-primary" onClick={handleDirectImport}>
                                            连接并导入
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</div>
                                    <h3>更多数据库即将支持</h3>
                                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
                                        目前直接连接模式仅支持 PostgreSQL。请使用"SQL 脚本导入"模式来支持 MySQL 和 Oracle。
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>,
        document.body
    );
}
