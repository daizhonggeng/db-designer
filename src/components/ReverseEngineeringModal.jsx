import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { SCRIPTS } from '../utils/reveng/sqlScripts';
import { parseReverseEngResult } from '../utils/reveng/parser';
import { useSchema } from '../store/schemaStore';
import { API_BASE_URL } from '../config';

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
            const res = await fetch(`${API_BASE_URL}/api/db/introspect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'postgresql', config: connConfig })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '连接失败');
            }
            const data = await res.json();
            const schema = parseReverseEngResult(JSON.stringify(data));
            dispatch({ type: 'APPEND_SCHEMA', payload: schema });
            onClose();
            alert(`成功导入 ${schema.tables.length} 张表！`);
        } catch (err) {
            setError(err.message);
        }
    };

    return ReactDOM.createPortal(
        <div className="glass" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)', background: 'rgba(0,0,0,0.6)'
        }} onClick={onClose}>
            <div style={{
                width: '900px', height: '80vh', background: 'var(--bg-panel)',
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)',
                display: 'flex', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }} onClick={e => e.stopPropagation()}>

                {/* Sidebar */}
                <div style={{ width: '200px', background: 'rgba(0,0,0,0.2)', borderRight: '1px solid var(--glass-border)', padding: '1rem' }}>
                    <h3 style={{ color: 'var(--accent-primary)', marginTop: 0 }}>数据库逆向</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '1rem' }}>
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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto' }}>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', marginBottom: '1rem' }}>
                        <button
                            style={{
                                padding: '0.5rem 1rem', background: 'transparent', border: 'none',
                                borderBottom: activeTab === 'script' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                color: activeTab === 'script' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer', fontSize: '1rem'
                            }}
                            onClick={() => setActiveTab('script')}
                        >
                            📜 SQL 脚本导入
                        </button>
                        <button
                            style={{
                                padding: '0.5rem 1rem', background: 'transparent', border: 'none',
                                borderBottom: activeTab === 'direct' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                color: activeTab === 'direct' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer', fontSize: '1rem'
                            }}
                            onClick={() => setActiveTab('direct')}
                        >
                            🔌 直接连接
                        </button>
                    </div>

                    {activeTab === 'script' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa' }}>第一步：执行查询</h4>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    {SCRIPTS[dbType].description}
                                </p>
                                <div style={{ position: 'relative', marginTop: '8px' }}>
                                    <pre style={{
                                        maxHeight: '150px', overflow: 'auto', background: 'rgba(0,0,0,0.3)',
                                        padding: '8px', borderRadius: '4px', fontSize: '12px', color: '#a5f3fc'
                                    }}>
                                        {SCRIPTS[dbType].query}
                                    </pre>
                                    <button
                                        onClick={handleCopyScript}
                                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                                    >
                                        复制 SQL
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                <h4 style={{ margin: 0, color: '#60a5fa' }}>第二步：粘贴结果</h4>
                                <textarea
                                    value={jsonResult}
                                    onChange={(e) => { setJsonResult(e.target.value); setError(null); }}
                                    placeholder="在此处粘贴查询结果 (JSON 格式)..."
                                    style={{
                                        flex: 1, minHeight: '150px',
                                        background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)',
                                        color: 'var(--text-primary)', padding: '1rem', borderRadius: '4px',
                                        resize: 'none', fontFamily: 'monospace'
                                    }}
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
                                    padding: '2rem', border: '1px solid var(--glass-border)', borderRadius: '12px',
                                    textAlign: 'left', width: '100%', maxWidth: '500px', background: 'rgba(0,0,0,0.2)',
                                    display: 'flex', flexDirection: 'column', gap: '1rem'
                                }}>
                                    <h3 style={{ margin: 0, textAlign: 'center' }}>🐘 PostgreSQL 连接</h3>

                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Host</label>
                                        <input className="input" style={{ width: '100%' }} value={connConfig.host} onChange={e => setConnConfig({ ...connConfig, host: e.target.value })} placeholder="localhost" />
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Port</label>
                                            <input className="input" style={{ width: '100%' }} value={connConfig.port} onChange={e => setConnConfig({ ...connConfig, port: e.target.value })} placeholder="5432" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Database</label>
                                            <input className="input" style={{ width: '100%' }} value={connConfig.database} onChange={e => setConnConfig({ ...connConfig, database: e.target.value })} placeholder="mydb" />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>User</label>
                                            <input className="input" style={{ width: '100%' }} value={connConfig.user} onChange={e => setConnConfig({ ...connConfig, user: e.target.value })} placeholder="postgres" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
                                            <input className="input" type="password" style={{ width: '100%' }} value={connConfig.password} onChange={e => setConnConfig({ ...connConfig, password: e.target.value })} />
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
