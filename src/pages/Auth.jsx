import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Logo from '../components/Logo';

export default function AuthPage({ type }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = type === 'login' ? `${API_BASE_URL}/api/login` : `${API_BASE_URL}/api/register`;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Authentication failed');

            localStorage.setItem('user', JSON.stringify(data));
            // Small delay to show success state if desired, or instant redirect
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            {/* Animated Background */}
            <div className="auth-blob auth-blob-1"></div>
            <div className="auth-blob auth-blob-2"></div>
            <div className="auth-blob auth-blob-3"></div>
            <div className="auth-grid"></div>

            <div className="auth-card">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ marginBottom: '1.5rem', transform: 'scale(1.5)' }}>
                        <Logo size={48} showText={false} />
                    </div>
                    <h2 style={{
                        color: 'white',
                        fontSize: '1.8rem',
                        fontWeight: '700',
                        letterSpacing: '-1px',
                        marginBottom: '0.5rem'
                    }}>
                        {type === 'login' ? '欢迎回来' : '创建账户'}
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                        {type === 'login' ? '登录您的账户以继续' : '开启您的数据库设计之旅'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="auth-input-group">
                        <span className="auth-icon">👤</span>
                        <input
                            type="text"
                            className="auth-input"
                            placeholder="用户名"
                            value={formData.username}
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
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
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    {error && (
                        <div style={{
                            color: '#f87171',
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            marginBottom: '0.5rem',
                            textAlign: 'center'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button className="btn-auth" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                        {loading ? '处理中...' : (type === 'login' ? '登 录' : '注 册')}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    <p style={{ fontSize: '0.9rem' }}>
                        {type === 'login' ? "还没有账号？" : "已有账号？"}
                        <a
                            href={type === 'login' ? '/register' : '/login'}
                            style={{ color: '#818cf8', marginLeft: '0.5rem', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }}
                            onMouseOver={e => e.target.style.color = '#a78bfa'}
                            onMouseOut={e => e.target.style.color = '#818cf8'}
                        >
                            {type === 'login' ? '去注册' : '去登录'}
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
