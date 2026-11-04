import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchema } from '../store/schemaStore';
import { apiGet } from '../services/api';
import { getStoredUser } from '../utils/storage';
import TopBar from '../components/TopBar';
import Canvas from '../components/Canvas';
import Sidebar from '../components/Sidebar';

export default function Layout() {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { dispatch } = useSchema();
    const canvasRef = useRef(null);

    useEffect(() => {
        const user = getStoredUser();
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchProject = async () => {
            try {
                const project = await apiGet(`/api/projects/${projectId}`);
                if (project.schema_data && project.schema_data.tables) {
                    dispatch({
                        type: 'IMPORT_SCHEMA',
                        payload: {
                            ...project.schema_data,
                            bookmarks: project.schema_data.bookmarks || []
                        }
                    });
                } else {
                    dispatch({ type: 'IMPORT_SCHEMA', payload: { tables: [], relationships: [], bookmarks: [] } });
                }
            } catch (error) {
                console.error('Load project failed:', error);
                alert(error.message || '加载项目失败');
                navigate('/dashboard');
            }
        };
        fetchProject();
    }, [projectId, navigate, dispatch]);

    const handleLocateTable = (tableId) => {
        if (canvasRef.current && canvasRef.current.focusOnTable) {
            canvasRef.current.focusOnTable(tableId);
        }
    };

    return (
        <div className="editor-shell">
            <TopBar projectId={projectId} />
            <div className="canvas-stage">
                <Sidebar onLocateTable={handleLocateTable} />
                <Canvas ref={canvasRef} />
            </div>
        </div>
    );
}
