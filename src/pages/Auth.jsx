import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';
import { setStoredUser } from '../utils/storage';
import Logo from '../components/Logo';

export default function AuthPage({ type }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = type === 'login' ? '/api/login' : '/api/register';

        try {
            const data = await apiPost(endpoint, formData);
            setStoredUser(data);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container auth-industrial">
            <div className="auth-grid"></div>

            <div className="auth-console glass">
                <section className="auth-console-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <Logo size={34} showText={true} />
                        <span className="ui-kicker">Industrial Console</span>
                    </div>

                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                        <h1 className="panel-heading" style={{ fontSize: '2.7rem', lineHeight: 0.96, margin: 0 }}>
                            数据库设计控制台
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, maxWidth: '34rem' }}>
                            保持结构设计、协作申请、版本存档和 AI 草图在同一套简洁界面内运转。
                        </p>
                    </div>

                    <div className="auth-console-notes">
                        <div className="auth-note-block">
                            <strong>Versioned</strong>
                            <span>项目保存、对比与回退在同一工作流里完成。</span>
                        </div>
                        <div className="auth-note-block">
                            <strong>Canvas-first</strong>
                            <span>从画布入手，拖拽表卡并逐步细化结构。</span>
                        </div>
                        <div className="auth-note-block">
                            <strong>AI-assisted</strong>
                            <span>可用文本或图片快速生成初始 schema。</span>
                        </div>
                    </div>
                </section>

                <section className="auth-card auth-card-industrial">
                    <div style={{ display: 'grid', gap: '0.45rem', marginBottom: '1.8rem' }}>
                        <span className="ui-kicker">{type === 'login' ? 'Sign In' : 'Register'}</span>
                        <h2 className="panel-heading" style={{ fontSize: '1.9rem', margin: 0 }}>
                            {type === 'login' ? '进入工作台' : '创建账号'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                            {type === 'login' ? '登录后继续当前项目与结构设计。' : '注册后即可开始创建数据库项目。'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.85rem' }}>
                        <div className="auth-input-group">
                            <span className="auth-icon">👤</span>
                            <input
                                type="text"
                                className="auth-input"
                                placeholder="用户名"
                                value={formData.username}
                                onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                                required
                            />
                        </div>
                        <div className="auth-input-group">
                            <span className="auth-icon">🔒</span>
                            <input
                                type="password"
                                className="auth-input"
                                placeholder="密码"
                                value={formData.password}
                                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                                required
                            />
                        </div>

                        {error && (
                            <div className="auth-error-box">
                                {error}
                            </div>
                        )}

                        <button className="btn-auth" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                            {loading ? '处理中...' : (type === 'login' ? '登 录' : '注 册')}
                        </button>
                    </form>

                    <div className="auth-subpanel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                                {type === 'login' ? '还没有账号？' : '已有账号？'}
                                <Link
                                    to={type === 'login' ? '/register' : '/login'}
                                    style={{ color: 'var(--accent-primary)', marginLeft: '0.5rem', textDecoration: 'none', fontWeight: 700 }}
                                >
                                    {type === 'login' ? '去注册' : '去登录'}
                                </Link>
                            </p>
                            {type === 'login' && <span className="project-badge">demo / demo123</span>}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
