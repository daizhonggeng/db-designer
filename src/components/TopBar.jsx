import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSchema } from '../store/schemaStore';
import { useTheme } from '../store/themeStore';
import { useSettings } from '../store/settingsStore';
import AIModal from './AIModal';
import ProjectPresetModal from './ProjectPresetModal';
import PDMImportModal from './PDMImportModal';
import VersionHistoryModal from './VersionHistoryModal';
import ExportModal from './ExportModal';
import ReverseEngineeringModal from './ReverseEngineeringModal';
import SchemaValidationModal from './SchemaValidationModal';
import SchemaDiffModal from './SchemaDiffModal';
import Toast from './Toast';
import * as htmlToImage from 'html-to-image';
import { getStoredUser } from '../utils/storage';
import { validateSchema } from '../utils/schema';
import Logo from './Logo';
import { downloadProject, parseProjectFile } from '../utils/projectData';

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

export default function TopBar({ projectId, session, onBack, onToggleSidebar }) {
    const { state, dispatch } = useSchema();
    const { theme, toggleTheme } = useTheme();
    const { dbDialect, setDbDialect } = useSettings();
    const [showAI, setShowAI] = useState(false);
    const [showPreset, setShowPreset] = useState(false);
    const [showPDMImport, setShowPDMImport] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showRevEng, setShowRevEng] = useState(false);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [menu, setMenu] = useState(null);
    const [toast, setToast] = useState(null);
    const [renameOpen, setRenameOpen] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const menuRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const close = event => {
            if (event.type === 'keydown' && event.key !== 'Escape') return;
            if (event.type === 'keydown' || !menuRef.current?.contains(event.target)) setMenu(null);
        };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('pointerdown', close);
            document.removeEventListener('keydown', close);
        };
    }, []);

    const importBackup = async event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        try {
            const imported = parseProjectFile(await file.text());
            if (state.tables.length && !window.confirm('导入备份将替换当前画布，可以通过撤销恢复。继续导入？')) return;
            dispatch({ type: 'IMPORT_SCHEMA', payload: imported.schema });
            setToast({ message: '项目备份已导入，可以继续编辑或撤销', type: 'success' });
        } catch (error) {
            setToast({ message: error.message, type: 'error' });
        }
    };

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
        setMenu(null);
    };

    const handleRestoreVersion = (schema) => {
        dispatch({ type: 'IMPORT_SCHEMA', payload: schema });
    };

    const savePreset = async ({ preset }) => {
        const saved = await session.save(true, undefined, { ...state, designPreset: preset });
        if (!saved) throw new Error('规范预设保存失败，请检查项目保存状态后重试。');
        dispatch({ type: 'SET_DESIGN_PRESET', payload: preset });
        setShowPreset(false);
        setToast({ message: '规范预设已保存，后续 AI 设计将自动参考。', type: 'success' });
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
            <div className="topbar-shell" ref={menuRef}>
                <div className="topbar-main glass">
                    <div className="topbar-row">
                        <div className="topbar-brand">
                            <button className="brand-back" onClick={onBack} title="返回工作台" aria-label="返回工作台"><Logo size={26} showText={false} /></button>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                                <button className="project-title" title={getStoredUser()?.id === session.project.user_id ? '重命名项目' : session.project.name} onClick={() => { if (getStoredUser()?.id === session.project.user_id) { setNameInput(session.project.name); setRenameOpen(true); } }}>{session.project.name}</button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                    <span className={`save-status ${session.status === 'error' || session.status === 'conflict' ? 'is-error' : ''}`} role="status">{session.recovery ? '等待恢复草稿' : session.status === 'saving' ? '正在保存…' : session.status === 'conflict' ? '保存冲突' : session.status === 'error' ? (session.draftError ? '保存失败' : '保存失败 · 草稿已保留') : session.dirty ? (session.autoSave ? '等待自动保存…' : '有未保存的修改') : '✓ 已保存'}{!session.dirty && session.project.updated_at ? ` · ${new Date(session.project.updated_at.replace(' ', 'T') + 'Z').toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
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
                            <button className="btn" onClick={onToggleSidebar} title="显示或隐藏数据表导航">☰ 导航</button>
                            <label className="autosave-toggle"><input type="checkbox" checked={session.autoSave} onChange={event => session.setAutoSave(event.target.checked)} />自动保存</label>
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
                                Δ 变更对比
                            </button>
                            <button className="btn btn-primary" onClick={() => session.save(true)} disabled={session.status === 'saving' || !!session.recovery || session.status === 'conflict'} title="保存当前设计并创建历史版本（Ctrl+S）">
                                {session.status === 'saving' ? '保存中…' : '保存版本'}
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
                                <button className="btn" onClick={() => setMenu(menu === 'add' ? null : 'add')}>
                                    ➕ 新增
                                </button>
                                {menu === 'add' && (
                                    <DropdownPanel>
                                        <button className="btn" onClick={() => { dispatch({ type: 'ADD_TABLE' }); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>
                                            + 新建表
                                        </button>
                                        <button className="btn" onClick={() => { dispatch({ type: 'ADD_BOOKMARK' }); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>
                                            + 新建书签
                                        </button>
                                    </DropdownPanel>
                                )}
                            </div>

                            <div className="topbar-group" style={{ position: 'relative' }}>
                                <button className="btn" onClick={() => setMenu(menu === 'layout' ? null : 'layout')}>
                                    🧩 布局
                                </button>
                                {menu === 'layout' && (
                                    <DropdownPanel>
                                        <button className="btn" onClick={() => handleLayout('LR')} style={{ justifyContent: 'flex-start' }}>➡️ 从左到右</button>
                                        <button className="btn" onClick={() => handleLayout('TB')} style={{ justifyContent: 'flex-start' }}>⬇️ 从上到下</button>
                                        <button className="btn" onClick={() => handleLayout('RL')} style={{ justifyContent: 'flex-start' }}>⬅️ 从右到左</button>
                                        <button className="btn" onClick={() => handleLayout('BT')} style={{ justifyContent: 'flex-start' }}>⬆️ 从下到上</button>
                                    </DropdownPanel>
                                )}
                            </div>

                            <div className="topbar-group" style={{ position: 'relative' }}>
                                <button className="btn" onClick={() => setMenu(menu === 'db' ? null : 'db')}>
                                    🗄️ 方言
                                </button>
                                {menu === 'db' && (
                                    <DropdownPanel>
                                        {['mysql', 'postgresql', 'oracle'].map((dialect) => (
                                            <button
                                                key={dialect}
                                                className="btn"
                                                onClick={() => {
                                                    setDbDialect(dialect);
                                                    setMenu(null);
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
                                    📥 数据库导入
                                </button>
                                <button className="btn" onClick={() => setShowPDMImport(true)} title="导入 PowerDesigner 物理模型">
                                    📥 导入 PDM
                                </button>
                                <button className="btn" onClick={() => setShowPreset(true)} disabled={session.status === 'saving' || !!session.recovery || session.status === 'conflict'}>
                                    📋 规范预设{state.designPreset?.rules ? ' ✓' : ''}
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
                                <button className="btn" onClick={() => setMenu(menu === 'export' ? null : 'export')}>
                                    📤 导出
                                </button>
                                {menu === 'export' && (
                                    <DropdownPanel>
                                        <button className="btn" onClick={() => { downloadProject(session.project.name, state); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>JSON 项目备份</button>
                                        <button className="btn" onClick={() => { fileInputRef.current.click(); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>导入 JSON 备份</button>
                                        <button className="btn" onClick={() => { setShowExportModal(true); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>
                                            SQL 导出
                                        </button>
                                        <button className="btn" onClick={() => { handleExport('png'); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>
                                            PNG 快照
                                        </button>
                                        <button className="btn" onClick={() => { handleExport('svg'); setMenu(null); }} style={{ justifyContent: 'flex-start' }}>
                                            SVG 矢量图
                                        </button>
                                    </DropdownPanel>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <input type="file" ref={fileInputRef} accept=".json,application/json" onChange={importBackup} hidden />
            {renameOpen && <div className="modal-overlay" onClick={() => setRenameOpen(false)}><form className="modal-content glass compact-modal" onClick={event => event.stopPropagation()} onSubmit={async event => { event.preventDefault(); if (nameInput.trim() && await session.save(false, nameInput.trim())) setRenameOpen(false); }}><h2>重命名项目</h2><label className="form-label">项目名称<input className="ui-input" aria-label="项目名称" value={nameInput} onChange={event => setNameInput(event.target.value)} autoFocus required maxLength={100} /></label><div className="session-actions"><button className="btn" type="button" onClick={() => setRenameOpen(false)}>取消</button><button className="btn btn-primary" disabled={session.status === 'saving' || !nameInput.trim()}>保存名称</button></div></form></div>}
            {showAI && <AIModal onClose={() => setShowAI(false)} />}
            {showPreset && <ProjectPresetModal initialPreset={state.designPreset} onSave={savePreset} onClose={() => setShowPreset(false)} />}
            {showPDMImport && <PDMImportModal onClose={() => setShowPDMImport(false)} onImported={message => setToast({ message, type: 'success' })} />}
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

            {(toast || session.notice) && (
                <Toast
                    message={toast?.message || session.notice}
                    type={toast?.type || 'success'}
                    onClose={() => { setToast(null); session.setNotice(''); }}
                />
            )}
        </>
    );
}
