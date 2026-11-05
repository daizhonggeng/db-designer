import React, { useCallback, useEffect, useState } from 'react';
import { getAIProfiles, saveAIProfiles } from '../services/aiService';
import { activateAIProfile, validateAIProfile } from '../utils/aiProfiles';
import AISettingsModal from './AISettingsModal';
import Icon from './Icon';
import './AIProfilesPanel.css';

export default function AIProfilesPanel() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [editor, setEditor] = useState(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        getAIProfiles()
            .then(items => { if (alive) { setProfiles(items); setError(''); } })
            .catch(failure => { if (alive) setError(failure.message || '加载配置失败'); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [attempt]);

    const persist = useCallback(async next => {
        setSaving(true);
        setError('');
        setNotice('');
        try {
            await saveAIProfiles(next);
            setProfiles(next);
        } finally {
            setSaving(false);
        }
    }, []);

    const activate = async profile => {
        if (saving || profile.active) return;
        try {
            await persist(activateAIProfile(profiles, profile.id));
            setNotice(`已启用「${profile.name}」`);
        } catch (failure) {
            setError(failure.message || '切换失败，请重试');
        }
    };

    const remove = async profile => {
        if (profile.active || saving || !window.confirm(`删除配置「${profile.name}」？`)) return;
        try {
            await persist(profiles.filter(item => item.id !== profile.id));
            setNotice('配置已删除');
        } catch (failure) {
            setError(failure.message || '删除失败，请重试');
        }
    };

    const add = () => setEditor({
        isNew: true,
        profile: {
            id: crypto.randomUUID(),
            name: '',
            active: profiles.length === 0,
            settings: { apiUrl: 'https://api.openai.com/v1', apiKey: '', modelText: '', modelVision: '' },
        },
    });

    const save = async draft => {
        const profile = validateAIProfile(draft);
        const next = editor.isNew
            ? [...profiles, profile]
            : profiles.map(item => item.id === profile.id ? profile : item);
        await persist(next);
        setEditor(null);
        setNotice('配置已保存');
    };

    return <section className="ai-profiles-panel">
        <div className="workspace-heading">
            <div><h1>AI 配置</h1><p>管理账号下的模型配置，单选一项立即生效。</p></div>
            <button className="btn btn-primary" onClick={add} disabled={loading || saving || !!error && !profiles.length}>
                <Icon name="plus" size={16} />新增配置
            </button>
        </div>
        {error && <div className="auth-error-box" role="alert"><Icon name="info" size={16} />{error}
            {!profiles.length && <button className="btn" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>重新加载</button>}
        </div>}
        {notice && <p className="ai-profiles-notice" role="status"><Icon name="check" size={15} />{notice}</p>}
        {loading ? <div className="dashboard-empty" role="status">正在加载账号配置…</div> : !profiles.length && !error ?
            <div className="dashboard-empty ai-profiles-empty"><Icon name="sparkle" size={29} />
                <h2>还没有 AI 配置</h2><p>点击“新增配置”填写接口和模型。第一项保存后自动生效。</p>
                <button className="btn" onClick={add}><Icon name="plus" size={15} />新增配置</button>
            </div> : profiles.length > 0 && <>
                <div className="ai-profiles-table-wrap"><table className="ai-profiles-table">
                    <caption className="sr-only">AI 配置列表，只能启用一个配置</caption>
                    <thead><tr><th scope="col">生效</th><th scope="col">配置名称</th><th scope="col">接口地址</th><th scope="col">文字模型</th><th scope="col">图片模型</th><th scope="col">操作</th></tr></thead>
                    <tbody>{profiles.map(profile => <tr key={profile.id} className={profile.active ? 'is-active' : ''}>
                        <td><input type="radio" name="active-ai-profile" aria-label={`启用 ${profile.name}`} checked={profile.active} onChange={() => activate(profile)} disabled={saving} /></td>
                        <th scope="row">{profile.name}{profile.active && <span className="ai-profile-active">已生效</span>}</th>
                        <td className="ai-profile-url" title={profile.settings.apiUrl}>{profile.settings.apiUrl}</td>
                        <td><code>{profile.settings.modelText || '未填写'}</code></td>
                        <td><code>{profile.settings.modelVision || '未填写'}</code></td>
                        <td><div className="session-actions">
                            <button className="btn btn-ghost" disabled={saving} onClick={() => setEditor({ isNew: false, profile: { ...profile, settings: { ...profile.settings } } })}><Icon name="edit" size={14} />编辑</button>
                            <button className="icon-button is-danger" aria-label={`删除 ${profile.name}`} title={profile.active ? '请先启用其他配置，再删除这一项' : '删除配置'} disabled={saving || profile.active} onClick={() => remove(profile)}><Icon name="trash" size={14} /></button>
                        </div></td>
                    </tr>)}</tbody>
                </table></div>
                <p className="ai-profiles-hint">{saving ? '正在保存配置…' : `共 ${profiles.length} 项配置。切换生效项后，AI 设计和规范总结会使用该配置。`}</p>
            </>}
        {editor && <AISettingsModal key={editor.profile.id} profile={editor.profile} isNew={editor.isNew} onSave={save} onClose={() => setEditor(null)} />}
    </section>;
}
