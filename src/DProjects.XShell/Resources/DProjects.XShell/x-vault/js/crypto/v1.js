import CryptoBase, { deriveKey, importKey } from "./base.js";

export default class CryptoV1 extends CryptoBase {
    static async open(metadata, password, initialize = false) {
        const raw = await deriveKey(password, metadata.salt);
        try {
            const cipher = new CryptoV1(await importKey(raw));
            if (initialize) metadata.check = await cipher.encrypt("xvault");
            else if (await cipher.decrypt(metadata.check) !== "xvault") throw new Error("XVault password check failed.");
            return cipher;
        } finally {
            raw.fill(0);
        }
    }
}
