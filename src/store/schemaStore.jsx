import React, { createContext, useContext, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import dagre from 'dagre';
import { normalizeColumn, normalizeSchema, normalizeTable } from '../utils/schemaModel';

const SchemaContext = createContext();

const initialState = {
    tables: [],
    relationships: [],
    bookmarks: [],
    clipboard: null,
    past: [],
    future: [],
};

function createSnapshot(state) {
    return {
        tables: state.tables,
        relationships: state.relationships,
        bookmarks: state.bookmarks,
    };
}

function normalizeSnapshot(snapshot) {
    const normalized = normalizeSchema(snapshot || {});
    return {
        tables: normalized.tables,
        relationships: normalized.relationships,
        bookmarks: normalized.bookmarks,
    };
}

function saveHistory(state) {
    const newPast = [...state.past, createSnapshot(state)].slice(-50);
    return {
        ...state,
        past: newPast,
        future: [],
    };
}

function remapTableForAppend(table, tableIdMap, colIdMap) {
    const remapColumnIds = (columnIds = []) =>
        columnIds.map(columnId => colIdMap[columnId]).filter(Boolean);

    const remappedColumns = (table.columns || []).map(column => ({
        ...column,
        id: colIdMap[column.id],
    }));

    const remappedIndexes = (table.indexes || [])
        .map((indexDef) => ({
            ...indexDef,
            id: uuidv4(),
            columnIds: remapColumnIds(indexDef.columnIds),
        }))
        .filter(indexDef => indexDef.columnIds.length > 0);

    const remappedConstraints = (table.constraints || [])
        .map((constraintDef) => ({
            ...constraintDef,
            id: uuidv4(),
            columnIds: remapColumnIds(constraintDef.columnIds),
        }))
        .filter((constraintDef) => {
            if (constraintDef.type === 'check') {
                return Boolean((constraintDef.expression || '').trim());
            }
            return constraintDef.columnIds.length > 0;
        });

    return normalizeTable({
        ...table,
        id: tableIdMap[table.id],
        columns: remappedColumns,
        indexes: remappedIndexes,
        constraints: remappedConstraints,
        position: {
            x: (table.position?.x || 0) + 20,
            y: (table.position?.y || 0) + 20,
        },
    });
}

function schemaReducer(state, action) {
    switch (action.type) {
        case 'LOAD_SCHEMA':
            return { ...initialState, ...normalizeSnapshot(action.payload) };

        case 'IMPORT_SCHEMA': {
            const importState = saveHistory(state);
            const normalized = normalizeSchema(action.payload || {});
            return {
                ...importState,
                tables: normalized.tables,
                relationships: normalized.relationships,
                bookmarks: normalized.bookmarks,
            };
        }

        case 'APPEND_SCHEMA': {
            const appendState = saveHistory(state);
            const incomingSchema = normalizeSchema(action.payload || {});

            const tableIdMap = {};
            const colIdMap = {};

            incomingSchema.tables.forEach((table) => {
                tableIdMap[table.id] = uuidv4();
                table.columns.forEach((column) => {
                    colIdMap[column.id] = uuidv4();
                });
            });

            const newTablesToAppend = incomingSchema.tables
                .map(table => remapTableForAppend(table, tableIdMap, colIdMap));

            const newRelationshipsToAppend = incomingSchema.relationships
                .map((relationship) => ({
                    ...relationship,
                    id: uuidv4(),
                    fromTable: tableIdMap[relationship.fromTable],
                    fromCol: colIdMap[relationship.fromCol],
                    toTable: tableIdMap[relationship.toTable],
                    toCol: colIdMap[relationship.toCol],
                }))
                .filter(relationship =>
                    relationship.fromTable &&
                    relationship.toTable &&
                    relationship.fromCol &&
                    relationship.toCol
                );

            return {
                ...appendState,
                tables: [...appendState.tables, ...newTablesToAppend],
                relationships: [...appendState.relationships, ...newRelationshipsToAppend],
            };
        }

        case 'PUSH_HISTORY': {
            const historyState = normalizeSnapshot(action.payload);
            return {
                ...state,
                past: [...state.past, historyState].slice(-50),
                future: [],
            };
        }

        case 'SNAPSHOT':
            return saveHistory(state);

        case 'UNDO': {
            if (state.past.length === 0) return state;
            const previous = normalizeSnapshot(state.past[state.past.length - 1]);
            const newPast = state.past.slice(0, -1);
            return {
                ...state,
                past: newPast,
                future: [createSnapshot(state), ...state.future],
                tables: previous.tables,
                relationships: previous.relationships,
                bookmarks: previous.bookmarks,
            };
        }

        case 'REDO': {
            if (state.future.length === 0) return state;
            const next = normalizeSnapshot(state.future[0]);
            const newFuture = state.future.slice(1);
            return {
                ...state,
                past: [...state.past, createSnapshot(state)],
                future: newFuture,
                tables: next.tables,
                relationships: next.relationships,
                bookmarks: next.bookmarks,
            };
        }

        case 'COPY_TABLE': {
            const tableToCopy = state.tables.find(table => table.id === action.payload);
            if (!tableToCopy) return state;
            return { ...state, clipboard: { type: 'table', data: tableToCopy } };
        }

        case 'PASTE_TABLE': {
            if (!state.clipboard || state.clipboard.type !== 'table') return state;
            const newStateAfterPaste = saveHistory(state);
            const pastedTable = normalizeTable(state.clipboard.data);

            const colIdMap = {};
            pastedTable.columns.forEach((column) => {
                colIdMap[column.id] = uuidv4();
            });

            const remapColumnIds = (columnIds = []) =>
                columnIds.map(columnId => colIdMap[columnId]).filter(Boolean);

            const newTable = normalizeTable({
                ...pastedTable,
                id: uuidv4(),
                name: `${pastedTable.name}_copy`,
                position: {
                    x: pastedTable.position.x + 20,
                    y: pastedTable.position.y + 20,
                },
                columns: pastedTable.columns.map(column => ({
                    ...column,
                    id: colIdMap[column.id],
                })),
                indexes: (pastedTable.indexes || [])
                    .map(indexDef => ({
                        ...indexDef,
                        id: uuidv4(),
                        columnIds: remapColumnIds(indexDef.columnIds),
                    }))
                    .filter(indexDef => indexDef.columnIds.length > 0),
                constraints: (pastedTable.constraints || [])
                    .map(constraintDef => ({
                        ...constraintDef,
                        id: uuidv4(),
                        columnIds: remapColumnIds(constraintDef.columnIds),
                    }))
                    .filter((constraintDef) => {
                        if (constraintDef.type === 'check') {
                            return Boolean((constraintDef.expression || '').trim());
                        }
                        return constraintDef.columnIds.length > 0;
                    }),
                bookmarkId: null,
            });

            return {
                ...newStateAfterPaste,
                tables: [...newStateAfterPaste.tables, newTable],
            };
        }

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
                        ...action.payload,
                    },
                ],
            };

        case 'UPDATE_BOOKMARK':
            return {
                ...state,
                bookmarks: state.bookmarks.map(bookmark =>
                    bookmark.id === action.payload.id
                        ? { ...bookmark, ...action.payload.updates }
                        : bookmark
                ),
            };

        case 'MOVE_BOOKMARK': {
            const { id, dx, dy } = action.payload;
            const updatedBookmarks = state.bookmarks.map(bookmark =>
                bookmark.id === id
                    ? { ...bookmark, x: bookmark.x + dx, y: bookmark.y + dy }
                    : bookmark
            );
            const updatedTables = state.tables.map(table =>
                table.bookmarkId === id
                    ? { ...table, position: { x: table.position.x + dx, y: table.position.y + dy } }
                    : table
            );
            return {
                ...state,
                bookmarks: updatedBookmarks,
                tables: updatedTables,
            };
        }

        case 'DELETE_BOOKMARK':
            return {
                ...saveHistory(state),
                bookmarks: state.bookmarks.filter(bookmark => bookmark.id !== action.payload),
                tables: state.tables.map(table =>
                    table.bookmarkId === action.payload
                        ? { ...table, bookmarkId: null }
                        : table
                ),
            };

        case 'ASSIGN_TABLE_TO_BOOKMARK':
            return {
                ...state,
                tables: state.tables.map(table =>
                    table.id === action.payload.tableId
                        ? { ...table, bookmarkId: action.payload.bookmarkId }
                        : table
                ),
            };

        case 'ADD_TABLE': {
            let serial = state.tables.length + 1;
            while (state.tables.some(table => table.name === `table_${serial}`)) serial += 1;
            const newTable = normalizeTable({
                id: uuidv4(),
                name: `table_${serial}`,
                position: { x: 70 + (state.tables.length % 3) * 420, y: 110 + Math.floor(state.tables.length / 3) * 380 },
                columns: [
                    {
                        id: uuidv4(),
                        name: 'id',
                        type: 'VARCHAR(255)',
                        isPk: true,
                        nullable: false,
                        defaultValue: '',
                        isUnique: true,
                        isAutoIncrement: false,
                    },
                ],
                indexes: [],
                constraints: [],
                bookmarkId: null,
            });

            return {
                ...saveHistory(state),
                tables: [...state.tables, newTable],
            };
        }

        case 'UPDATE_TABLE': {
            const tables = state.tables.map(table => table.id === action.payload.id ? normalizeTable({ ...table, ...action.payload }) : table);
            const table = tables.find(item => item.id === action.payload.id);
            const columnIds = new Set(table?.columns.map(column => column.id));
            return {
                ...saveHistory(state),
                tables,
                relationships: state.relationships.filter(relationship =>
                    (relationship.fromTable !== table?.id || columnIds.has(relationship.fromCol)) &&
                    (relationship.toTable !== table?.id || columnIds.has(relationship.toCol))
                ),
            };
        }

        case 'DELETE_TABLE':
            return {
                ...saveHistory(state),
                tables: state.tables.filter(table => table.id !== action.payload),
                relationships: state.relationships.filter(
                    relationship =>
                        relationship.fromTable !== action.payload &&
                        relationship.toTable !== action.payload
                ),
            };

        case 'ADD_COLUMN':
            return {
                ...saveHistory(state),
                tables: state.tables.map(table => (table.id === action.payload.tableId
                    ? normalizeTable({
                        ...table,
                        columns: [
                            ...table.columns,
                            normalizeColumn({
                                id: uuidv4(),
                                name: 'new_col',
                                type: 'VARCHAR(255)',
                                isPk: false,
                                nullable: true,
                                defaultValue: '',
                                isUnique: false,
                                isAutoIncrement: false,
                                comment: '',
                            }),
                        ],
                    })
                    : table)),
            };

        case 'UPDATE_COLUMN':
            return {
                ...saveHistory(state),
                tables: state.tables.map(table => (table.id === action.payload.tableId
                    ? normalizeTable({
                        ...table,
                        columns: table.columns.map(column => (column.id === action.payload.columnId
                            ? normalizeColumn({ ...column, ...action.payload.updates })
                            : column)),
                    })
                    : table)),
            };

        case 'DELETE_COLUMN':
            return {
                ...saveHistory(state),
                tables: state.tables.map((table) => {
                    if (table.id !== action.payload.tableId) {
                        return table;
                    }

                    const remainingColumns = table.columns.filter(column => column.id !== action.payload.columnId);

                    const remainingIndexes = (table.indexes || [])
                        .map(indexDef => ({
                            ...indexDef,
                            columnIds: (indexDef.columnIds || []).filter(columnId => columnId !== action.payload.columnId),
                        }))
                        .filter(indexDef => indexDef.columnIds.length > 0);

                    const remainingConstraints = (table.constraints || [])
                        .map(constraintDef => ({
                            ...constraintDef,
                            columnIds: (constraintDef.columnIds || []).filter(columnId => columnId !== action.payload.columnId),
                        }))
                        .filter((constraintDef) => {
                            if (constraintDef.type === 'check') {
                                return Boolean((constraintDef.expression || '').trim());
                            }
                            return constraintDef.columnIds.length > 0;
                        });

                    return normalizeTable({
                        ...table,
                        columns: remainingColumns,
                        indexes: remainingIndexes,
                        constraints: remainingConstraints,
                    });
                }),
                relationships: state.relationships.filter(relationship =>
                    relationship.fromCol !== action.payload.columnId &&
                    relationship.toCol !== action.payload.columnId
                ),
            };

        case 'MOVE_TABLE':
            return {
                ...state,
                tables: state.tables.map(table => (table.id === action.payload.id
                    ? { ...table, position: action.payload.position }
                    : table)),
            };

        case 'RESIZE_TABLE':
            return {
                ...state,
                tables: state.tables.map(table => (table.id === action.payload.id
                    ? { ...table, width: action.payload.width, height: action.payload.height }
                    : table)),
            };

        case 'ADD_RELATIONSHIP':
            return {
                ...saveHistory(state),
                relationships: [...state.relationships, { id: uuidv4(), ...action.payload }],
            };

        case 'DELETE_RELATIONSHIP':
            return {
                ...saveHistory(state),
                relationships: state.relationships.filter(relationship => relationship.id !== action.payload),
            };

        case 'AUTO_LAYOUT': {
            const layoutState = saveHistory(state);
            const { tables, relationships } = layoutState;

            const graph = new dagre.graphlib.Graph();
            graph.setGraph({
                rankdir: action.payload || 'LR',
                nodesep: 50,
                ranksep: 100,
                marginx: 50,
                marginy: 50,
            });
            graph.setDefaultEdgeLabel(() => ({}));

            tables.forEach((table) => {
                graph.setNode(table.id, {
                    width: table.width || 240,
                    height: table.height || 300,
                });
            });

            relationships.forEach((relationship) => {
                graph.setEdge(relationship.fromTable, relationship.toTable);
            });

            dagre.layout(graph);

            const newTables = tables.map((table) => {
                const node = graph.node(table.id);
                return {
                    ...table,
                    position: {
                        x: node.x - (table.width || 240) / 2,
                        y: node.y - (table.height || 300) / 2,
                    },
                };
            });

            return {
                ...layoutState,
                tables: newTables,
            };
        }

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
