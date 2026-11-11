const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function encodeBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_");
}

export function decodeBase64(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]*={0,2}$/.test(value) || value.length % 4 !== 0) {
        throw new Error("Invalid xvault base64url encoding.");
    }
    const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
    if (encodeBase64(bytes) !== value) throw new Error("Invalid xvault base64url padding.");
    return bytes;
}

export function validateMetadata(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid xvault metadata object.");
    const version = Object.hasOwn(data, "crypto_version") ? data.crypto_version : 1;
    if (version !== 1 && version !== 2) throw new Error("Unsupported xvault crypto version.");
    if (typeof data.salt !== "string" || !/^[a-fA-F0-9]{32}$/.test(data.salt)) throw new Error("Invalid xvault salt.");
    const field = version === 1 ? "check" : "encrypted_key";
    if (Object.keys(data).some(key => !["crypto_version", "salt", field].includes(key))) throw new Error("Unexpected xvault metadata field.");
    const blob = decodeBase64(data[field]);
    if (blob.length !== (version === 1 ? 34 : 60)) throw new Error(`Invalid xvault ${field} length.`);
    return { crypto_version: version, salt: data.salt, [field]: data[field] };
}

export function decodeMetadata(value) {
    if (typeof value !== "string" || !value.startsWith("xvault:")) throw new Error("Invalid _xvault metadata value.");
    try {
        const json = decoder.decode(decodeBase64(value.slice(7)));
        const names = new Set();
        for (const match of json.matchAll(/("(?:\\.|[^"\\])*")\s*:/g)) {
            const name = JSON.parse(match[1]);
            if (names.has(name)) throw new Error("Duplicate metadata field.");
            names.add(name);
        }
        return validateMetadata(JSON.parse(json));
    } catch {
        throw new Error("Invalid _xvault metadata.");
    }
}

export function encodeMetadata(metadata) {
    return "xvault:" + encodeBase64(encoder.encode(JSON.stringify(validateMetadata(metadata))));
}
