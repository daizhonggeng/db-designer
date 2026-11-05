export function validateAIProfile(profile) {
    const name = profile.name.trim();
    if (!name) throw new Error('请输入配置名称。');
    const fields = ['apiUrl', 'apiKey', 'modelText', 'modelVision'];
    const settings = Object.fromEntries(fields.map(field => [field, profile.settings[field].trim()]));
    try {
        const url = new URL(settings.apiUrl);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
            throw new Error();
        }
    } catch {
        throw new Error('请输入有效的 HTTP(S) 接口地址，不要包含账号、查询参数或片段。');
    }
    if (!settings.apiKey || !settings.modelText || !settings.modelVision) {
        throw new Error('请填写 API 密钥、文字模型和图片模型。');
    }
    return { ...profile, name, settings };
}

export function activateAIProfile(profiles, id) {
    if (!profiles.some(profile => profile.id === id)) throw new Error('配置不存在，请刷新列表。');
    return profiles.map(profile => ({ ...profile, active: profile.id === id }));
}
