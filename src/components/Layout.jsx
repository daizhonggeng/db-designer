import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchema } from '../store/schemaStore';
import { API_BASE_URL } from '../config';
import TopBar from '../components/TopBar';
import Canvas from '../components/Canvas';
import Sidebar from '../components/Sidebar';

export default function Layout() {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const { dispatch } = useSchema();
    const canvasRef = useRef(null);

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (!user) {
            navigate('/login');
            return;
        }

        const fetchProject = async () => {
            const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`);
            if (response.ok) {
                const project = await response.json();
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <TopBar projectId={projectId} />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Sidebar onLocateTable={handleLocateTable} />
                <Canvas ref={canvasRef} />
            </div>
        </div>
    );
}
