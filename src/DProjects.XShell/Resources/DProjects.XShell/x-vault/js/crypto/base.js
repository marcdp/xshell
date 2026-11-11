import { argon2idAsync } from "../../vendor/argon2.js";
import { decodeBase64, encodeBase64 } from "../meta.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export async function deriveKey(password, salt) {
    if (typeof password !== "string" || !password || !password.isWellFormed()) throw new Error("A valid nonempty password is required.");
    const bytes = encoder.encode(password);
    try {
        return await argon2idAsync(bytes, Uint8Array.from(salt.match(/../g), value => parseInt(value, 16)), {
            t: 5, m: 131072, p: 4, dkLen: 32, version: 0x13, asyncTick: 10
        });
    } finally {
        bytes.fill(0);
    }
}

export async function importKey(bytes) {
    return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptBytes(key, bytes, additionalData) {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128, additionalData }, key, bytes));
    const blob = new Uint8Array(nonce.length + ciphertext.length);
    blob.set(nonce);
    blob.set(ciphertext, nonce.length);
    return encodeBase64(blob);
}

export async function decryptBytes(key, value, additionalData) {
    const blob = decodeBase64(value);
    if (blob.length < 28) throw new Error("Invalid xvault ciphertext length.");
    try {
        return new Uint8Array(await crypto.subtle.decrypt({
            name: "AES-GCM", iv: blob.subarray(0, 12), tagLength: 128, additionalData
        }, key, blob.subarray(12)));
    } catch {
        throw new Error("XVault authentication failed: incorrect password or damaged ciphertext.");
    }
}

export default class CryptoBase {
    #key;

    constructor(key) {
        this.#key = key;
    }

    async encrypt(value) {
        if (!value.isWellFormed()) throw new Error("Invalid Unicode in secret.");
        const bytes = encoder.encode(value);
        try {
            return await encryptBytes(this.#key, bytes);
        } finally {
            bytes.fill(0);
        }
    }

    async decrypt(value) {
        const bytes = await decryptBytes(this.#key, value);
        try {
            return decoder.decode(bytes);
        } finally {
            bytes.fill(0);
        }
    }
}
