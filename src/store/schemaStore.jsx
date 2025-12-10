import React, { createContext, useContext, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import dagre from 'dagre';

const SchemaContext = createContext();

const initialState = {
    tables: [],
    relationships: [],
    bookmarks: [],
    clipboard: null,
    past: [],
    future: []
};

// Helper to save current state to history
const saveHistory = (state) => {
    const { tables, relationships, bookmarks } = state;
    // Limit history stack to 50 steps to prevent memory issues
    const newPast = [...state.past, { tables, relationships, bookmarks }].slice(-50);
    return {
        ...state,
        past: newPast,
        future: []
    };
};

function schemaReducer(state, action) {
    switch (action.type) {
        case 'IMPORT_SCHEMA':
            // 保存当前状态到历史，然后导入新的 schema
            const importState = saveHistory(state);
            return {
                ...importState,
                tables: action.payload.tables || [],
                relationships: action.payload.relationships || [],
                bookmarks: action.payload.bookmarks || []
            };

        case 'APPEND_SCHEMA':
            const appendState = saveHistory(state);
            const incomingSchema = action.payload;

            // 1. Create ID Mappings to ensure uniqueness
            const tableIdMap = {};
            const colIdMap = {};

            (incomingSchema.tables || []).forEach(t => {
                tableIdMap[t.id] = uuidv4();
                (t.columns || []).forEach(c => {
                    colIdMap[c.id] = uuidv4();
                });
            });

            // 2. Remap Tables
            // Calculate an offset to avoid perfect overlap if adding multiple times
            // Simple heuristic: shift by 20px * number of existing tables (modulo something to keep it on screen)
            const offset = state.tables.length * 20;

            const newTablesToAppend = (incomingSchema.tables || []).map(t => ({
                ...t,
                id: tableIdMap[t.id],
                columns: (t.columns || []).map(c => ({
                    ...c,
                    id: colIdMap[c.id]
                })),
                position: {
                    x: (t.position?.x || 0) + 20, // Slight offset from original to show it's new
                    y: (t.position?.y || 0) + 20
                }
            }));

            // 3. Remap Relationships
            const newRelationshipsToAppend = (incomingSchema.relationships || []).map(r => ({
                ...r,
                id: uuidv4(),
                fromTable: tableIdMap[r.fromTable],
                fromCol: colIdMap[r.fromCol],
                toTable: tableIdMap[r.toTable],
                toCol: colIdMap[r.toCol]
            })).filter(r => r.fromTable && r.toTable); // Filter out broken relationships if any

            return {
                ...appendState,
                tables: [...appendState.tables, ...newTablesToAppend],
                relationships: [...appendState.relationships, ...newRelationshipsToAppend]
            };

        case 'PUSH_HISTORY':
            // Push a specific state snapshot to history (used for drag operations)
            const historyState = action.payload;
            return {
                ...state,
                past: [...state.past, historyState].slice(-50),
                future: []
            };

        case 'SNAPSHOT': // Legacy, can be kept for other non-drag actions if needed
            return saveHistory(state);

        case 'UNDO':
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, -1);
            return {
                ...state,
                past: newPast,
                future: [{
                    tables: state.tables,
                    relationships: state.relationships,
                    bookmarks: state.bookmarks
                }, ...state.future],
                tables: previous.tables,
                relationships: previous.relationships,
                bookmarks: previous.bookmarks
            };

        case 'REDO':
            if (state.future.length === 0) return state;
            const next = state.future[0];
            const newFuture = state.future.slice(1);
            return {
                ...state,
                past: [...state.past, {
                    tables: state.tables,
                    relationships: state.relationships,
                    bookmarks: state.bookmarks
                }],
                future: newFuture,
                tables: next.tables,
                relationships: next.relationships,
                bookmarks: next.bookmarks
            };

        // Clipboard Actions
        case 'COPY_TABLE':
            const tableToCopy = state.tables.find(t => t.id === action.payload);
            if (!tableToCopy) return state;
            return { ...state, clipboard: { type: 'table', data: tableToCopy } };

        case 'PASTE_TABLE':
            if (!state.clipboard || state.clipboard.type !== 'table') return state;
            const newStateAfterPaste = saveHistory(state);
            const pastedTable = state.clipboard.data;
            const newTable = {
                ...pastedTable,
                id: uuidv4(),
                name: pastedTable.name + '_copy',
                position: { x: pastedTable.position.x + 20, y: pastedTable.position.y + 20 },
                columns: pastedTable.columns.map(c => ({ ...c, id: uuidv4() })),
                bookmarkId: null // Don't paste into bookmark by default unless logic added
            };
            return {
                ...newStateAfterPaste,
                tables: [...newStateAfterPaste.tables, newTable]
            };

        // Bookmark Actions
        case 'ADD_BOOKMARK':
            return {
                ...saveHistory(state),
                bookmarks: [
                    ...state.bookmarks,
                    {
                        id: uuidv4(),
                        name: '新书签',
                        x: 100,
                        y: 100,
                        width: 400,
                        height: 300,
                        color: 'rgba(255, 255, 255, 0.05)',
                        ...action.payload
                    }
                ]
            };
        case 'UPDATE_BOOKMARK':
            // For simple updates (rename), we might not want to save history every keystroke.
            // But for now, let's save it. Ideally, use onBlur for history.
            return {
                ...state, // Don't save history on every keystroke, rely on SNAPSHOT or specific actions
                bookmarks: state.bookmarks.map(b =>
                    b.id === action.payload.id ? { ...b, ...action.payload.updates } : b
                )
            };
        case 'MOVE_BOOKMARK':
            // Don't save history here, too frequent.
            const { id, dx, dy } = action.payload;
            const updatedBookmarks = state.bookmarks.map(b =>
                b.id === id ? { ...b, x: b.x + dx, y: b.y + dy } : b
            );
            const updatedTables = state.tables.map(t =>
                t.bookmarkId === id ? { ...t, position: { x: t.position.x + dx, y: t.position.y + dy } } : t
            );
            return {
                ...state,
                bookmarks: updatedBookmarks,
                tables: updatedTables
            };
        case 'DELETE_BOOKMARK':
            return {
                ...saveHistory(state),
                bookmarks: state.bookmarks.filter(b => b.id !== action.payload),
                tables: state.tables.map(t => t.bookmarkId === action.payload ? { ...t, bookmarkId: null } : t)
            };
        case 'ASSIGN_TABLE_TO_BOOKMARK':
            return {
                ...state,
                tables: state.tables.map(t =>
                    t.id === action.payload.tableId ? { ...t, bookmarkId: action.payload.bookmarkId } : t
                )
            };

        // Table Actions
        case 'ADD_TABLE':
            return {
                ...saveHistory(state),
                tables: [...state.tables, {
                    id: uuidv4(),
                    name: 'new_table',
                    position: { x: 250, y: 250 },
                    columns: [
                        { id: uuidv4(), name: 'id', type: 'VARCHAR(255)', isPk: true }
                    ],
                    bookmarkId: null
                }]
            };
        case 'UPDATE_TABLE':
            return {
                ...state,
                tables: state.tables.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t)
            };
        case 'DELETE_TABLE':
            return {
                ...saveHistory(state),
                tables: state.tables.filter(t => t.id !== action.payload),
                relationships: state.relationships.filter(r => r.fromTable !== action.payload && r.toTable !== action.payload)
            };
        case 'ADD_COLUMN':
            return {
                ...saveHistory(state),
                tables: state.tables.map(t => t.id === action.payload.tableId ? {
                    ...t,
                    columns: [...t.columns, { id: uuidv4(), name: 'new_col', type: 'VARCHAR(255)', isPk: false }]
                } : t)
            };
        case 'UPDATE_COLUMN':
            return {
                ...state,
                tables: state.tables.map(t => t.id === action.payload.tableId ? {
                    ...t,
                    columns: t.columns.map(c => c.id === action.payload.columnId ? { ...c, ...action.payload.updates } : c)
                } : t)
            };
        case 'DELETE_COLUMN':
            return {
                ...saveHistory(state),
                tables: state.tables.map(t => t.id === action.payload.tableId ? {
                    ...t,
                    columns: t.columns.filter(c => c.id !== action.payload.columnId)
                } : t)
            };
        case 'MOVE_TABLE':
            // No history here
            return {
                ...state,
                tables: state.tables.map(t => t.id === action.payload.id ? {
                    ...t,
                    position: action.payload.position
                } : t)
            };
        case 'RESIZE_TABLE':
            return {
                ...state,
                tables: state.tables.map(t => t.id === action.payload.id ? {
                    ...t,
                    width: action.payload.width,
                    height: action.payload.height
                } : t)
            };
        case 'ADD_RELATIONSHIP':
            return {
                ...saveHistory(state),
                relationships: [...state.relationships, action.payload]
            };
        case 'DELETE_RELATIONSHIP':
            return {
                ...saveHistory(state),
                relationships: state.relationships.filter(r => r.id !== action.payload)
            };

        case 'AUTO_LAYOUT':
            const layoutState = saveHistory(state);
            const { tables, relationships } = layoutState;

            // Use dagre for graph layout
            const g = new dagre.graphlib.Graph();
            g.setGraph({
                rankdir: action.payload || 'LR',
                nodesep: 50,
                ranksep: 100,
                marginx: 50,
                marginy: 50
            });
            g.setDefaultEdgeLabel(() => ({}));
            tables.forEach(t => {
                g.setNode(t.id, { width: t.width || 240, height: t.height || 300 });
            });

            // Add edges (relationships)
            relationships.forEach(r => {
                g.setEdge(r.fromTable, r.toTable);
            });

            // Calculate layout
            dagre.layout(g);

            // Apply new positions
            const newTables = tables.map(t => {
                const node = g.node(t.id);
                return {
                    ...t,
                    position: {
                        x: node.x - (t.width || 240) / 2, // dagre returns center, we need top-left
                        y: node.y - (t.height || 300) / 2
                    }
                };
            });

            return {
                ...layoutState,
                tables: newTables
            };

        default:
            return state;
    }
}

export function SchemaProvider({ children }) {
    const [state, dispatch] = useReducer(schemaReducer, initialState);

    return (
        <SchemaContext.Provider value={{ state, dispatch }}>
            {children}
        </SchemaContext.Provider>
    );
}

export function useSchema() {
    return useContext(SchemaContext);
}
