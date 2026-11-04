const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

let key;
function encryptionKey() {
    if (key) return key;
    if (process.env.AI_SETTINGS_KEY) {
        if (!/^[a-fA-F0-9]{64}$/.test(process.env.AI_SETTINGS_KEY)) throw new Error('AI_SETTINGS_KEY 必须为 64 位十六进制');
        key = Buffer.from(process.env.AI_SETTINGS_KEY, 'hex');
    } else if (db.databasePath === ':memory:') {
        key = crypto.randomBytes(32);
    } else {
        const file = `${db.databasePath}.key`;
        try { fs.writeFileSync(file, crypto.randomBytes(32), { mode: 0o600, flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
        key = fs.readFileSync(file);
        if (key.length !== 32) throw new Error(`无效的加密密钥文件: ${path.basename(file)}`);
    }
    return key;
}

function encrypt(value, userId) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    cipher.setAAD(Buffer.from(String(userId)));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') });
}

function decrypt(value, userId) {
    const stored = JSON.parse(value);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(stored.iv, 'base64'));
    decipher.setAAD(Buffer.from(String(userId)));
    decipher.setAuthTag(Buffer.from(stored.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.data, 'base64')), decipher.final()]).toString('utf8'));
}

module.exports = { encrypt, decrypt };
