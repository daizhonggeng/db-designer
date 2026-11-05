import { readSpecificationFile, validateSpecificationText } from './specificationFile.js';
import { readPDMFile } from './pdmParser.js';

export async function readChatFile(file) {
    if (!file || !/\.(pdf|docx|txt|md|sql|json|csv|xml|pdm)$/i.test(file.name)) {
        throw new Error('不支持此文件类型，请选择 PDF、DOCX、TXT、MD、SQL、JSON、CSV、XML 或 PDM 文件。');
    }
    if (!file.size) throw new Error('文件为空，请重新选择。');
    if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10 MB。');
    const ext = file.name.split('.').pop().toLowerCase();
    let text;
    if (ext === 'pdm') {
        const schema = await readPDMFile(file);
        text = JSON.stringify(schema);
        if (text.length > 120000) throw new Error('PDM 结构超过 120,000 字符，请拆分后重试。');
    } else if (['pdf', 'docx', 'txt', 'md'].includes(ext)) {
        text = await readSpecificationFile(file);
    } else {
        text = validateSpecificationText(await file.text());
    }
    return { name: file.name.slice(0, 255), text };
}
