import { decodeBase64, validateMetadata } from "../js/meta.js";
import CryptoV1 from "../js/crypto/v1.js";
import CryptoV2 from "../js/crypto/v2.js";
import HandlerEnv from "../js/handlers/env.js";
import HandlerJson from "../js/handlers/json.js";
import HandlerJsonc from "../js/handlers/jsonc.js";
import HandlerYaml from "../js/handlers/yaml.js";
import HandlerMarkdown from "../js/handlers/markdown.js";
import HandlerOvpn from "../js/handlers/ovpn.js";

const handlers = { env: HandlerEnv, json: HandlerJson, jsonc: HandlerJsonc, yaml: HandlerYaml, markdown: HandlerMarkdown, ovpn: HandlerOvpn };

function selectFormat(text, format) {
    if (format === "yml") format = "yaml";
    if (format === "md") format = "markdown";
    if (format !== undefined) {
        if (!Object.hasOwn(handlers, format)) throw new Error("Unsupported xvault format.");
        return format;
    }
    // use only distinctive syntax; ambiguous YAML/Markdown/plaintext requires the caller's format
    if (/^---\r?\n/.test(text) && /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(text)) return "markdown";
    if (/^#[ \t]*_xvault[ \t]*=/m.test(text)) return "ovpn";
    if (/^[ \t]*_xvault[ \t]*=/m.test(text)) return "env";
    const jsonStart = text.replace(/^(?:\s|\/\/[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*/, "");
    if (jsonStart.startsWith("{")) {
        try { JSON.parse(text); return "json"; } catch { return "jsonc"; }
    }
    const envLines = text.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith("#"));
    if (envLines.length && envLines.every(line => /^[ \t]*(?:export[ \t]+)?[A-Za-z_][A-Za-z0-9_]*[ \t]*=/.test(line))) return "env";
    throw new Error("Ambiguous xvault format; supply options.format.");
}

function checkText(text) {
    if (typeof text !== "string" || !text.isWellFormed()) throw new Error("XVault text must be a valid Unicode string.");
}

function checkUninitialized(handler, text) {
    for (const token of handler.tokens(text)) {
        try {
            if (decodeBase64(token.value).length < 28) continue;
        } catch { continue; }
        throw new Error("Ciphertext-like marker without metadata; refusing to initialize a replacement vault.");
    }
}

async function reveal(handler, parsed, cipher) {
    const original = handler.describe(parsed.text);
    const values = [];
    for (const token of original.tokens) {
        token.ciphertext = token.value;
        token.value = await cipher.decrypt(token.ciphertext);
        values.push(handler.marker(token, token.value));
    }
    const text = handler.replace(parsed.text, original.tokens, values);
    const editable = handler.describe(text);
    // refuse values that the textual Python marker grammar cannot represent losslessly in an editor
    if (original.skeleton !== editable.skeleton || original.tokens.some((token, i) => token.value !== editable.tokens[i]?.value)) {
        throw new Error("Decrypted secret cannot be represented safely with this format's marker delimiters.");
    }
    if (handler.parse(text).metadata) throw new Error("Decrypted text must not introduce _xvault metadata.");
    return { ...original, text };
}

function preserveCiphertext(handler, original, edited) {
    const preserved = new Map();
    const oldPlain = handler.describe(original.text);
    const oldOutside = handler.replace(original.text, oldPlain.tokens, oldPlain.tokens.map(() => ""));
    const newOutside = handler.replace(edited.text, edited.tokens, edited.tokens.map(() => ""));
    for (const token of original.tokens) {
        // counts alone are unsafe: deleting a public copy could hide exposure in a protected field
        if (token.value && newOutside.includes(token.value) && oldOutside !== newOutside) {
            throw new Error("Unsafe marker removal: a previously protected secret is exposed in the edited document.");
        }
    }
    if (original.skeleton === edited.skeleton) {
        original.tokens.forEach((token, index) => {
            if (token.value === edited.tokens[index].value) preserved.set(index, token.ciphertext);
        });
        return preserved;
    }
    const oldContexts = Map.groupBy(original.tokens, token => token.context);
    const newContexts = Map.groupBy(edited.tokens, token => token.context);
    edited.tokens.forEach((token, index) => {
        const candidates = oldContexts.get(token.context) || [];
        if (!candidates.length) return;
        if (candidates.length !== 1 || newContexts.get(token.context).length !== 1) {
            throw new Error("Ambiguous protected occurrences after structural editing.");
        }
        if (candidates[0].value === token.value) preserved.set(index, candidates[0].ciphertext);
    });
    return preserved;
}

export default class XVault {
    async decrypt(text, password, options = {}) {
        checkText(text);
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Invalid xvault options.");
        const format = selectFormat(text, options.format);
        const handler = new handlers[format]();
        const parsed = handler.parse(text);
        if (!parsed.metadata) {
            checkUninitialized(handler, text);
            return { text, context: { kind: "new", format, cryptoVersion: 2 } };
        }
        const cryptoVersion = parsed.metadata.crypto_version;
        const cipher = await (cryptoVersion === 1 ? CryptoV1 : CryptoV2).open(parsed.metadata, password);
        const editable = await reveal(handler, parsed, cipher);
        return { text: editable.text, context: { kind: "existing", format, cryptoVersion, metadata: parsed.metadata, originalText: text } };
    }

    async encrypt(text, password, context) {
        checkText(text);
        if (!context || typeof context !== "object" || Array.isArray(context) || !["new", "existing"].includes(context.kind)) {
            throw new Error("A valid xvault encryption context is required.");
        }
        if (typeof context.format !== "string") throw new Error("Missing context format.");
        const format = selectFormat(text, context.format);
        const handler = new handlers[format]();
        const editedMetadata = handler.parse(text);
        if (editedMetadata.metadata) throw new Error("Editable text must not contain _xvault metadata.");
        const edited = handler.describe(text);
        let parsed;
        let cipher;
        let originalText;
        let sameStructure = false;
        let preserved = new Map();
        if (context.kind === "new") {
            if (context.originalText !== undefined || context.metadata !== undefined) throw new Error("Inconsistent new-vault context.");
            const version = Object.hasOwn(context, "cryptoVersion") ? context.cryptoVersion : 2;
            if (version !== 1 && version !== 2) throw new Error("Unsupported xvault crypto version.");
            checkUninitialized(handler, text);
            const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
            parsed = { ...editedMetadata, metadata: { crypto_version: version, salt } };
            cipher = await (version === 1 ? CryptoV1 : CryptoV2).open(parsed.metadata, password, true);
        } else {
            originalText = context.originalText;
            checkText(originalText);
            parsed = handler.parse(originalText);
            const metadata = validateMetadata(context.metadata);
            if (!parsed.metadata || context.cryptoVersion !== parsed.metadata.crypto_version ||
                JSON.stringify(metadata) !== JSON.stringify(parsed.metadata)) throw new Error("Inconsistent xvault context metadata.");
            cipher = await (metadata.crypto_version === 1 ? CryptoV1 : CryptoV2).open(parsed.metadata, password);
            const original = await reveal(handler, parsed, cipher);
            if (original.text === text) return originalText;
            preserved = preserveCiphertext(handler, original, edited);
            sameStructure = original.skeleton === edited.skeleton;
        }
        const values = [];
        for (const [index, token] of edited.tokens.entries()) {
            values.push(handler.marker(token, preserved.get(index) ?? await cipher.encrypt(token.value)));
        }
        const encrypted = handler.replace(text, edited.tokens, values);
        // retain every original metadata byte and its placement for value-only edits
        const result = sameStructure ? handler.replace(originalText, handler.tokens(originalText), values) : handler.restore(encrypted, parsed);
        const verified = handler.parse(result);
        if (JSON.stringify(verified.metadata) !== JSON.stringify(parsed.metadata)) throw new Error("Unable to restore xvault metadata safely.");
        const roundTrip = await reveal(handler, verified, cipher);
        if (roundTrip.tokens.length !== edited.tokens.length || roundTrip.tokens.some((token, index) => token.value !== edited.tokens[index].value)) {
            throw new Error("Unable to preserve the edited xvault markers safely.");
        }
        return result;
    }
}
