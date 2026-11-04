import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, apiPut } from '../services/api';
import { clearStoredUser, getStoredUser } from '../utils/storage';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useTheme } from '../store/themeStore';
import Toast from '../components/Toast';
import { createOrderExample, mostRecentProject, parseProjectFile } from '../utils/projectData';

function formatDateLabel(value) {
    return new Date(value).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
    });
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [activeSection, setActiveSection] = useState('all');
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
            const schema = template === 'orders' ? createOrderExample() : template === 'import' ? imported.schema : undefined;
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

    const sectionNames = { all: '全部项目', my: '我创建的', collaborated: '参与协作', available: '团队项目' };
    const navigation = [
        { id: 'all', icon: 'grid', count: myProjects.length + collaboratedProjects.length },
        { id: 'my', icon: 'folder', count: myProjects.length },
        { id: 'collaborated', icon: 'users', count: collaboratedProjects.length },
        { id: 'available', icon: 'database', count: availableProjects.length },
    ];
    const renderProjectCard = (project, type) => <article key={project.id} className="project-card" role={type === 'available' ? undefined : 'button'} tabIndex={type === 'available' ? undefined : 0} onClick={() => type !== 'available' && navigate(`/editor/${project.id}`)} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); navigate(`/editor/${project.id}`); } }}>
        <div className="project-card-head"><span className={`project-symbol is-${type}`}><Icon name={type === 'collaborated' ? 'users' : 'database'} size={19} /></span><div className="project-card-actions">
            {type === 'my' && Number(project.pending_requests || 0) > 0 && <button className="btn btn-soft" onClick={event => viewRequests(project.id, event)}>{project.pending_requests} 条申请</button>}
            {type === 'my' && <button className="icon-button is-danger delete-project" title={`删除项目 ${project.name}`} onClick={event => deleteProject(project.id, project.name, event)}><Icon name="trash" size={15} /></button>}
        </div></div>
        <h3>{project.name}</h3><p className="project-card-description">{type === 'available' ? '申请加入，与团队一起完善设计' : `${project.schema_data?.tables?.length || 0} 张数据表 · ${project.schema_data?.relationships?.length || 0} 条关系`}</p>
        <div className="project-card-footer"><span><Icon name="history" size={12} />更新于 {formatDateLabel(project.updated_at || project.created_at)}</span>{type === 'available' ? <button className="btn" onClick={event => requestJoin(project.id, event)} disabled={project.request_status === 'pending'}>{project.request_status === 'pending' ? '等待审批' : '申请加入'}</button> : <Icon name="arrow" size={15} />}</div>
    </article>;
    const renderProjectSection = (title, projects, type) => <section className="dashboard-section"><div className="dashboard-section-head"><h2>{title}</h2><span>{projects.length}</span></div>{projects.length ? <div className="project-grid">{projects.map(project => renderProjectCard(project, type))}</div> : <div className="dashboard-empty"><Icon name={searchTerm ? 'search' : 'folder'} size={25} /><p>{searchTerm ? '没有找到匹配的项目，试试其他名称。' : type === 'available' ? '暂时没有可加入的团队项目。' : type === 'collaborated' ? '你还没有参与协作项目。' : '还没有项目，创建你的第一份设计吧。'}</p>{type === 'my' && !searchTerm && <button className="btn" onClick={() => openCreateModal()}>新建项目</button>}</div>}</section>;

    return <div className="workspace">
        <aside className="workspace-nav"><Logo size={29} /><span className="workspace-label">工作空间</span><nav aria-label="项目分类">{navigation.map(item => <button key={item.id} className={`nav-item ${activeSection === item.id ? 'is-active' : ''}`} onClick={() => setActiveSection(item.id)} title={sectionNames[item.id]}><Icon name={item.icon} size={17} /><span>{sectionNames[item.id]}</span><small>{item.count}</small></button>)}</nav>
            <div className="workspace-nav-bottom"><button className="nav-item" onClick={toggleTheme} title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} /><span>{theme === 'light' ? '暗色外观' : '浅色外观'}</span></button><div className="workspace-user"><span className="user-avatar">{user?.username?.slice(0,1).toUpperCase() || 'D'}</span><div><strong>{user?.username}</strong><small>我的工作空间</small></div><button className="icon-button" title="退出登录" onClick={() => { clearStoredUser(); navigate('/login'); }}><Icon name="logout" size={15} /></button></div></div>
        </aside>
        <main className="workspace-main"><header className="workspace-top"><div className="breadcrumbs"><span>工作空间</span><Icon name="chevron" size={12} /><strong>{sectionNames[activeSection]}</strong></div><span className="project-badge"><Icon name="database" size={13} />数据库设计</span></header>
            <div className="workspace-content"><div className="workspace-heading"><div><h1>把下一个想法，变成结构。</h1><p>管理你的数据库设计，让每一次迭代都清晰有序。</p></div><div className="workspace-heading-actions"><button className="btn" onClick={() => importRef.current.click()}><Icon name="upload" size={15} />导入项目</button><button className="btn btn-primary" onClick={() => openCreateModal()}><Icon name="plus" size={16} />新建项目</button></div></div>
                <section className="project-starter"><div className="starter-art"><Icon name={recentProject ? 'history' : 'table'} size={26} /></div><div className="starter-copy"><h2>{recentProject ? `继续设计「${recentProject.name}」` : '第一张关系图，从一个示例开始'}</h2><p>{recentProject ? '接着上次的思路，把结构设计再向前推进一步。' : '客户、订单与明细，三张表带你了解字段、主键和表间关系。'}</p></div>{recentProject ? <button className="btn" onClick={() => navigate(`/editor/${recentProject.id}`)}>继续上次编辑<Icon name="arrow" size={14} /></button> : <button className="btn" onClick={() => openCreateModal('orders')}>体验订单示例<Icon name="arrow" size={14} /></button>}</section>
                <div className="project-list-heading"><h2>{sectionNames[activeSection]}<span>{navigation.find(item => item.id === activeSection)?.count} 个项目{summaryStats[3].value > 0 ? ` · ${summaryStats[3].value} 条待处理申请` : ''}</span></h2><div className="project-search"><Icon name="search" size={15} /><input className="ui-input" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} aria-label="搜索项目名" placeholder="搜索项目…" /></div></div>
                {loading ? <div className="dashboard-empty" role="status">正在加载项目…</div> : loadError ? <div className="dashboard-empty" role="alert"><p>{loadError}</p><button className="btn" onClick={loadProjects}>重新加载</button></div> : <>
                    {(activeSection === 'all' || activeSection === 'my') && renderProjectSection('我创建的', filteredSections.my, 'my')}
                    {(activeSection === 'collaborated' || (activeSection === 'all' && collaboratedProjects.length > 0)) && renderProjectSection('参与协作', filteredSections.collaborated, 'collaborated')}
                    {activeSection === 'available' && renderProjectSection('可申请加入', filteredSections.available, 'available')}
                </>}
            </div>
        </main>
        <input ref={importRef} type="file" accept=".json,application/json" onChange={importProject} hidden />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {showCreateModal && <div className="modal-overlay" onClick={() => !createLoading && setShowCreateModal(false)}><form className="modal-content" style={{ width: 500 }} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); if (!createLoading) createProject(); }}><div className="modal-heading"><div><h2>开始一个新设计</h2><p>选择起点，为你的数据库项目起个名字。</p></div><button className="icon-button" type="button" title="关闭" onClick={() => setShowCreateModal(false)}><Icon name="close" /></button></div><div className="template-choices" role="group" aria-label="选择项目起点"><button type="button" className={`starter-card ${template === 'blank' ? 'is-selected' : ''}`} onClick={() => setTemplate('blank')}><Icon name="file" size={21} /><strong>空白项目</strong><span>从第一张表自由搭建</span></button><button type="button" className={`starter-card ${template === 'orders' ? 'is-selected' : ''}`} onClick={() => { setTemplate('orders'); if (!newProjectName) setNewProjectName('订单系统示例'); }}><Icon name="table" size={21} /><strong>订单示例</strong><span>3 张表 · 2 条关系</span></button>{imported && <button type="button" className={`starter-card ${template === 'import' ? 'is-selected' : ''}`} onClick={() => setTemplate('import')}><Icon name="upload" size={21} /><strong>导入的备份</strong><span>{imported.schema.tables.length} 张表</span></button>}</div><label className="form-label">项目名称<input className="ui-input" aria-label="项目名称" value={newProjectName} onChange={event => setNewProjectName(event.target.value)} placeholder="例如：会员中心、订单平台" required maxLength={100} autoFocus /></label>{createError && <p role="alert" className="inline-error" style={{ marginTop: 10 }}>{createError}</p>}<div className="modal-footer"><button type="button" className="btn" onClick={() => setShowCreateModal(false)} disabled={createLoading}>取消</button><button className="btn btn-primary" disabled={createLoading || !newProjectName.trim()}>{createLoading ? '创建中…' : '创建并开始'}<Icon name="arrow" size={14} /></button></div></form></div>}
        {showRequestsModal && <div className="modal-overlay" onClick={() => setShowRequestsModal(null)}><div className="modal-content" style={{ width: 560 }} onClick={event => event.stopPropagation()}><div className="modal-heading"><div><h2>协作申请</h2><p>审批其他成员加入你的项目。</p></div><button className="icon-button" title="关闭" onClick={() => setShowRequestsModal(null)}><Icon name="close" /></button></div><div style={{ overflowY: 'auto' }}>{!requests.length ? <div className="dashboard-empty">暂无协作申请</div> : requests.map(request => <div className="request-card" key={request.id}><div className="request-card-head"><strong>{request.username}</strong><span className="project-badge">{request.status === 'pending' ? '待审批' : request.status === 'approved' ? '已通过' : '已拒绝'}</span></div>{request.message && <p>{request.message}</p>}<small>{formatDateLabel(request.created_at)}</small>{request.status === 'pending' && <div className="session-actions" style={{ marginTop: 12 }}><button className="btn btn-primary" onClick={() => handleRequest(request.id, 'approved')}>通过申请</button><button className="btn" onClick={() => handleRequest(request.id, 'rejected')}>拒绝</button></div>}</div>)}</div></div></div>}
    </div>;
}
