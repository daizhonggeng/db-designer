import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';
import { setStoredUser } from '../utils/storage';
import { useTheme } from '../store/themeStore';
import Logo from '../components/Logo';
import Icon from '../components/Icon';

function DesignPreview() {
    return <div className="auth-preview" aria-label="客户和订单的数据库关系示意图">
        <div className="preview-bar"><span className="preview-dots"><i /><i /><i /></span><span>订单系统 / 关系图</span><span className="preview-saved"><Icon name="check" size={12} /> 已保存</span></div>
        <div className="preview-canvas">
            <svg className="preview-lines" viewBox="0 0 560 250" preserveAspectRatio="none"><path d="M215 115C280 115 260 140 320 140" fill="none" stroke="#8c9edb" strokeWidth="1.5" /><circle cx="215" cy="115" r="3" fill="#4263eb" /><circle cx="320" cy="140" r="3" fill="#4263eb" /></svg>
            <div className="preview-table preview-customers"><div><Icon name="table" size={14} /><strong>customers</strong><span>客户</span></div><p><Icon name="key" size={12} /><b>id</b><code>integer</code></p><p><span /><b>name</b><code>varchar</code></p><p><span /><b>email</b><code>varchar</code></p></div>
            <div className="preview-table preview-orders"><div><Icon name="table" size={14} /><strong>orders</strong><span>订单</span></div><p><Icon name="key" size={12} /><b>id</b><code>integer</code></p><p><Icon name="link" size={12} /><b>customer_id</b><code>integer</code></p><p><span /><b>total_amount</b><code>decimal</code></p></div>
            <span className="preview-caption">清晰的结构，始于每一张表。</span>
        </div>
    </div>;
}

export default function AuthPage({ type }) {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const register = type === 'register';
    const handleSubmit = async event => {
        event.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await apiPost(register ? '/api/register' : '/api/login', formData);
            setStoredUser(data);
            navigate('/dashboard');
        } catch (failure) { setError(failure.message); }
        finally { setLoading(false); }
    };

    return <main className="auth-page">
        <section className="auth-story">
            <Logo size={34} />
            <div className="auth-story-content"><span className="eyebrow">为好想法，设计好结构</span><h1>从一个想法，<br />到一张清晰的关系图<span>.</span></h1><p>把数据表、字段和关系放在一起。<br />让数据库设计，成为看得见的思考。</p><DesignPreview /><div className="auth-features"><span><Icon name="table" size={16} />可视化建模</span><span><Icon name="sparkle" size={16} />AI 辅助设计</span><span><Icon name="history" size={16} />版本可追溯</span></div></div>
            <footer className="auth-story-footer">DB Designer <span>让数据结构，更有条理。</span></footer>
        </section>
        <section className="auth-form-side">
            <button className="icon-button auth-theme" onClick={toggleTheme} title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
            <div className="auth-mobile-brand"><Logo /></div>
            <div className="auth-form-wrap"><span className="eyebrow">你的下一个设计，从这里开始</span><h2>{register ? '创建你的工作空间' : '欢迎回来'}</h2><p className="auth-subtitle">{register ? '注册账号，开始第一份数据库设计。' : '登录账号，继续你的数据库设计。'}</p>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <label className="form-label">用户名<input className="ui-input" aria-label="用户名" placeholder="输入你的用户名" autoComplete="username" value={formData.username} onChange={event => setFormData({ ...formData, username: event.target.value })} required /></label>
                    <label className="form-label">密码<span className="password-field"><input className="ui-input" type={showPassword ? 'text' : 'password'} aria-label={register ? '密码（至少 6 位）' : '密码'} placeholder={register ? '设置密码，至少 6 位' : '输入密码'} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 6 : undefined} value={formData.password} onChange={event => setFormData({ ...formData, password: event.target.value })} required /><button type="button" className="icon-button" title={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(value => !value)}><Icon name="eye" size={17} /></button></span></label>
                    {error && <div className="auth-error-box" role="alert"><Icon name="info" size={16} />{error}</div>}
                    <button className="btn btn-primary auth-submit" disabled={loading}>{loading ? '请稍候…' : register ? '创建账号' : '登录工作空间'}{!loading && <Icon name="arrow" size={17} />}</button>
                </form>
                <p className="auth-switch">{register ? '已经有账号了？' : '还没有账号？'} <Link to={register ? '/login' : '/register'}>{register ? '立即登录' : '创建账号'}<Icon name="arrow" size={14} /></Link></p>
                <div className="auth-footnote"><Icon name="shield" size={15} />专注设计，每一步都有迹可循</div>
            </div>
        </section>
    </main>;
}
