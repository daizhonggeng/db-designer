import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function AuthPage({ type }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

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
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-gradient)'
        }}>
            <div className="glass" style={{ padding: '3rem', width: '400px', borderRadius: 'var(--radius-lg)' }}>
                <h2 style={{ color: 'var(--accent-primary)', marginBottom: '2rem', textAlign: 'center' }}>
                    {type === 'login' ? '欢迎回来' : '注册账号'}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="用户名"
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        style={{
                            padding: '0.8rem',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'white'
                        }}
                    />
                    <input
                        type="password"
                        placeholder="密码"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        style={{
                            padding: '0.8rem',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'white'
                        }}
                    />

                    {error && <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</div>}

                    <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        {type === 'login' ? '登录' : '注册'}
                    </button>
                </form>

                <p style={{ marginTop: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {type === 'login' ? '还没有账号？' : '已有账号？'}
                    <a
                        href={type === 'login' ? '/register' : '/login'}
                        style={{ color: 'var(--accent-secondary)', marginLeft: '0.5rem' }}
                    >
                        {type === 'login' ? '去注册' : '去登录'}
                    </a>
                </p>
            </div>
        </div>
    );
}
