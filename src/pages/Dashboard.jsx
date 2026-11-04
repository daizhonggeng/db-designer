import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, apiPut } from '../services/api';
import { clearStoredUser, getStoredUser } from '../utils/storage';
import Logo from '../components/Logo';
import Toast from '../components/Toast';
import ProjectPresetModal from '../components/ProjectPresetModal';
import { createOrderExample, mostRecentProject, parseProjectFile } from '../utils/projectData';

function formatDateLabel(value) {
    return new Date(value).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
    });
}

function getProjectCardTone(type) {
    if (type === 'my') {
        return { badge: '我创建的', note: '可管理', accent: 'var(--accent-primary)' };
    }
    if (type === 'collaborated') {
        return { badge: '协作', note: '成员视角', accent: 'var(--accent-tertiary)' };
    }
    return { badge: '开放', note: '待申请', accent: 'var(--accent-secondary)' };
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [myProjects, setMyProjects] = useState([]);
    const [collaboratedProjects, setCollaboratedProjects] = useState([]);
    const [availableProjects, setAvailableProjects] = useState([]);
    const [showRequestsModal, setShowRequestsModal] = useState(null);
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [newProjectPreset, setNewProjectPreset] = useState(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [createError, setCreateError] = useState('');
    const [template, setTemplate] = useState('blank');
    const [imported, setImported] = useState(null);
    const [toast, setToast] = useState(null);
    const importRef = useRef(null);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [my, collab, avail] = await Promise.all([
                apiGet('/api/projects/my-created'),
                apiGet('/api/projects/my-collaborated'),
                apiGet('/api/projects/available'),
            ]);
            setMyProjects(my);
            setCollaboratedProjects(collab);
            setAvailableProjects(avail);
        } catch (err) {
            setLoadError(err.message || '无法加载项目，请检查后端服务');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const currentUser = getStoredUser();
        if (!currentUser) { navigate('/login'); return; }
        setUser(currentUser);
        loadProjects();
    }, [navigate, loadProjects]);

    const summaryStats = useMemo(() => {
        const totalProjects = myProjects.length + collaboratedProjects.length;
        const pendingRequests = myProjects.reduce((total, project) => total + Number(project.pending_requests || 0), 0);

        return [
            { label: '我的项目', value: totalProjects, accent: 'var(--accent-primary)' },
            { label: '我创建的', value: myProjects.length, accent: 'var(--accent-tertiary)' },
            { label: '协作中', value: collaboratedProjects.length, accent: 'var(--accent-success)' },
            { label: '待处理申请', value: pendingRequests, accent: 'var(--accent-secondary)' },
        ];
    }, [collaboratedProjects.length, myProjects]);

    const filteredSections = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const filterProjects = (projects) => {
            if (!normalizedSearch) {
                return projects;
            }
            return projects.filter((project) => project.name.toLowerCase().includes(normalizedSearch));
        };

        return {
            my: filterProjects(myProjects),
            collaborated: filterProjects(collaboratedProjects),
            available: filterProjects(availableProjects),
        };
    }, [availableProjects, collaboratedProjects, myProjects, searchTerm]);

    const recentProject = useMemo(() => {
        const accessible = [...myProjects, ...collaboratedProjects];
        try { return mostRecentProject(accessible, user?.id); } catch { return accessible[0] || null; }
    }, [myProjects, collaboratedProjects, user?.id]);

    const openCreateModal = (selected = 'blank') => {
        setNewProjectPreset(null);
        setTemplate(selected);
        setNewProjectName(selected === 'orders' ? '订单系统示例' : '');
        setImported(null);
        setCreateError('');
        setShowCreateModal(true);
    };

    const importProject = async event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        try {
            const parsed = parseProjectFile(await file.text());
            openCreateModal('import');
            setImported(parsed);
            setNewProjectPreset(parsed.schema.designPreset || null);
            setNewProjectName(parsed.name || file.name.replace(/\.json$/i, ''));
        } catch (error) {
            setToast({ message: error.message, type: 'error' });
        }
    };

    const createProject = async () => {
        const name = newProjectName.trim();
        if (!name) {
            setCreateError('请输入项目名称');
            return;
        }

        try {
            setCreateLoading(true);
            const baseSchema = template === 'orders' ? createOrderExample() : template === 'import' ? imported.schema : { tables: [], relationships: [], bookmarks: [] };
            const schema = { ...baseSchema, designPreset: newProjectPreset };
            const newProject = await apiPost('/api/projects', { name, schema });
            if (!newProject.id) {
                throw new Error('返回的项目数据无效');
            }
            setShowCreateModal(false);
            navigate(`/editor/${newProject.id}`);
        } catch (err) {
            console.error('Create project error:', err);
            setCreateError('创建项目失败：' + err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const deleteProject = async (projectId, projectName, event) => {
        event.stopPropagation();
        if (!confirm(`确定要删除项目 "${projectName}" 吗？此操作不可恢复！`)) return;

        try {
            await apiDelete(`/api/projects/${projectId}`);
            loadProjects(user.id);
            setToast({ message: '项目已删除', type: 'success' });
        } catch (err) {
            setToast({ message: '删除失败：' + err.message, type: 'error' });
        }
    };

    const requestJoin = async (projectId, event) => {
        event.stopPropagation();
        const message = prompt('请输入申请理由（可选）:');
        if (message === null) return;
        try {
            await apiPost(`/api/projects/${projectId}/request`, { message });
            setToast({ message: '申请已提交，等待项目创建者审批', type: 'success' });
            loadProjects(user.id);
        } catch (err) {
            setToast({ message: '申请失败：' + err.message, type: 'error' });
        }
    };

    const viewRequests = async (projectId, event) => {
        event.stopPropagation();
        try {
            const data = await apiGet(`/api/projects/${projectId}/requests`);
            setRequests(data);
            setShowRequestsModal(projectId);
        } catch (err) {
            setToast({ message: '加载申请失败：' + err.message, type: 'error' });
        }
    };

    const handleRequest = async (requestId, status) => {
        try {
            await apiPut(`/api/projects/requests/${requestId}`, { status });
            setToast({ message: status === 'approved' ? '已批准申请' : '已拒绝申请', type: 'success' });
            viewRequests(showRequestsModal, { stopPropagation: () => {} });
            loadProjects(user.id);
        } catch (err) {
            setToast({ message: '操作失败：' + err.message, type: 'error' });
        }
    };

    const renderProjectCard = (project, type) => {
        const tone = getProjectCardTone(type);

        return (
            <div
                key={project.id}
                className="project-card glass dashboard-card-industrial"
                onClick={() => type !== 'available' && navigate(`/editor/${project.id}`)}
                role={type === 'available' ? undefined : 'button'}
                tabIndex={type === 'available' ? undefined : 0}
                onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); navigate(`/editor/${project.id}`); } }}
                style={{ cursor: type === 'available' ? 'default' : 'pointer' }}
            >
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                        <span className="project-badge" style={{ color: tone.accent }}>{tone.badge}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PROJECT #{project.id}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {type === 'my' && Number(project.pending_requests || 0) > 0 && (
                            <button className="btn" onClick={(event) => viewRequests(project.id, event)} style={{ padding: '0.45rem 0.75rem', minHeight: 'unset' }}>
                                {project.pending_requests} 申请
                            </button>
                        )}
                        {type === 'available' && (
                            <button
                                className="btn"
                                onClick={(event) => requestJoin(project.id, event)}
                                disabled={project.request_status === 'pending'}
                                style={{ padding: '0.45rem 0.75rem', minHeight: 'unset' }}
                            >
                                {project.request_status === 'pending' ? '待审批' : '申请加入'}
                            </button>
                        )}
                        {type === 'my' && (
                            <button className="btn" onClick={(event) => deleteProject(project.id, project.name, event)} style={{ padding: '0.45rem 0.75rem', minHeight: 'unset', color: 'var(--accent-danger)' }}>
                                删除
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '0.85rem' }}>
                    <div>
                        <h3 className="panel-heading" style={{ fontSize: '1.3rem', lineHeight: 1.05, marginBottom: '0.55rem' }}>{project.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                            {type === 'available' ? '申请通过后，即可参与这个项目的设计。' : `${project.schema_data?.tables?.length || 0} 张表 · ${project.schema_data?.relationships?.length || 0} 条关系`}
                        </p>
                    </div>
                    <div className="project-meta">
                        <span className="project-badge">更新于 {formatDateLabel(project.updated_at || project.created_at)}</span>
                        <span className="project-badge">{tone.note}</span>
                    </div>
                </div>
            </div>
        );
    };

    const renderProjectSection = (title, description, projects, type) => (
        <section className="dashboard-section">
            <div className="dashboard-section-head">
                <div>
                    <h2 className="panel-heading" style={{ fontSize: '1.08rem', marginBottom: '0.32rem' }}>{title}</h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{description}</p>
                </div>
                <div className="project-badge">{projects.length} 个项目</div>
            </div>

            {projects.length === 0 ? (
                <div className="dashboard-empty">
                    {searchTerm.trim() ? '当前筛选条件下没有项目。' : '这里还没有内容，继续创建或加入项目吧。'}
                </div>
            ) : (
                <div className="project-grid">
                    {projects.map((project) => renderProjectCard(project, type))}
                </div>
            )}
        </section>
    );

    return (
        <div className="dashboard-page dashboard-industrial">
            <div className="dashboard-shell">
                <section className="dashboard-hero glass dashboard-hero-industrial">
                    <div className="dashboard-hero-industrial-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <Logo size={34} showText={true} />
                            <span className="ui-kicker">项目工作台</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="project-badge">{user?.username}</span>
                            <button className="btn" onClick={() => { clearStoredUser(); navigate('/login'); }}>退出</button>
                        </div>
                    </div>

                    <div className="dashboard-grid dashboard-grid-industrial">
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <h1 className="panel-heading" style={{ fontSize: '2.7rem', lineHeight: 0.96, marginBottom: '0.7rem' }}>
                                    数据库工作台
                                </h1>
                                <p style={{ maxWidth: '48rem', color: 'var(--text-secondary)', lineHeight: 1.85 }}>
                                    从空白画布开始设计，或打开订单示例，了解表、字段和关系如何一起工作。
                                </p>
                            </div>

                            <div className="dashboard-command-row">
                                <button className="btn btn-primary" onClick={() => openCreateModal()}>+ 新建项目</button>
                                <button className="btn" onClick={() => recentProject && navigate(`/editor/${recentProject.id}`)} disabled={!recentProject} title={recentProject?.name}>继续上次编辑</button>
                                <button className="btn" onClick={() => importRef.current.click()}>导入项目备份</button>
                                <div className="dashboard-search-shell">
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="搜索项目名"
                                        aria-label="搜索项目名"
                                        className="dashboard-search-input"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-stat-grid dashboard-stat-grid-industrial">
                            {summaryStats.map((item) => (
                                <div key={item.label} className="dashboard-stat-card dashboard-stat-card-industrial">
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{item.label}</div>
                                    <div style={{ marginTop: '0.45rem', fontSize: '1.9rem', fontWeight: '800', color: item.accent }}>
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {loading ? <div className="dashboard-empty" role="status">正在加载项目…</div> : loadError ? <div className="dashboard-empty" role="alert"><p>{loadError}</p><button className="btn" onClick={loadProjects}>重新加载</button></div> : <>
                    {!myProjects.length && !collaboratedProjects.length && !searchTerm && <section className="welcome-panel glass">
                        <div><span className="ui-kicker">开始设计</span><h2>你的第一张关系图，从这里开始</h2><p>可以先用订单示例体验编辑、自动保存和 SQL 导出，也可以直接创建空白项目。</p></div>
                        <div className="starter-actions"><button className="starter-card" onClick={() => openCreateModal('orders')}><strong>体验订单示例 →</strong><span>客户、订单、订单明细 · 3 张表，2 条关系</span></button><button className="starter-card" onClick={() => openCreateModal()}><strong>创建空白项目 →</strong><span>从第一张数据表开始，自由搭建结构</span></button></div>
                    </section>}
                    {(myProjects.length > 0 || searchTerm) && renderProjectSection('我创建的项目', '继续设计，或管理项目和协作申请。', filteredSections.my, 'my')}
                    {collaboratedProjects.length > 0 && renderProjectSection('我协作的项目', '和团队一起完善数据库设计。', filteredSections.collaborated, 'collaborated')}
                    {availableProjects.length > 0 && renderProjectSection('可加入的项目', '申请加入其他成员的项目。', filteredSections.available, 'available')}
                </>}
            </div>
            <input ref={importRef} type="file" accept=".json,application/json" onChange={importProject} hidden />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content glass" onClick={(event) => event.stopPropagation()} style={{ width: '520px', maxWidth: '94vw', borderRadius: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <span className="ui-kicker">Create Project</span>
                                <h2 className="panel-heading" style={{ fontSize: '1.24rem', margin: '0.65rem 0 0.3rem' }}>新建数据库项目</h2>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>选择起点，输入名称，即可开始设计。</p>
                            </div>
                            <button className="btn" onClick={() => setShowCreateModal(false)}>&times;</button>
                        </div>

                        <div className="template-choices" role="group" aria-label="选择项目起点">
                            <button className={`starter-card ${template === 'blank' ? 'is-selected' : ''}`} onClick={() => setTemplate('blank')}><strong>空白项目</strong><span>自由搭建数据结构</span></button>
                            <button className={`starter-card ${template === 'orders' ? 'is-selected' : ''}`} onClick={() => { setTemplate('orders'); if (!newProjectName) setNewProjectName('订单系统示例'); }}><strong>订单示例</strong><span>3 张表 · 2 条关系</span></button>
                            {imported && <button className={`starter-card ${template === 'import' ? 'is-selected' : ''}`} onClick={() => setTemplate('import')}><strong>导入的备份</strong><span>{imported.schema.tables.length} 张表</span></button>}
                        </div>
                        <label className="form-label">项目名称<input
                            aria-label="项目名称"
                            maxLength={100}
                            value={newProjectName}
                            onChange={(event) => setNewProjectName(event.target.value)}
                            placeholder="例如：会员中心、订单平台、资产台账"
                            className="ui-input"
                            autoFocus
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !createLoading) {
                                    createProject();
                                }
                            }}
                        /></label>
                        <button className="btn" onClick={() => setShowPresetModal(true)} disabled={createLoading}>📋 配置规范预设{newProjectPreset?.rules ? ' ✓' : '（可选）'}</button>
                        {createError && <p role="alert" className="inline-error">{createError}</p>}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.15rem' }}>
                            <button className="btn" onClick={() => setShowCreateModal(false)} disabled={createLoading}>取消</button>
                            <button className="btn btn-primary" onClick={createProject} disabled={createLoading || !newProjectName.trim()}>
                                {createLoading ? '创建中...' : '创建并进入'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPresetModal && <ProjectPresetModal initialPreset={newProjectPreset} onSave={async ({ preset }) => { setNewProjectPreset(preset); setShowPresetModal(false); }} onClose={() => setShowPresetModal(false)} />}

            {showRequestsModal && (
                <div className="modal-overlay" onClick={() => setShowRequestsModal(null)}>
                    <div className="modal-content glass" onClick={(event) => event.stopPropagation()} style={{ width: '620px', maxHeight: '82vh', borderRadius: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <span className="ui-kicker">Access Requests</span>
                                <h2 className="panel-heading" style={{ fontSize: '1.18rem', margin: '0.6rem 0 0.28rem' }}>协作申请</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>审批其他成员加入你创建的项目。</p>
                            </div>
                            <button className="btn" onClick={() => setShowRequestsModal(null)}>&times;</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', overflowY: 'auto' }}>
                            {requests.length === 0 ? (
                                <div className="dashboard-empty">暂无申请</div>
                            ) : (
                                requests.map((req) => (
                                    <div key={req.id} className="ui-card" style={{ padding: '1rem', borderRadius: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.55rem' }}>
                                            <strong style={{ color: 'var(--text-primary)' }}>{req.username}</strong>
                                            <span className="project-badge" style={{ color: req.status === 'pending' ? 'var(--accent-secondary)' : req.status === 'approved' ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                                {req.status === 'pending' ? '待审批' : req.status === 'approved' ? '已批准' : '已拒绝'}
                                            </span>
                                        </div>
                                        {req.message && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.55rem' }}>{req.message}</p>}
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: req.status === 'pending' ? '0.8rem' : 0 }}>
                                            {new Date(req.created_at).toLocaleString()}
                                        </div>
                                        {req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                                                <button className="btn" style={{ flex: 1, color: 'var(--accent-success)' }} onClick={() => handleRequest(req.id, 'approved')}>批准</button>
                                                <button className="btn" style={{ flex: 1, color: 'var(--accent-danger)' }} onClick={() => handleRequest(req.id, 'rejected')}>拒绝</button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
