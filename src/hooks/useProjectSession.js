import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiPut } from '../services/api';
import { getStoredUser } from '../utils/storage';
import { normalizeSchema } from '../utils/schemaModel';
import { projectSnapshot } from '../utils/projectData';

function readDraft(key, savedContent) {
    try {
        const draft = JSON.parse(localStorage.getItem(key));
        return draft?.schema && JSON.stringify(draft.schema) !== savedContent ? draft : null;
    } catch {
        return null;
    }
}

export default function useProjectSession(initialProject, state) {
    const [project, setProject] = useState(initialProject);
    const [savedContent, setSavedContent] = useState(() => JSON.stringify(normalizeSchema(initialProject.schema_data)));
    const draftKey = `db-designer:draft:${getStoredUser()?.id}:${project.id}`;
    const [recovery, setRecovery] = useState(() => readDraft(draftKey, savedContent));
    const [autoSave, setAutoSave] = useState(true);
    const [status, setStatus] = useState('saved');
    const [error, setError] = useState('');
    const [draftError, setDraftError] = useState(false);
    const [notice, setNotice] = useState('');
    const savingRef = useRef(false);
    const { tables, relationships, bookmarks } = state;
    const content = useMemo(() => JSON.stringify(projectSnapshot({ tables, relationships, bookmarks })), [tables, relationships, bookmarks]);
    const dirty = content !== savedContent;

    const save = useCallback(async (createVersion = false, name) => {
        if (savingRef.current || recovery || status === 'conflict') return false;
        savingRef.current = true;
        setStatus('saving');
        setError('');
        try {
            const saved = await apiPut(`/api/projects/${project.id}`, {
                schema: JSON.parse(content),
                expectedRevision: project.revision,
                createVersion,
                ...(name === undefined ? {} : { name }),
            });
            setProject(saved);
            setSavedContent(content);
            setStatus('saved');
            if (createVersion) setNotice('已保存，并创建了一个历史版本');
            return true;
        } catch (failure) {
            setStatus(failure.status === 409 ? 'conflict' : 'error');
            setError(failure.message || '暂时无法保存，请稍后重试');
            return false;
        } finally {
            savingRef.current = false;
        }
    }, [content, project.id, project.revision, recovery, status]);

    useEffect(() => {
        if (recovery) return;
        try {
            if (dirty) {
                localStorage.setItem(draftKey, JSON.stringify({ schema: JSON.parse(content), savedAt: Date.now() }));
            } else {
                localStorage.removeItem(draftKey);
            }
        } catch {
            setDraftError(true);
        }
    }, [content, dirty, draftKey, recovery]);

    useEffect(() => {
        if (!autoSave || !dirty || recovery || ['saving', 'conflict', 'error'].includes(status)) return;
        const timer = setTimeout(() => save(), 1500);
        return () => clearTimeout(timer);
    }, [autoSave, dirty, recovery, save, status]);

    useEffect(() => {
        const beforeUnload = event => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = '';
        };
        const keyboard = event => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                if (!document.querySelector('.modal-overlay')) save(true);
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('keydown', keyboard);
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            window.removeEventListener('keydown', keyboard);
        };
    }, [dirty, save]);

    const resolveRecovery = () => {
        setRecovery(null);
        localStorage.removeItem(draftKey);
    };

    return { project, dirty, autoSave, setAutoSave, status, error, draftError, recovery, resolveRecovery, save, notice, setNotice };
}
