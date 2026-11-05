export async function readChatFile(file) {
    if (!file?.name || !file.size) throw new Error('文件为空，请重新选择。');
    if (file.size > 10 * 1024 * 1024) throw new Error('单个文件不能超过10 MB。');
    const mime = /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(file.type) ? file.type : 'application/octet-stream';
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { name: file.name.slice(0, 255), dataUrl: `data:${mime};base64,${btoa(binary)}` };
}
