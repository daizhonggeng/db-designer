import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchema } from '../store/schemaStore';
import { useTheme } from '../store/themeStore';
import { useSettings } from '../store/settingsStore';
import AIModal from './AIModal';
import VersionHistoryModal from './VersionHistoryModal';
import ExportModal from './ExportModal';
import ReverseEngineeringModal from './ReverseEngineeringModal';
import SchemaValidationModal from './SchemaValidationModal';
import SchemaDiffModal from './SchemaDiffModal';
import Toast from './Toast';
import * as htmlToImage from 'html-to-image';
import { apiPost, apiPut } from '../services/api';
import { getStoredUser } from '../utils/storage';
import { validateSchema } from '../utils/schema';
import Logo from './Logo';

function DropdownPanel({ children }) {
    return (
        <div className="glass" style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            padding: '0.45rem',
            borderRadius: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            minWidth: '170px',
            zIndex: 1200,
        }}>
            {children}
        </div>
    );
}

export default function TopBar({ projectId }) {
    const navigate = useNavigate();
    const { state, dispatch } = useSchema();
    const { theme, toggleTheme } = useTheme();
    const { dbDialect, setDbDialect } = useSettings();
    const [showAI, setShowAI] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showRevEng, setShowRevEng] = useState(false);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showLayoutMenu, setShowLayoutMenu] = useState(false);
    const [showDbMenu, setShowDbMenu] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [toast, setToast] = useState(null);

    const validation = useMemo(() => validateSchema(state), [state]);
    const stats = useMemo(() => {
        const tableCount = state.tables.length;
        const fieldCount = state.tables.reduce((total, table) => total + table.columns.length, 0);
        const indexCount = state.tables.reduce((total, table) => total + (table.indexes?.length || 0), 0);
        const constraintCount = state.tables.reduce((total, table) => total + (table.constraints?.length || 0), 0);

        return { tableCount, fieldCount, indexCount, constraintCount };
    }, [state.tables]);

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
            if (!validation.summary.isValid) {
                setShowValidationModal(true);
                throw new Error(`发现 ${validation.summary.errorCount} 个结构错误，请先修复`);
            }

            await apiPut(`/api/projects/${projectId}`, { schema: state });

            const currentUser = getStoredUser();
            await apiPost(`/api/projects/${projectId}/versions`, {
                schema: state,
                user: currentUser?.username || 'Unknown',
                description: '',
            });

            setToast({ message: '保存成功！已生成新版本。', type: 'success' });
        } catch (error) {
            console.error('Save error:', error);
            setToast({ message: '保存失败: ' + error.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async (format = 'png') => {
        const canvasElement = document.getElementById('canvas-content');
        if (!canvasElement) return;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        state.tables.forEach((table) => {
            minX = Math.min(minX, table.position.x);
            minY = Math.min(minY, table.position.y);
            maxX = Math.max(maxX, table.position.x + (table.width || 240));
            maxY = Math.max(maxY, table.position.y + (table.height || 300));
        });

        state.bookmarks?.forEach((bookmark) => {
            minX = Math.min(minX, bookmark.x);
            minY = Math.min(minY, bookmark.y);
            maxX = Math.max(maxX, bookmark.x + bookmark.width);
            maxY = Math.max(maxY, bookmark.y + bookmark.height);
        });

        if (minX === Infinity) {
            alert('画布为空，无法导出');
            return;
        }

        const padding = 60;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        try {
            const options = {
                backgroundColor: theme === 'light' ? '#f7f6ef' : '#07141b',
                width,
                height,
                style: {
                    transform: `translate(${-(minX - padding)}px, ${-(minY - padding)}px)`,
                    transformOrigin: 'top left',
                },
                filter: (node) => node.tagName !== 'i',
                skipFonts: true,
                pixelRatio: 2,
            };

            const dataUrl = format === 'svg'
                ? await htmlToImage.toSvg(canvasElement, options)
                : await htmlToImage.toPng(canvasElement, options);

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
            <div className="topbar-shell">
                <div className="topbar-main glass">
                    <div className="topbar-row">
                        <div className="topbar-brand">
                            <div onClick={() => navigate('/dashboard')} title="返回仪表盘">
                                <Logo size={28} showText={true} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                                    Schema Control Deck
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                    <span className="project-badge">项目 #{projectId}</span>
                                    <span className="project-badge" style={{
                                        color: validation.summary.isValid ? 'var(--accent-success)' : 'var(--accent-danger)',
                                        borderColor: validation.summary.isValid ? 'rgba(116, 221, 152, 0.24)' : 'rgba(255, 122, 112, 0.24)',
                                        background: validation.summary.isValid ? 'rgba(116, 221, 152, 0.12)' : 'rgba(255, 122, 112, 0.12)',
                                    }}>
                                        {validation.summary.isValid ? '结构健康' : `${validation.summary.errorCount} 错误`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <button className="btn" onClick={toggleTheme} title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}>
                                {theme === 'dark' ? '☀️ 亮色' : '🌙 暗色'}
                            </button>
                            <button className="btn" onClick={() => setShowHistory(true)}>
                                🕒 历史
                            </button>
                            <button className="btn" onClick={() => setShowValidationModal(true)}>
                                🩺 体检
                            </button>
                            <button className="btn" onClick={() => setShowDiffModal(true)}>
                                Δ Diff
                            </button>
                            <button className="btn btn-primary" onClick={saveProject} disabled={saving}>
                                {saving ? '保存中...' : '保存项目'}
                            </button>
                        </div>
                    </div>

                    <div className="topbar-row">
                        <div className="topbar-stats">
                            <span className="topbar-badge">表 {stats.tableCount}</span>
                            <span className="topbar-badge">字段 {stats.fieldCount}</span>
                            <span className="topbar-badge">索引 {stats.indexCount}</span>
                            <span className="topbar-badge">约束 {stats.constraintCount}</span>
                            <span className="topbar-badge">关系 {state.relationships.length}</span>
                            <span className="topbar-badge">{dbDialect.toUpperCase()}</span>
                        </div>

                        <div className="topbar-groups">
                            <div className="topbar-group">
                                <button className="btn" onClick={() => dispatch({ type: 'UNDO' })} disabled={state.past.length === 0} title="撤销 (Ctrl+Z)">
                                    ↩️
                                </button>
                                <button className="btn" onClick={() => dispatch({ type: 'REDO' })} disabled={state.future.length === 0} title="重做 (Ctrl+Y)">
                                    ↪️
                                </button>
                            </div>

                            <div className="topbar-group" style={{ position: 'relative' }}>
                                <button className="btn" onClick={() => setShowAddMenu(prev => !prev)}>
                                    ➕ 新增
                                </button>
                                {showAddMenu && (
                                    <DropdownPanel>
                                        <button className="btn" onClick={() => { dispatch({ type: 'ADD_TABLE' }); setShowAddMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                            + 新建表
                                        </button>
                                        <button className="btn" onClick={() => { dispatch({ type: 'ADD_BOOKMARK' }); setShowAddMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                            + 新建书签
                                        </button>
                                    </DropdownPanel>
                                )}
                            </div>

                            <div className="topbar-group" style={{ position: 'relative' }}>
                                <button className="btn" onClick={() => setShowLayoutMenu(prev => !prev)}>
                                    🧩 布局
                                </button>
                                {showLayoutMenu && (
                                    <DropdownPanel>
                                        <button className="btn" onClick={() => handleLayout('LR')} style={{ justifyContent: 'flex-start' }}>➡️ 从左到右</button>
                                        <button className="btn" onClick={() => handleLayout('TB')} style={{ justifyContent: 'flex-start' }}>⬇️ 从上到下</button>
                                        <button className="btn" onClick={() => handleLayout('RL')} style={{ justifyContent: 'flex-start' }}>⬅️ 从右到左</button>
                                        <button className="btn" onClick={() => handleLayout('BT')} style={{ justifyContent: 'flex-start' }}>⬆️ 从下到上</button>
                                    </DropdownPanel>
                                )}
                            </div>

                            <div className="topbar-group" style={{ position: 'relative' }}>
                                <button className="btn" onClick={() => setShowDbMenu(prev => !prev)}>
                                    🗄️ 方言
                                </button>
                                {showDbMenu && (
                                    <DropdownPanel>
                                        {['mysql', 'postgresql', 'oracle'].map((dialect) => (
                                            <button
                                                key={dialect}
                                                className="btn"
                                                onClick={() => {
                                                    setDbDialect(dialect);
                                                    setShowDbMenu(false);
                                                }}
                                                style={{ justifyContent: 'space-between' }}
                                            >
                                                <span>{dialect === 'mysql' ? 'MySQL' : dialect === 'postgresql' ? 'PostgreSQL' : 'Oracle'}</span>
                                                {dbDialect === dialect ? '✓' : ''}
                                            </button>
                                        ))}
                                    </DropdownPanel>
                                )}
                            </div>

                            <div className="topbar-group">
                                <button className="btn" onClick={() => setShowRevEng(true)}>
                                    📥 逆向
                                </button>
                                <button
                                    className="btn"
                                    onClick={() => setShowAI(true)}
                                    style={{
                                        background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))',
                                        color: '#04151a',
                                        borderColor: 'transparent',
                                        fontWeight: 700,
                                    }}
                                >
                                    ✨ AI 设计
                                </button>
                            </div>

                            <div className="topbar-group" style={{ position: 'relative' }}>
                                <button className="btn" onClick={() => setShowExportMenu(prev => !prev)}>
                                    📤 导出
                                </button>
                                {showExportMenu && (
                                    <DropdownPanel>
                                        <button className="btn" onClick={() => { setShowExportModal(true); setShowExportMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                            SQL 导出
                                        </button>
                                        <button className="btn" onClick={() => { handleExport('png'); setShowExportMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                            PNG 快照
                                        </button>
                                        <button className="btn" onClick={() => { handleExport('svg'); setShowExportMenu(false); }} style={{ justifyContent: 'flex-start' }}>
                                            SVG 矢量图
                                        </button>
                                    </DropdownPanel>
                                )}
                            </div>
                        </div>
                    </div>
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
            {showRevEng && <ReverseEngineeringModal onClose={() => setShowRevEng(false)} />}
            {showValidationModal && (
                <SchemaValidationModal
                    schema={state}
                    onClose={() => setShowValidationModal(false)}
                />
            )}
            {showDiffModal && (
                <SchemaDiffModal
                    projectId={projectId}
                    schema={state}
                    onClose={() => setShowDiffModal(false)}
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
