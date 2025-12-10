import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [myProjects, setMyProjects] = useState([]);
    const [collaboratedProjects, setCollaboratedProjects] = useState([]);
    const [availableProjects, setAvailableProjects] = useState([]);
    const [showRequestsModal, setShowRequestsModal] = useState(null);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/login');
            return;
        }
        const userData = JSON.parse(storedUser);
        setUser(userData);
        loadProjects(userData.id);
    }, [navigate]);

    const loadProjects = async (userId) => {
        try {
            const [my, collab, avail] = await Promise.all([
                fetch(`${API_BASE_URL}/api/projects/my-created?userId=${userId}`).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/projects/my-collaborated?userId=${userId}`).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/projects/available?userId=${userId}`).then(r => r.json())
            ]);
            setMyProjects(my);
            setCollaboratedProjects(collab);
            setAvailableProjects(avail);
        } catch (err) {
            console.error('Failed to load projects:', err);
        }
    };

    const createProject = async () => {
        const name = prompt('请输入项目名称:');
        if (!name) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, name })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: '创建项目失败' }));
                throw new Error(errorData.error || '创建项目失败');
            }

            const newProject = await res.json();
            if (!newProject.id) throw new Error('返回的项目数据无效');

            navigate(`/editor/${newProject.id}`);
        } catch (err) {
            console.error('Create project error:', err);
            alert('创建项目失败: ' + err.message);
        }
    };

    const deleteProject = async (projectId, projectName, e) => {
        e.stopPropagation();
        if (!confirm(`确定要删除项目 "${projectName}" 吗？此操作不可恢复！`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                loadProjects(user.id);
                alert('删除成功！');
            } else {
                const errorData = await res.json().catch(() => ({ error: '删除失败' }));
                throw new Error(errorData.error || '删除失败');
            }
        } catch (err) {
            alert('删除失败: ' + err.message);
        }
    };

    const requestJoin = async (projectId, e) => {
        e.stopPropagation();
        const message = prompt('请输入申请理由（可选）:');

        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, message })
            });
            if (res.ok) {
                alert('申请已提交！');
                loadProjects(user.id);
            }
        } catch (err) {
            alert('申请失败: ' + err.message);
        }
    };

    const viewRequests = async (projectId, e) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/requests`);
            const data = await res.json();
            setRequests(data);
            setShowRequestsModal(projectId);
        } catch (err) {
            alert('加载申请失败: ' + err.message);
        }
    };

    const handleRequest = async (requestId, status) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/projects/requests/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                alert(status === 'approved' ? '已批准！' : '已拒绝！');
                viewRequests(showRequestsModal, { stopPropagation: () => { } });
                loadProjects(user.id);
            }
        } catch (err) {
            alert('操作失败: ' + err.message);
        }
    };

    const ProjectCard = ({ project, type }) => (
        <div
            className="glass"
            onClick={() => navigate(`/editor/${project.id}`)}
            style={{
                height: '150px',
                padding: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
            }}
        >
            {type === 'my' && (
                <>
                    <button
                        onClick={(e) => deleteProject(project.id, project.name, e)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            opacity: 0.6,
                            transition: 'all 0.2s'
                        }}
                        title="删除项目"
                    >
                        ×
                    </button>
                    {project.pending_requests > 0 && (
                        <button
                            onClick={(e) => viewRequests(project.id, e)}
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '44px',
                                background: 'var(--accent-primary)',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                fontWeight: 'bold'
                            }}
                            title="查看申请"
                        >
                            {project.pending_requests} 个申请
                        </button>
                    )}
                </>
            )}
            {type === 'available' && (
                <button
                    onClick={(e) => requestJoin(project.id, e)}
                    disabled={project.request_status === 'pending'}
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: project.request_status === 'pending' ? 'var(--text-secondary)' : 'var(--accent-primary)',
                        border: 'none',
                        color: 'white',
                        cursor: project.request_status === 'pending' ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)'
                    }}
                    title={project.request_status === 'pending' ? '待审批' : '申请加入'}
                >
                    {project.request_status === 'pending' ? '待审批' : '申请加入'}
                </button>
            )}
            <h3 style={{ color: 'var(--text-primary)', marginTop: type !== 'collaborated' ? '24px' : '0' }}>
                {project.name}
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date(project.created_at).toLocaleDateString()}
            </div>
        </div>
    );

    return (
        <div style={{ padding: '2rem', minHeight: '100vh', background: 'var(--bg-gradient)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: 'var(--accent-primary)' }}>我的项目</h1>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{user?.username}</span>
                    <button
                        className="btn"
                        onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
                    >
                        退出
                    </button>
                </div>
            </div>

            {/* 我创建的项目 */}
            <section style={{ marginBottom: '3rem' }}>
                <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
                    我创建的项目
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    <div
                        className="glass"
                        onClick={createProject}
                        style={{
                            height: '150px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: '2px dashed var(--glass-border)'
                        }}
                    >
                        <div style={{ fontSize: '2rem', color: 'var(--accent-primary)' }}>+</div>
                        <div style={{ color: 'var(--text-secondary)' }}>新建项目</div>
                    </div>
                    {myProjects.map(p => <ProjectCard key={p.id} project={p} type="my" />)}
                </div>
            </section>

            {/* 我协作的项目 */}
            <section style={{ marginBottom: '3rem' }}>
                <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
                    我协作的项目
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {collaboratedProjects.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', padding: '2rem' }}>暂无协作项目</div>
                    ) : (
                        collaboratedProjects.map(p => <ProjectCard key={p.id} project={p} type="collaborated" />)
                    )}
                </div>
            </section>

            {/* 未参与的项目 */}
            <section>
                <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>
                    未参与的项目
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {availableProjects.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', padding: '2rem' }}>暂无可加入的项目</div>
                    ) : (
                        availableProjects.map(p => <ProjectCard key={p.id} project={p} type="available" />)
                    )}
                </div>
            </section>

            {/* 申请列表弹窗 */}
            {showRequestsModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowRequestsModal(null)}
                >
                    <div
                        className="glass"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '500px',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            padding: '2rem',
                            borderRadius: 'var(--radius-lg)'
                        }}
                    >
                        <h2 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>加入申请</h2>
                        {requests.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)' }}>暂无申请</p>
                        ) : (
                            requests.map(req => (
                                <div
                                    key={req.id}
                                    style={{
                                        padding: '1rem',
                                        marginBottom: '1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--glass-border)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{req.username}</strong>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: req.status === 'pending' ? 'var(--accent-primary)' :
                                                req.status === 'approved' ? '#10b981' : '#ef4444'
                                        }}>
                                            {req.status === 'pending' ? '待审批' :
                                                req.status === 'approved' ? '已批准' : '已拒绝'}
                                        </span>
                                    </div>
                                    {req.message && (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                            {req.message}
                                        </p>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        {new Date(req.created_at).toLocaleString()}
                                    </div>
                                    {req.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn"
                                                onClick={() => handleRequest(req.id, 'approved')}
                                                style={{ flex: 1, background: '#10b981' }}
                                            >
                                                批准
                                            </button>
                                            <button
                                                className="btn"
                                                onClick={() => handleRequest(req.id, 'rejected')}
                                                style={{ flex: 1, background: '#ef4444' }}
                                            >
                                                拒绝
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <button
                            className="btn"
                            onClick={() => setShowRequestsModal(null)}
                            style={{ width: '100%', marginTop: '1rem' }}
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
