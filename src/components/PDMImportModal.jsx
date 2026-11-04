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
        dispatch({ type: 'APPEND_SCHEMA', payload: preview.schema });
        onImported(`已导入 ${preview.schema.tables.length} 张表、${preview.schema.relationships.length} 条字段关联，可撤销。请点击保存以保存项目。`);
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
                        <div className="pdm-preview">
                            <table>
                                <thead><tr><th>表名</th><th>注释</th><th>字段数</th></tr></thead>
                                <tbody>{preview.schema.tables.map(table => <tr key={table.id}>
                                    <td>{table.name}</td><td>{table.comment || '—'}</td><td>{table.columns.length}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                    </>}
                    <p className="pdm-help">确认后追加到当前项目，保留已有内容。同名表也会追加，可通过撤销恢复；导入后请点击保存。</p>
                </div>
                <div className="pdm-footer">
                    <button className="btn" onClick={onClose} disabled={reading}>取消</button>
                    <button className="btn btn-primary" onClick={handleImport} disabled={reading || !preview}>确认导入</button>
                </div>
            </div>
        </div>, document.body
    );
}
