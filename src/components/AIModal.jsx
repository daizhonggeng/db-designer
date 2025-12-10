import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { generateSchema } from '../services/aiService';
import { useSchema } from '../store/schemaStore';

export default function AIModal({ onClose }) {
    const { dispatch } = useSchema();
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const fileInputRef = useRef(null);

    // Draggable State - Centered Initial Position
    const [position, setPosition] = useState({
        x: window.innerWidth / 2 - 350,
        y: window.innerHeight / 2 - 300
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const handleGenerate = async () => {
        if (!description.trim() && !image) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const data = await generateSchema(description, image);
            setResult(data);
        } catch (err) {
            setError(err.message || "生成失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (result && result.schema) {
            dispatch({ type: 'APPEND_SCHEMA', payload: result.schema });
            onClose();
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onloadend = () => setImage(reader.result);
                reader.readAsDataURL(blob);
            }
        }
    };

    return ReactDOM.createPortal(
        <div
            className="glass"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: '700px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--bg-panel)',
                boxShadow: 'var(--shadow-glow)',
                zIndex: 9999, // Ensure it's on top of everything
                border: '1px solid var(--glass-border)'
            }}
        >
            {/* Header (Drag Handle) */}
            <div
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    marginBottom: 'var(--spacing-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--glass-border)'
                }}
                onMouseDown={handleMouseDown}
            >
                <h2 style={{ color: 'var(--accent-primary)', margin: 0, fontSize: '1.2rem', pointerEvents: 'none' }}>
                    ✨ AI 自动设计
                </h2>
                <button
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        lineHeight: 1
                    }}
                >
                    &times;
                </button>
            </div>

            {!result ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        描述您的系统需求，或者上传图片。
                    </p>

                    <div
                        style={{ display: 'flex', gap: '1rem', height: '200px' }}
                        onPaste={handlePaste}
                    >
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="请输入系统描述..."
                            style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-primary)',
                                padding: 'var(--spacing-sm)',
                                borderRadius: 'var(--radius-sm)',
                                resize: 'none'
                            }}
                        />

                        <div
                            style={{
                                flex: 1,
                                border: '2px dashed var(--glass-border)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                background: 'rgba(0,0,0,0.1)'
                            }}
                            onClick={() => fileInputRef.current.click()}
                        >
                            {image ? (
                                <>
                                    <img src={image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        background: 'rgba(0,0,0,0.6)', color: 'white',
                                        fontSize: '0.8rem', textAlign: 'center', padding: '4px'
                                    }}>
                                        点击更换 (或 Ctrl+V 粘贴)
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <p>点击上传图片</p>
                                    <p style={{ fontSize: '0.8rem' }}>或直接粘贴 (Ctrl+V)</p>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom: 'var(--spacing-md)', overflowY: 'auto', flex: 1 }}>
                    <h3 style={{ fontSize: '1rem', color: '#818cf8', marginBottom: '0.5rem' }}>思考过程：</h3>
                    <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.9rem',
                        color: '#cbd5e1',
                        whiteSpace: 'pre-wrap',
                        borderLeft: '3px solid #818cf8',
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}>
                        {result.reasoning}
                    </div>
                    <p style={{ marginTop: '1rem', color: '#4ade80' }}>
                        ✓ 数据库结构已生成！
                    </p>
                </div>
            )}

            {error && (
                <div style={{ color: '#ef4444', marginBottom: 'var(--spacing-sm)', fontSize: '0.9rem' }}>
                    错误: {error}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)', marginTop: 'auto', paddingTop: '1rem' }}>
                <button
                    className="btn"
                    onClick={onClose}
                    disabled={loading}
                >
                    取消
                </button>

                {!result ? (
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerate}
                        disabled={loading || (!description.trim() && !image)}
                        style={{ minWidth: '100px' }}
                    >
                        {loading ? '思考中...' : '开始生成'}
                    </button>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={handleApply}
                        style={{ minWidth: '100px' }}
                    >
                        应用设计
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}
