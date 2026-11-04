export const MAX_SPECIFICATION_SIZE = 10 * 1024 * 1024;
export const MAX_SPECIFICATION_LENGTH = 60000;

export function validateSpecificationFile(file) {
    if (!file || !/\.(pdf|docx|txt|md)$/i.test(file.name)) {
        throw new Error('请选择 PDF、DOCX、TXT 或 Markdown 文件，旧版 DOC 请先另存为 DOCX。');
    }
    if (file.size === 0) throw new Error('文件为空，请重新选择。');
    if (file.size > MAX_SPECIFICATION_SIZE) throw new Error('规范文件不能超过 10 MB。');
}

export function validateSpecificationText(text) {
    const normalized = text.replaceAll('\0', '').trim();
    if (!normalized) {
        throw new Error('未提取到可读文字。扫描版 PDF 请先进行 OCR，或改用文本文件。');
    }
    if (normalized.length > MAX_SPECIFICATION_LENGTH) {
        throw new Error('规范正文超过 60,000 字符，请拆分或精简后重新上传。');
    }
    return normalized;
}

export async function readSpecificationFile(file) {
    validateSpecificationFile(file);
    const extension = file.name.split('.').pop().toLowerCase();
    let text;

    if (extension === 'docx') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value;
    } else if (extension === 'pdf') {
        const pdfjs = await import('pdfjs-dist');
        const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
        try {
            const pdf = await task.promise;
            const pages = [];
            let length = 0;
            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                const page = await pdf.getPage(pageNumber);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
                length += pageText.length;
                if (length > MAX_SPECIFICATION_LENGTH) {
                    throw new Error('规范正文超过 60,000 字符，请拆分或精简后重新上传。');
                }
                pages.push(pageText);
                page.cleanup();
            }
            text = pages.join('\n\n');
        } finally {
            await task.destroy();
        }
    } else {
        text = await file.text();
    }

    return validateSpecificationText(text);
}
