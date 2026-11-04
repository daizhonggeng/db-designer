import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useSchema } from '../store/schemaStore';
import { useSettings } from '../store/settingsStore';
import { generateTableSQL } from '../utils/sqlGenerator';
import ColorPicker from './ColorPicker';
import ContextMenu from './ContextMenu';
import TableEditModal from './TableEditModal';
import Icon from './Icon';

export default function TableNode({ table, onStartConnect, onCompleteConnect, onMouseEnter, onMouseLeave, onMeasure }) {
    const { state, dispatch } = useSchema();
    const { dbDialect } = useSettings();
    const nodeRef = useRef(null);
    const [editing, setEditing] = useState(false);
    const [colorOpen, setColorOpen] = useState(false);
    const [context, setContext] = useState(null);
    const [sql, setSql] = useState(null);
    useEffect(() => {
        let frame;
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            const columnOffsets = Object.fromEntries(Array.from(nodeRef.current.querySelectorAll('[data-column-id]')).map(row => [row.dataset.columnId, row.offsetTop + row.offsetHeight / 2]));
            onMeasure(table.id, { width, height, columnOffsets });
            frame = requestAnimationFrame(() => dispatch({ type: 'RESIZE_TABLE', payload: { id: table.id, width, height } }));
        });
        observer.observe(nodeRef.current);
        return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    }, [table.id, table.columns, dispatch, onMeasure]);
    useEffect(() => {
        const close = () => { setColorOpen(false); setContext(null); };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);
    const remove = () => { if (window.confirm('确定要删除这张表吗？')) dispatch({ type: 'DELETE_TABLE', payload: table.id }); };
    const accent = table.color?.startsWith('#') ? table.color : undefined;
    const relationships = state.relationships.filter(relation => relation.fromTable === table.id || relation.toTable === table.id);
    return <div ref={nodeRef} className="table-node" data-table-id={table.id} style={{ left: table.position.x, top: table.position.y, '--table-accent': accent }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setContext({ x: event.clientX, y: event.clientY }); }}>
        <div className="table-header" onDoubleClick={() => setEditing(true)}><div className="node-name"><strong>{table.name}</strong>{table.comment && <small title={table.comment}>{table.comment}</small>}</div><div className="node-actions"><button className="icon-button" title="更改颜色" onClick={event => { event.stopPropagation(); setColorOpen(value => !value); }}><span className="node-color" style={{ background: accent || 'var(--accent-primary)' }} /></button><button className="icon-button" title="编辑表结构" onClick={event => { event.stopPropagation(); setEditing(true); }}><Icon name="edit" size={13} /></button><button className="icon-button is-danger" title="删除表" onClick={event => { event.stopPropagation(); remove(); }}><Icon name="close" size={13} /></button></div>{colorOpen && <div style={{ position: 'absolute', top: '100%', right: 8, zIndex: 120 }}><ColorPicker currentColor={table.color} onSelect={color => { dispatch({ type: 'UPDATE_TABLE', payload: { id: table.id, color: color.value } }); setColorOpen(false); }} /></div>}</div>
        <div className="node-columns">{table.columns.map(column => {
            const foreign = state.relationships.some(relation => relation.fromTable === table.id && relation.fromCol === column.id);
            return <div key={column.id} className="table-column" data-column-id={column.id}>
                {['left', 'right'].map(side => <div key={side} className={`connection-dot is-${side} ${foreign ? 'is-foreign' : ''}`} title="拖拽连接" onMouseDown={event => { event.stopPropagation(); event.preventDefault(); onStartConnect(table.id, column.id, event); }} onMouseUp={event => { event.stopPropagation(); event.preventDefault(); onCompleteConnect(table.id, column.id); }} />)}
                <span className={`node-key ${foreign ? 'is-foreign' : ''}`} title={column.isPk ? '主键' : foreign ? '外键' : '普通字段'} onClick={() => dispatch({ type: 'UPDATE_COLUMN', payload: { tableId: table.id, columnId: column.id, updates: { isPk: !column.isPk } } })}>{(column.isPk || foreign) && <Icon name={column.isPk ? 'key' : 'link'} size={12} />}</span><span className="node-column-name" title={column.comment || column.name}>{column.name}</span><code className="node-column-type" title={column.type}>{column.type}</code><button className="icon-button is-danger node-column-delete" title="删除列" onClick={() => dispatch({ type: 'DELETE_COLUMN', payload: { tableId: table.id, columnId: column.id } })}><Icon name="close" size={11} /></button>
            </div>;
        })}</div><div className="node-footer"><span>{table.columns.length} 个字段</span><span>{relationships.length} 条关系</span></div>
        {editing && <TableEditModal table={table} onClose={() => setEditing(false)} onSave={updated => { dispatch({ type: 'UPDATE_TABLE', payload: updated }); setEditing(false); }} />}
        {context && ReactDOM.createPortal(<ContextMenu x={context.x} y={context.y} onClose={() => setContext(null)} options={[{ label: '编辑表结构', action: () => setEditing(true) }, { label: '复制表', action: () => dispatch({ type: 'COPY_TABLE', payload: table.id }) }, { label: '导出表 SQL', action: () => setSql(generateTableSQL(table, dbDialect)) }, { label: '删除表', danger: true, action: remove }]} />, document.body)}
        {sql !== null && ReactDOM.createPortal(<div className="modal-overlay" onClick={() => setSql(null)}><div className="modal-content" style={{ width: 640 }} onClick={event => event.stopPropagation()}><div className="modal-heading"><div><h2>{table.name}</h2><p>数据表 SQL · {dbDialect.toUpperCase()}</p></div><button className="icon-button" title="关闭" onClick={() => setSql(null)}><Icon name="close" /></button></div><textarea className="ui-textarea" value={sql} readOnly style={{ minHeight: 260, fontFamily: 'Consolas, monospace' }} /><div className="modal-footer"><button className="btn" onClick={() => navigator.clipboard.writeText(sql)}><Icon name="copy" size={15} />复制 SQL</button><button className="btn btn-primary" onClick={() => setSql(null)}>完成</button></div></div></div>, document.body)}
    </div>;
}
