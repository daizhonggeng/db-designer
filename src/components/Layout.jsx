import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchema } from '../store/schemaStore';
import { apiGet } from '../services/api';
import { getStoredUser } from '../utils/storage';
import { downloadProject, rememberProject } from '../utils/projectData';
import useProjectSession from '../hooks/useProjectSession';
import TopBar from './TopBar';
import Canvas from './Canvas';
import Sidebar from './Sidebar';
import Icon from './Icon';

function ProjectWorkspace({ initialProject }) {
    const navigate = useNavigate();
    const { state, dispatch } = useSchema();
    const session = useProjectSession(initialProject, state);
    const canvasRef = useRef(null);
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 650);

    const back = async () => {
        if (session.dirty && !await session.save()) return;
        navigate('/dashboard');
    };

    return (
        <div className="editor-shell">
            <TopBar projectId={session.project.id} session={session} onBack={back} onToggleSidebar={() => setSidebarOpen(value => !value)} />
            {session.recovery && <div className="session-banner" role="status">
                <div><strong>发现上次未保存的本机草稿</strong><span>恢复后会继续自动保存；也可以使用服务器上的版本。</span></div>
                <div className="session-actions">
                    <button className="btn btn-primary" onClick={() => { dispatch({ type: 'IMPORT_SCHEMA', payload: session.recovery.schema }); session.resolveRecovery(); }}>恢复草稿</button>
                    <button className="btn" onClick={session.resolveRecovery}>使用已保存版本</button>
                </div>
            </div>}
            {session.error && <div className="session-banner is-error" role="alert">
                <div><strong>{session.status === 'conflict' ? '保存冲突，当前编辑内容已保留' : '暂时无法保存'}</strong><span>{session.error}</span></div>
                <div className="session-actions">
                    <button className="btn" onClick={() => downloadProject(session.project.name, state)}>下载当前备份</button>
                    {session.status === 'conflict' ? <button className="btn" onClick={() => window.location.reload()}>载入最新版本</button> : <button className="btn" onClick={() => session.save()}>重试保存</button>}
                    <button className="btn" onClick={() => navigate('/dashboard')}>返回工作台</button>
                </div>
            </div>}
            {session.draftError && <div className="session-banner is-error" role="alert">浏览器无法保存本机草稿，请保持网络连接并及时保存或下载备份。</div>}
            <div className="canvas-stage">
                {sidebarOpen && <Sidebar onLocateTable={id => canvasRef.current?.focusOnTable(id)} />}
                <Canvas ref={canvasRef} />
            </div>
            <footer className="editor-footer"><span><Icon name="database" size={11} />{state.tables.length} 张数据表 · {state.relationships.length} 条关系</span><span>双击表头编辑 · 拖动空白处移动画布</span></footer>
        </div>
    );
}

export default function Layout() {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { dispatch } = useSchema();
    const [project, setProject] = useState(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const user = getStoredUser();
        if (!user) { navigate('/login'); return; }
        const controller = new AbortController();
        const load = async () => {
            try {
                setError('');
                const loaded = await apiGet(`/api/projects/${projectId}`, { signal: controller.signal });
                dispatch({ type: 'LOAD_SCHEMA', payload: loaded.schema_data });
                try { rememberProject(user.id, loaded.id); } catch { /* 最近访问记录不影响编辑。 */ }
                setProject(loaded);
            } catch (failure) {
                if (failure.name !== 'AbortError') setError(failure.message || '加载项目失败');
            }
        };
        load();
        return () => controller.abort();
    }, [projectId, navigate, dispatch, attempt]);

    if (error) return <main className="project-loading"><h2>项目暂时无法打开</h2><p role="alert">{error}</p><div className="session-actions"><button className="btn btn-primary" onClick={() => setAttempt(value => value + 1)}>重新加载</button><button className="btn" onClick={() => navigate('/dashboard')}>返回工作台</button></div></main>;
    if (!project || String(project.id) !== projectId) return <main className="project-loading" role="status">正在载入项目…</main>;
    return <ProjectWorkspace key={project.id} initialProject={project} />;
}
