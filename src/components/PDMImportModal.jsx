import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { readPDMFile } from '../utils/pdmParser';
import { useSchema } from '../store/schemaStore';
import './PDMImportModal.css';

export default function PDMImportModal({ onClose, onImported }) {
    const { dispatch } = useSchema();
    const [preview, setPreview] = useState(null);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === 'Escape' && !reading) onClose();
            event.stopPropagation();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, reading]);

    const handleUpload = async event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        setPreview(null);
        setError('');
        setReading(true);
        try {
            const schema = await readPDMFile(file);
            setPreview({ name: file.name, schema });
        } catch (err) {
            setError(err.message || '读取 PDM 失败，请检查文件。');
        } finally {
            setReading(false);
        }
    };

    const handleImport = () => {
        const missingTypeCount = preview.schema.tables.reduce((total, table) =>
            total + table.columns.filter(column => !column.type.trim()).length, 0);
        dispatch({ type: 'APPEND_SCHEMA', payload: preview.schema });
        onImported(`已导入 ${preview.schema.tables.length} 张表、${preview.schema.relationships.length} 条字段关联。${missingTypeCount ? `${missingTypeCount} 个字段缺少类型，请在结构检查中查看。` : '可通过撤销恢复。'}`);
        onClose();
    };

    return createPortal(
        <div className="modal-overlay pdm-overlay" onClick={reading ? undefined : onClose}>
            <div className="glass pdm-modal" role="dialog" aria-modal="true" aria-labelledby="pdm-title"
                onClick={event => event.stopPropagation()}>
                <div className="pdm-header">
                    <div>
                        <h2 id="pdm-title">导入 PDM</h2>
                        <p>从 PowerDesigner 物理模型导入表结构。</p>
                    </div>
                    <button className="btn" aria-label="关闭" onClick={onClose} disabled={reading}>×</button>
                </div>
                <div className="pdm-body">
                    <label className="pdm-upload">
                        <span>选择 .pdm 文件（最大 20 MB）</span>
                        <input autoFocus type="file" accept=".pdm" aria-label="选择 PDM 文件" disabled={reading} onChange={handleUpload} />
                    </label>
                    <p className="pdm-help">支持表、字段、类型、中文名称/注释、主键及外键字段关联，包含模型包内的表。索引、视图和原始图形布局暂不导入。</p>
                    {reading && <p role="status">正在解析 PDM…</p>}
                    {error && <p className="pdm-error" role="alert">{error}</p>}
                    {preview && <>
                        <p role="status" className="pdm-summary">
                            {preview.name}：{preview.schema.tables.length} 张表，
                            {preview.schema.tables.reduce((count, table) => count + table.columns.length, 0)} 个字段，
                            {preview.schema.relationships.length} 条字段关联
                        </p>
                        {preview.schema.tables.some(table => table.columns.some(column => !column.type.trim())) && <div className="pdm-missing-types" role="status">
                            <strong>{preview.schema.tables.reduce((total, table) => total + table.columns.filter(column => !column.type.trim()).length, 0)} 个字段未设置数据类型</strong>
                            <p>这些字段仍会导入，类型暂时留空。请在导出 SQL 前，根据原始设计补全类型。</p>
                            <details><summary>查看需要补全的字段</summary><ul>{preview.schema.tables.flatMap(table => table.columns.filter(column => !column.type.trim()).map(column => <li key={column.id}>{table.name} · {column.name}</li>))}</ul></details>
                        </div>}
                        <div className="pdm-preview">
                            <table>
                                <thead><tr><th>表名</th><th>注释</th><th>字段数</th></tr></thead>
                                <tbody>{preview.schema.tables.map(table => <tr key={table.id}>
                                    <td>{table.name}</td><td>{table.comment || '—'}</td><td>{table.columns.length}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                    </>}
                    <p className="pdm-help">确认后追加到当前项目，保留已有内容。同名表也会追加，可通过撤销恢复；请留意自动保存状态，或点击“保存版本”。</p>
                </div>
                <div className="pdm-footer">
                    <button className="btn" onClick={onClose} disabled={reading}>取消</button>
                    <button className="btn btn-primary" onClick={handleImport} disabled={reading || !preview}>确认导入</button>
                </div>
            </div>
        </div>, document.body
    );
}
