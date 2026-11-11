import CryptoBase, { deriveKey, importKey, encryptBytes, decryptBytes } from "./base.js";

const aad = new TextEncoder().encode("xvault:v2:dek");

export default class CryptoV2 extends CryptoBase {
    static async open(metadata, password, initialize = false) {
        const raw = await deriveKey(password, metadata.salt);
        let dek;
        try {
            const kek = await importKey(raw);
            if (initialize) {
                dek = crypto.getRandomValues(new Uint8Array(32));
                metadata.encrypted_key = await encryptBytes(kek, dek, aad);
            } else {
                dek = await decryptBytes(kek, metadata.encrypted_key, aad);
                if (dek.length !== 32) throw new Error("Invalid unwrapped xvault key length.");
            }
            return new CryptoV2(await importKey(dek));
        } finally {
            raw.fill(0);
            dek?.fill(0);
        }
    }
}
