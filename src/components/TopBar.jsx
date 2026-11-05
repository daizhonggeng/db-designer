import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSchema } from '../store/schemaStore';
import { useTheme } from '../store/themeStore';
import { useSettings } from '../store/settingsStore';
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
import Icon from './Icon';
import { downloadProject, parseProjectFile } from '../utils/projectData';

function DropdownPanel({ children, right = false }) {
    return <div className={`dropdown-panel ${right ? 'is-right' : ''}`}>{children}</div>;
}

export default function TopBar({ projectId, session, onBack, onToggleSidebar, onToggleAI }) {
    const { state, dispatch } = useSchema();
    const { theme, toggleTheme } = useTheme();
    const { dbDialect, setDbDialect } = useSettings();
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
                backgroundColor: theme === 'light' ? '#f7f8fc' : '#171e2a',
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

    const saveLabel = session.recovery ? '等待恢复草稿' : session.status === 'saving' ? '正在保存…' : session.status === 'conflict' ? '保存冲突' : session.status === 'error' ? '保存失败' : session.dirty ? (session.autoSave ? '等待自动保存' : '有未保存的修改') : '所有修改已保存';
    return <>
        <div className="topbar-shell" ref={menuRef}>
            <header className="editor-header">
                <div className="editor-identity">
                    <button className="icon-button" onClick={onBack} title="返回工作台" aria-label="返回工作台"><Icon name="back" /></button>
                    <Logo size={27} showText={false} /><span className="header-divider" />
                    <div><div className="editor-project-name"><button className="project-title" title={getStoredUser()?.id === session.project.user_id ? '重命名项目' : session.project.name} onClick={() => { if (getStoredUser()?.id === session.project.user_id) { setNameInput(session.project.name); setRenameOpen(true); } }}>{session.project.name}</button><Icon name="down" size={12} className="project-name-edit" /></div><span className={`save-status ${['error', 'conflict'].includes(session.status) ? 'is-error' : ''}`} role="status">{saveLabel}</span></div>
                </div>
                <div className="editor-header-actions">
                    <label className="autosave-toggle"><input type="checkbox" checked={session.autoSave} onChange={event => session.setAutoSave(event.target.checked)} />自动保存</label>
                    <button className="icon-button" onClick={toggleTheme} title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /></button>
                    <button className="btn btn-ghost history-button" onClick={() => setShowHistory(true)}><Icon name="history" size={16} />历史版本</button>
                    <button className="btn btn-primary" onClick={() => session.save(true)} disabled={session.status === 'saving' || !!session.recovery || session.status === 'conflict'} title="保存当前设计并创建历史版本（Ctrl+S）"><Icon name="check" size={15} />{session.status === 'saving' ? '保存中…' : '保存版本'}</button>
                </div>
            </header>
            <div className="editor-toolbar">
                <div className="toolbar-group"><button className="icon-button" onClick={onToggleSidebar} title="显示或隐藏数据表导航" aria-label="切换数据表导航"><Icon name="panel" size={17} /></button><span className="toolbar-divider" /><button className="icon-button" onClick={() => dispatch({ type: 'UNDO' })} disabled={!state.past.length} title="撤销 (Ctrl+Z)"><Icon name="undo" size={16} /></button><button className="icon-button" onClick={() => dispatch({ type: 'REDO' })} disabled={!state.future.length} title="重做 (Ctrl+Y)"><Icon name="redo" size={16} /></button></div>
                <span className="toolbar-divider" />
                <div className="toolbar-group"><button className="btn btn-soft" onClick={() => dispatch({ type: 'ADD_TABLE' })}><Icon name="plus" size={15} />数据表</button><button className="icon-button" onClick={() => setMenu(menu === 'add' ? null : 'add')} title="更多新增操作"><Icon name="down" size={12} /></button>{menu === 'add' && <DropdownPanel><button className="btn" onClick={() => { dispatch({ type: 'ADD_TABLE' }); setMenu(null); }}><Icon name="table" size={15} />新建数据表</button><button className="btn" onClick={() => { dispatch({ type: 'ADD_BOOKMARK' }); setMenu(null); }}><Icon name="bookmark" size={15} />新建分组书签</button></DropdownPanel>}</div>
                <div className="toolbar-group"><button className="btn btn-ghost" onClick={() => setMenu(menu === 'layout' ? null : 'layout')}><Icon name="layout" size={15} />自动布局<Icon name="down" size={11} /></button>{menu === 'layout' && <DropdownPanel>{[['LR','从左到右'],['TB','从上到下'],['RL','从右到左'],['BT','从下到上']].map(([direction, label]) => <button className="btn" key={direction} onClick={() => handleLayout(direction)}>{label}</button>)}</DropdownPanel>}</div>
                <span className="toolbar-divider" />
                <select className="toolbar-select" aria-label="SQL 数据库类型" value={dbDialect} onChange={event => setDbDialect(event.target.value)}><option value="mysql">MySQL</option><option value="postgresql">PostgreSQL</option><option value="oracle">Oracle</option></select>
                <button className="btn btn-ghost" onClick={() => setShowRevEng(true)}><Icon name="upload" size={15} />数据库导入</button>
                <button className="btn btn-ghost" onClick={() => setShowPDMImport(true)} title="导入 PowerDesigner 物理模型"><Icon name="upload" size={15} />导入 PDM</button>
                <button className="btn btn-ghost" onClick={() => setShowPreset(true)} disabled={session.status === 'saving' || !!session.recovery || session.status === 'conflict'}><Icon name="file" size={15} />规范预设{state.designPreset?.rules ? ' ✓' : ''}</button>
                <button className="btn btn-ghost btn-ai" onClick={onToggleAI}><Icon name="sparkle" size={16} />AI 辅助</button>
                <span className="toolbar-spacer" /><span className="toolbar-note">{stats.tableCount} 张表 · {stats.fieldCount} 个字段</span>
                <button className="btn btn-ghost" onClick={() => setShowValidationModal(true)} title="检查结构"><Icon name="shield" size={15} />{validation.summary.isValid ? '结构检查' : `${validation.summary.errorCount} 个问题`}</button>
                <button className="icon-button" onClick={() => setShowDiffModal(true)} title="结构变更对比"><Icon name="diff" size={16} /></button>
                <div className="toolbar-group"><button className="btn btn-ghost" onClick={() => setMenu(menu === 'export' ? null : 'export')}><Icon name="download" size={15} />导出<Icon name="down" size={11} /></button>{menu === 'export' && <DropdownPanel right><span className="dropdown-label">结构与图片</span><button className="btn" onClick={() => { setShowExportModal(true); setMenu(null); }}><Icon name="file" size={15} />SQL 文件</button><button className="btn" onClick={() => { handleExport('png'); setMenu(null); }}>PNG 图片</button><button className="btn" onClick={() => { handleExport('svg'); setMenu(null); }}>SVG 矢量图</button><span className="menu-divider" /><span className="dropdown-label">完整项目</span><button className="btn" onClick={() => { downloadProject(session.project.name, state); setMenu(null); }}>JSON 项目备份</button><button className="btn" onClick={() => { fileInputRef.current.click(); setMenu(null); }}>导入 JSON 备份</button></DropdownPanel>}</div>
            </div>
        </div>
        <input type="file" ref={fileInputRef} accept=".json,application/json" onChange={importBackup} hidden />
        {renameOpen && <div className="modal-overlay" onClick={() => setRenameOpen(false)}><form className="modal-content compact-modal" onClick={event => event.stopPropagation()} onSubmit={async event => { event.preventDefault(); if (nameInput.trim() && await session.save(false, nameInput.trim())) setRenameOpen(false); }}><h2>重命名项目</h2><label className="form-label">项目名称<input className="ui-input" aria-label="项目名称" value={nameInput} onChange={event => setNameInput(event.target.value)} autoFocus required maxLength={100} /></label><div className="modal-footer"><button className="btn" type="button" onClick={() => setRenameOpen(false)}>取消</button><button className="btn btn-primary" disabled={session.status === 'saving' || !nameInput.trim()}>保存名称</button></div></form></div>}
        {showPreset && <ProjectPresetModal initialPreset={state.designPreset} onSave={savePreset} onClose={() => setShowPreset(false)} />}
        {showPDMImport && <PDMImportModal onClose={() => setShowPDMImport(false)} onImported={message => setToast({ message, type: 'success' })} />}
        {showHistory && <VersionHistoryModal projectId={projectId} onClose={() => setShowHistory(false)} onRestore={handleRestoreVersion} />}
        {showExportModal && <ExportModal schema={state} onClose={() => setShowExportModal(false)} />}
        {showRevEng && <ReverseEngineeringModal onClose={() => setShowRevEng(false)} />}
        {showValidationModal && <SchemaValidationModal schema={state} onClose={() => setShowValidationModal(false)} />}
        {showDiffModal && <SchemaDiffModal projectId={projectId} schema={state} onClose={() => setShowDiffModal(false)} />}
        {(toast || session.notice) && <Toast message={toast?.message || session.notice} type={toast?.type || 'success'} onClose={() => { setToast(null); session.setNotice(''); }} />}
    </>;
}
