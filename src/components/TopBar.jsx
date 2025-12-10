import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchema } from '../store/schemaStore';
import { useTheme } from '../store/themeStore';
import { useSettings } from '../store/settingsStore';
import AIModal from './AIModal';
import VersionHistoryModal from './VersionHistoryModal';
import ExportModal from './ExportModal';
import ReverseEngineeringModal from './ReverseEngineeringModal';
import Toast from './Toast';
import * as htmlToImage from 'html-to-image';
import { API_BASE_URL } from '../config';

export default function TopBar({ projectId }) {
    const navigate = useNavigate();
    const { state, dispatch } = useSchema();
    const { theme, toggleTheme } = useTheme();
    const { dbDialect, setDbDialect } = useSettings();
    const [showAI, setShowAI] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showRevEng, setShowRevEng] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);
    const [showDbMenu, setShowDbMenu] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [toast, setToast] = useState(null);



    const handleLayout = (direction) => {
        dispatch({ type: 'AUTO_LAYOUT', payload: direction });
        setShowLayoutMenu(false);
    };

    const handleRestoreVersion = (schema) => {
        dispatch({ type: 'IMPORT_SCHEMA', payload: schema });
    };


    const saveProject = async () => {
        setSaving(true);
        try {
            // 1. Save Project (Current State)
            const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schema: state })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: '保存失败' }));
                throw new Error(errorData.error || '保存项目失败');
            }

            // 2. Create Version Automatically
            const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : 'Unknown';
            const versionRes = await fetch(`${API_BASE_URL}/api/projects/${projectId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schema: state,
                    user,
                    description: ''
                })
            });

            if (!versionRes.ok) {
                const errorData = await versionRes.json().catch(() => ({ error: '创建版本失败' }));
                throw new Error(errorData.error || '创建版本失败');
            }

            setToast({ message: '保存成功！已生成新版本。', type: 'success' });
        } catch (err) {
            console.error('Save error:', err);
            setToast({ message: '保存失败: ' + err.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const addTable = () => {
        dispatch({ type: 'ADD_TABLE' });
    };

    const exportSQL = () => {
        setShowExportModal(true);
    };

    const handleExport = async (format = 'png') => {
        const canvasElement = document.getElementById('canvas-content');
        if (!canvasElement) return;

        // 1. Calculate Bounding Box of all elements
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        // Check tables
        state.tables.forEach(t => {
            minX = Math.min(minX, t.position.x);
            minY = Math.min(minY, t.position.y);
            maxX = Math.max(maxX, t.position.x + (t.width || 240));
            maxY = Math.max(maxY, t.position.y + (t.height || 300)); // Estimate height if missing
        });

        // Check bookmarks
        state.bookmarks?.forEach(b => {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        });

        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // If no elements, default to current view
        if (minX === Infinity) {
            alert("画布为空，无法导出");
            return;
        }

        try {
            const options = {
                backgroundColor: theme === 'light' ? '#f8fafc' : '#1a1a1a',
                width: width,
                height: height,
                style: {
                    transform: `translate(${-minX}px, ${-minY}px)`,
                    transformOrigin: 'top left'
                },
                filter: (node) => {
                    // Exclude elements that might cause issues or are not needed
                    return node.tagName !== 'i';
                },
                skipFonts: true,
                pixelRatio: 2
            };

            let dataUrl;
            if (format === 'svg') {
                // For SVG, we need to be careful with fonts and images
                dataUrl = await htmlToImage.toSvg(canvasElement, options);
            } else {
                dataUrl = await htmlToImage.toPng(canvasElement, { ...options, pixelRatio: 2 });
            }

            const link = document.createElement('a');
            link.download = `schema-design-${new Date().getTime()}.${format}`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Export failed:', error);
            alert('导出失败: ' + error.message);
        }
    };

    return (
        <>
            <div
                className="glass"
                style={{
                    position: 'absolute',
                    top: 'var(--spacing-md)',
                    left: 'calc(50% + 120px)', // Shift right to avoid sidebar
                    transform: 'translateX(-50%)',
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    display: 'flex',
                    gap: 'var(--spacing-sm)', // Reduced gap
                    borderRadius: 'var(--radius-full)',
                    zIndex: 100,
                    alignItems: 'center',
                    flexWrap: 'nowrap', // Prevent wrapping
                    whiteSpace: 'nowrap', // Prevent text wrapping
                    maxWidth: '95vw', // Ensure it fits on screen
                    overflow: 'visible' // Allow dropdown to show
                }}
            >
                <h2
                    style={{ color: 'var(--accent-primary)', fontSize: '1rem', marginRight: 'var(--spacing-sm)', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => navigate('/dashboard')}
                    title="返回仪表盘"
                >
                    ← DB Designer
                </h2>

                <button className="btn" onClick={toggleTheme} title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}>
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>

                <button className="btn" onClick={() => setShowHistory(true)}>
                    🕒 历史
                </button>

                <button
                    className="btn"
                    onClick={saveProject}
                    disabled={saving}
                >
                    {saving ? '保存中...' : '💾 保存'}
                </button>

                <button
                    className="btn"
                    onClick={() => setShowAI(true)}
                    style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 'bold',
                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)'
                    }}
                >
                    ✨ AI 设计
                </button>

                <div style={{ position: 'relative' }}>
                    <button
                        className="btn"
                        onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                        title="自动整理布局"
                    >
                        🧩 自动布局
                    </button>
                    {showLayoutMenu && (
                        <div className="glass" style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'row', // Horizontal layout
                            gap: '8px',
                            padding: '8px',
                            borderRadius: '8px',
                            zIndex: 9999,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--glass-border)'
                        }}>
                            <button className="btn" onClick={() => handleLayout('LR')} title="从左到右">
                                ➡️
                            </button>
                            <button className="btn" onClick={() => handleLayout('TB')} title="从上到下">
                                ⬇️
                            </button>
                            <button className="btn" onClick={() => handleLayout('RL')} title="从右到左">
                                ⬅️
                            </button>
                            <button className="btn" onClick={() => handleLayout('BT')} title="从下到上">
                                ⬆️
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', flexShrink: 0 }}></div>

                <button
                    className="btn"
                    onClick={() => dispatch({ type: 'UNDO' })}
                    disabled={state.past.length === 0}
                    title="撤销 (Ctrl+Z)"
                    style={{ opacity: state.past.length === 0 ? 0.5 : 1, cursor: state.past.length === 0 ? 'not-allowed' : 'pointer' }}
                >
                    ↩️
                </button>
                <button
                    className="btn"
                    onClick={() => dispatch({ type: 'REDO' })}
                    disabled={state.future.length === 0}
                    title="重做 (Ctrl+Y)"
                    style={{ opacity: state.future.length === 0 ? 0.5 : 1, cursor: state.future.length === 0 ? 'not-allowed' : 'pointer' }}
                >
                    ↪️
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', flexShrink: 0 }}></div>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', flexShrink: 0 }}></div>

                {/* 新增按钮组 */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="btn"
                        onClick={() => setShowAddMenu(!showAddMenu)}
                        title="新增对象"
                        style={{ display: 'flex', gap: '4px' }}
                    >
                        ➕ 新增
                    </button>
                    {showAddMenu && (
                        <div className="glass" style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '8px',
                            borderRadius: '8px',
                            zIndex: 9999,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--glass-border)',
                            minWidth: '100px'
                        }}>
                            <button className="btn" onClick={() => { addTable(); setShowAddMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                + 表
                            </button>
                            <button className="btn" onClick={() => { dispatch({ type: 'ADD_BOOKMARK' }); setShowAddMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                + 书签
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', flexShrink: 0 }}></div>

                {/* 数据库类型选择器 */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="btn"
                        onClick={() => setShowDbMenu(!showDbMenu)}
                        title="选择数据库类型"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        🗄️ {dbDialect === 'mysql' ? 'MySQL' : dbDialect === 'postgresql' ? 'PostgreSQL' : 'Oracle'}
                    </button>
                    {showDbMenu && (
                        <div className="glass" style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '8px',
                            borderRadius: '8px',
                            zIndex: 9999,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--glass-border)',
                            minWidth: '140px'
                        }}>
                            <button
                                className="btn"
                                onClick={() => {
                                    setDbDialect('mysql');
                                    setShowDbMenu(false);
                                }}
                                style={{
                                    background: dbDialect === 'mysql' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    justifyContent: 'flex-start'
                                }}
                            >
                                {dbDialect === 'mysql' ? '✓ ' : ''}MySQL
                            </button>
                            <button
                                className="btn"
                                onClick={() => {
                                    setDbDialect('postgresql');
                                    setShowDbMenu(false);
                                }}
                                style={{
                                    background: dbDialect === 'postgresql' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    justifyContent: 'flex-start'
                                }}
                            >
                                {dbDialect === 'postgresql' ? '✓ ' : ''}PostgreSQL
                            </button>
                            <button
                                className="btn"
                                onClick={() => {
                                    setDbDialect('oracle');
                                    setShowDbMenu(false);
                                }}
                                style={{
                                    background: dbDialect === 'oracle' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                    justifyContent: 'flex-start'
                                }}
                            >
                                {dbDialect === 'oracle' ? '✓ ' : ''}Oracle
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-border)', flexShrink: 0 }}></div>

                <button className="btn" onClick={() => setShowRevEng(true)} title="从数据库导入结构">
                    📥 逆向
                </button>

                {/* 导出按钮组 */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="btn"
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        title="导出项目"
                        style={{ display: 'flex', gap: '4px' }}
                    >
                        📤 导出
                    </button>
                    {showExportMenu && (
                        <div className="glass" style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            padding: '8px',
                            borderRadius: '8px',
                            zIndex: 9999,
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--glass-border)',
                            minWidth: '100px'
                        }}>
                            <button className="btn" onClick={() => { exportSQL(); setShowExportMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                SQL
                            </button>
                            <button className="btn" onClick={() => { handleExport('png'); setShowExportMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                📷 PNG
                            </button>
                            <button className="btn" onClick={() => { handleExport('svg'); setShowExportMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                ✒️ SVG
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showAI && <AIModal onClose={() => setShowAI(false)} />}
            {showHistory && (
                <VersionHistoryModal
                    projectId={projectId}
                    onClose={() => setShowHistory(false)}
                    onRestore={handleRestoreVersion}
                />
            )}
            {showExportModal && (
                <ExportModal
                    schema={state}
                    onClose={() => setShowExportModal(false)}
                />
            )}
            {showRevEng && (
                <ReverseEngineeringModal
                    onClose={() => setShowRevEng(false)}
                />
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

        </>
    );
}
