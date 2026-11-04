import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, apiPut } from '../services/api';
import { clearStoredUser, getStoredUser } from '../utils/storage';
import Logo from '../components/Logo';

function formatDateLabel(value) {
    return new Date(value).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
    });
}

function getProjectCardTone(type) {
    if (type === 'my') {
        return { badge: '主控', note: '可管理', accent: 'var(--accent-primary)' };
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
    const [newProjectName, setNewProjectName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    useEffect(() => {
        const currentUser = getStoredUser();
        if (!currentUser) {
            navigate('/login');
            return;
        }
        setUser(currentUser);
        loadProjects(currentUser.id);
    }, [navigate]);

    const loadProjects = async (userId) => {
        try {
            const [my, collab, avail] = await Promise.all([
                apiGet(`/api/projects/my-created?userId=${userId}`),
                apiGet(`/api/projects/my-collaborated?userId=${userId}`),
                apiGet(`/api/projects/available?userId=${userId}`),
            ]);
            setMyProjects(my);
            setCollaboratedProjects(collab);
            setAvailableProjects(avail);
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

    const summaryStats = useMemo(() => {
        const totalProjects = myProjects.length + collaboratedProjects.length + availableProjects.length;
        const pendingRequests = myProjects.reduce((total, project) => total + Number(project.pending_requests || 0), 0);

        return [
            { label: '项目总数', value: totalProjects, accent: 'var(--accent-primary)' },
            { label: '我创建的', value: myProjects.length, accent: 'var(--accent-tertiary)' },
            { label: '协作中', value: collaboratedProjects.length, accent: 'var(--accent-success)' },
            { label: '待处理申请', value: pendingRequests, accent: 'var(--accent-secondary)' },
        ];
    }, [availableProjects.length, collaboratedProjects.length, myProjects]);

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

    const recentProjectId = useMemo(() => {
        const allProjects = [...myProjects, ...collaboratedProjects, ...availableProjects];
        if (allProjects.length === 0) {
            return null;
        }
        return [...allProjects].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0]?.id || null;
    }, [availableProjects, collaboratedProjects, myProjects]);

    const openCreateModal = () => {
        setNewProjectName('');
        setShowCreateModal(true);
    };

    const createProject = async () => {
        const name = newProjectName.trim();
        if (!name) {
            alert('请输入项目名称');
            return;
        }

        try {
            setCreateLoading(true);
            const newProject = await apiPost('/api/projects', { name });
            if (!newProject.id) {
                throw new Error('返回的项目数据无效');
            }
            setShowCreateModal(false);
            navigate(`/editor/${newProject.id}`);
        } catch (err) {
            console.error('Create project error:', err);
            alert('创建项目失败: ' + err.message);
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
            alert('删除成功！');
        } catch (err) {
            alert('删除失败: ' + err.message);
        }
    };

    const requestJoin = async (projectId, event) => {
        event.stopPropagation();
        const message = prompt('请输入申请理由（可选）:');
        try {
            await apiPost(`/api/projects/${projectId}/request`, { message });
            alert('申请已提交！');
            loadProjects(user.id);
        } catch (err) {
            alert('申请失败: ' + err.message);
        }
    };

    const viewRequests = async (projectId, event) => {
        event.stopPropagation();
        try {
            const data = await apiGet(`/api/projects/${projectId}/requests`);
            setRequests(data);
            setShowRequestsModal(projectId);
        } catch (err) {
            alert('加载申请失败: ' + err.message);
        }
    };

    const handleRequest = async (requestId, status) => {
        try {
            await apiPut(`/api/projects/requests/${requestId}`, { status });
            alert(status === 'approved' ? '已批准！' : '已拒绝！');
            viewRequests(showRequestsModal, { stopPropagation: () => {} });
            loadProjects(user.id);
        } catch (err) {
            alert('操作失败: ' + err.message);
        }
    };

    const renderProjectCard = (project, type) => {
        const tone = getProjectCardTone(type);

        return (
            <div
                key={project.id}
                className="project-card glass dashboard-card-industrial"
                onClick={() => navigate(`/editor/${project.id}`)}
                style={{ cursor: 'pointer' }}
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
                            {type === 'my' ? '你拥有完整控制权，可以继续保存、对比和审批协作申请。' : type === 'collaborated' ? '继续参与当前项目的结构设计与迭代。' : '浏览共享项目并发起加入申请。'}
                        </p>
                    </div>
                    <div className="project-meta">
                        <span className="project-badge">创建于 {formatDateLabel(project.created_at)}</span>
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
                            <span className="ui-kicker">Schema Control Console</span>
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
                                    简洁地管理项目、协作、版本和结构设计，不做额外装饰，只保留真正有用的操作面。
                                </p>
                            </div>

                            <div className="dashboard-command-row">
                                <button className="btn btn-primary" onClick={openCreateModal}>+ 新建项目</button>
                                <button className="btn" onClick={() => recentProjectId && navigate(`/editor/${recentProjectId}`)} disabled={!recentProjectId}>打开最近编辑器</button>
                                <div className="dashboard-search-shell">
                                    <input
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="搜索项目名"
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

                {renderProjectSection('我创建的项目', '用于主导数据建模、控制版本节奏与协作入口。', filteredSections.my, 'my')}
                {renderProjectSection('我协作的项目', '继续参与他人发起的建模任务与数据库演进。', filteredSections.collaborated, 'collaborated')}
                {renderProjectSection('可加入的项目', '浏览团队公开项目并申请加入。', filteredSections.available, 'available')}
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content glass" onClick={(event) => event.stopPropagation()} style={{ width: '520px', maxWidth: '94vw', borderRadius: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <span className="ui-kicker">Create Project</span>
                                <h2 className="panel-heading" style={{ fontSize: '1.24rem', margin: '0.65rem 0 0.3rem' }}>新建数据库项目</h2>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>输入项目名称后直接进入编辑器。</p>
                            </div>
                            <button className="btn" onClick={() => setShowCreateModal(false)}>&times;</button>
                        </div>

                        <input
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
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.15rem' }}>
                            <button className="btn" onClick={() => setShowCreateModal(false)} disabled={createLoading}>取消</button>
                            <button className="btn btn-primary" onClick={createProject} disabled={createLoading}>
                                {createLoading ? '创建中...' : '创建并进入'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
