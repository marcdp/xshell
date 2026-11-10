export default {

    
    /**
     * Encrypts text or bytes using the DProjects AES format.
     *
     * @param {string | Uint8Array | ArrayBuffer} input
     * @param {string} password
     * @param {object} options
     * @returns {Promise<string | Uint8Array>}
     */
    async encrypt(input, password, options = {}) {
        const encoder = new TextEncoder();
        const isString = typeof input === "string";

        if (!isString &&
            !(input instanceof Uint8Array) &&
            !(input instanceof ArrayBuffer)) {
            throw new TypeError("Invalid input type");
        }

        if (typeof password !== "string") {
            throw new TypeError("Password must be a string");
        }

        // C# CryptoSymmetricEncryptAES.Options defaults
        const cfg = {
            iterationsMin: 50000,
            iterationsRandomRange: 50000,
            saltLength: 16,
            ivLength: 16,
            iv: null,
            blockSize: 16,
            paddingMode: "PKCS7",
            cipherMode: "CBC",
            keySize: 32,
            encoding: "Base64",
            fold: 0,
            version: "",
            separator: ",",
            header: true,
            ...options
        };

        const encodingName = String(cfg.encoding).toLowerCase();
        const base64 = encodingName === "base64" || encodingName === "0";

        if (!base64 && encodingName !== "binary" && encodingName !== "1") {
            throw new Error("Unsupported encoding");
        }

        if (!["cbc", "1"].includes(String(cfg.cipherMode).toLowerCase())) {
            throw new Error("Only AES-CBC is supported");
        }

        if (!["pkcs7", "2"].includes(String(cfg.paddingMode).toLowerCase())) {
            throw new Error("Only PKCS7 padding is supported");
        }

        if (cfg.ivLength !== 16 ||
            cfg.blockSize !== 16 ||
            ![16, 24, 32].includes(cfg.keySize)) {
            throw new Error("Invalid AES IV, block or key size");
        }

        if (!Number.isInteger(cfg.saltLength) ||
            cfg.saltLength < 0 ||
            cfg.saltLength > 1048576) {
            throw new Error("Invalid salt length");
        }

        if (!Number.isInteger(cfg.iterationsMin) ||
            cfg.iterationsMin <= 0 ||
            cfg.iterationsMin > 10000000 ||
            !Number.isInteger(cfg.iterationsRandomRange) ||
            cfg.iterationsRandomRange < 0 ||
            cfg.iterationsMin + cfg.iterationsRandomRange > 10000000) {
            throw new Error("Invalid PBKDF2 iterations");
        }

        if (!Number.isInteger(cfg.fold) || cfg.fold < 0) {
            throw new Error("Invalid fold length");
        }

        if (typeof cfg.version !== "string" ||
            typeof cfg.header !== "boolean" ||
            typeof cfg.separator !== "string" ||
            encoder.encode(cfg.separator).length !== 1) {
            throw new Error("Invalid header options");
        }

        // Generate cryptographically secure random bytes.
        function randomBytes(length) {
            const bytes = new Uint8Array(length);

            for (let offset = 0; offset < length; offset += 65536) {
            crypto.getRandomValues(
                bytes.subarray(offset, Math.min(length, offset + 65536))
            );
            }

            return bytes;
        }

        // Concatenate Uint8Array instances.
        function concatBytes(...arrays) {
            const length = arrays.reduce((sum, arr) => sum + arr.length, 0);
            const result = new Uint8Array(length);

            let offset = 0;
            for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
            }

            return result;
        }

        // Convert bytes to Base64.
        function bytesToBase64(bytes) {
            let binary = "";

            for (let i = 0; i < bytes.length; i += 32768) {
            binary += String.fromCharCode(
                ...bytes.subarray(i, i + 32768)
            );
            }

            return btoa(binary);
        }

        // 1. Generate PBKDF2 iteration count.
        // Equivalent to C# Random.Next(min, min + range).
        let randomOffset = 0;

        if (cfg.iterationsRandomRange > 0) {
            const range = cfg.iterationsRandomRange;
            const limit = Math.floor(0x100000000 / range) * range;
            const randomNumber = new Uint32Array(1);

            do {
            crypto.getRandomValues(randomNumber);
            } while (randomNumber[0] >= limit);

            randomOffset = randomNumber[0] % range;
        }

        const iterations = cfg.iterationsMin + randomOffset;

        // 2. Generate salt and IV.
        const salt = randomBytes(cfg.saltLength);

        const iv = cfg.iv == null
            ? randomBytes(cfg.ivLength)
            : cfg.iv instanceof Uint8Array
            ? new Uint8Array(cfg.iv)
            : cfg.iv instanceof ArrayBuffer
                ? new Uint8Array(cfg.iv)
                : null;

        if (iv == null || iv.length !== cfg.ivLength) {
            throw new Error("IV must contain exactly 16 bytes");
        }

        // 3. Derive encryption key using PBKDF2-HMAC-SHA256.
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            {
            name: "PBKDF2",
            salt,
            iterations,
            hash: "SHA-256"
            },
            keyMaterial,
            {
            name: "AES-CBC",
            length: cfg.keySize * 8
            },
            false,
            ["encrypt"]
        );

        // 4. Prepare plaintext.
        const plaintext = isString
            ? encoder.encode(input)
            : new Uint8Array(input);

        // The C# implementation encrypts the salt marker
        // before the actual plaintext.
        const marker = base64
            ? encoder.encode(bytesToBase64(salt))
            : salt;

        const dataToEncrypt = concatBytes(marker, plaintext);

        // 5. Encrypt using AES-CBC + PKCS7.
        // Web Crypto automatically applies PKCS7 padding.
        const ciphertext = new Uint8Array(
            await crypto.subtle.encrypt(
            {
                name: "AES-CBC",
                iv
            },
            key,
            dataToEncrypt
            )
        );

        // 6. Encode iterations as a 4-byte little-endian integer.
        const iterationsBytes = new Uint8Array(4);

        new DataView(iterationsBytes.buffer).setInt32(
            0,
            iterations,
            true
        );

        // 7. Construct encrypted payload:
        // [IV][Salt][Iterations][Ciphertext]
        const payload = concatBytes(
            iv,
            salt,
            iterationsBytes,
            ciphertext
        );

        // 8. Construct C#-compatible AES header.
        let header = "";

        if (cfg.header) {
            const properties = [];

            // C# UrlUtils.Serialize only writes non-default values.
            if (cfg.saltLength !== 16) {
            properties.push(["saltLength", cfg.saltLength]);
            }

            if (cfg.ivLength !== 16) {
            properties.push(["ivLength", cfg.ivLength]);
            }

            if (cfg.blockSize !== 16) {
            properties.push(["blockSize", cfg.blockSize]);
            }

            if (cfg.keySize !== 32) {
            properties.push(["keySize", cfg.keySize]);
            }

            if (!base64) {
            properties.push(["encoding", "Binary"]);
            }

            if (cfg.version !== "") {
            properties.push(["version", cfg.version]);
            }

            const query = properties
            .map(([name, value]) =>
                `${name}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`
            )
            .join("&");

            header = `aes:${query ? "?" + query : ""}${cfg.separator}`;
        }

        // 9. Encode output.
        if (base64) {
            let output = header + bytesToBase64(payload);

            // C# FoldedOutputStream wraps the entire output,
            // including the header.
            if (cfg.fold > 0) {
            let folded = "";

            for (let i = 0; i < output.length; i += cfg.fold) {
                folded += output.slice(i, i + cfg.fold);

                if (i + cfg.fold <= output.length) {
                folded += "\n";
                }
            }

            output = folded;
            }

            // Preserve C# behavior: strings return strings,
            // byte arrays return byte arrays.
            return isString ? output : encoder.encode(output);
        }

        // Binary encoding always returns bytes.
        return concatBytes(encoder.encode(header), payload);
    },



    /**
     * Decrypts data produced by DProjects.Crypto.CryptoSymmetricEncryptAES.
     *
     * @param {string | Uint8Array | ArrayBuffer} input
     * @param {string | Function} password
     * @param {object} options
     * @returns {Promise<string | Uint8Array>}
     */
    async decrypt(input, password, options = {}) {
        const textEncoder = new TextEncoder();
        const textDecoder = new TextDecoder();
        const isString = typeof input === "string";

        if (!isString && !(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) {
            throw new TypeError("input must be a string, Uint8Array, or ArrayBuffer");
        }

        let data = isString ? textEncoder.encode(input) : new Uint8Array(input);
        let cfg = {
            header: true,
            separator: ",",
            encoding: "Base64",
            saltLength: 16,
            ivLength: 16,
            blockSize: 16,
            keySize: 32,
            cipherMode: "CBC",
            paddingMode: "PKCS7",
            version: "",
            ...options,
        };

        // 1. Read and parse the C# AES header.
        if (cfg.header) {
            const separatorBytes = textEncoder.encode(cfg.separator);
            if (separatorBytes.length !== 1) {
            throw new Error("This implementation requires a single-byte header separator");
            }

            const end = data.indexOf(separatorBytes[0]);
            if (end < 0 || end >= 512) throw new Error("Invalid or missing AES header");

            const header = textDecoder.decode(data.subarray(0, end));
            if (!/^aes:(?:\?.*)?$/i.test(header)) throw new Error("Invalid AES header");

            const properties = {
            encoding: "encoding",
            saltlength: "saltLength",
            ivlength: "ivLength",
            blocksize: "blockSize",
            keysize: "keySize",
            ciphermode: "cipherMode",
            paddingmode: "paddingMode",
            version: "version",
            header: "header",
            separator: "separator",
            iterations: "iterations",
            };

            const numeric = new Set([
            "saltLength", "ivLength", "blockSize", "keySize", "iterations"
            ]);

            const query = header.includes("?")
            ? header.slice(header.indexOf("?") + 1)
            : "";

            for (const [key, value] of new URLSearchParams(query)) {
            const name = properties[key.toLowerCase()];
            if (!name) throw new Error(`Unknown AES header option: ${key}`);

            if (numeric.has(name)) {
                if (!/^-?\d+$/.test(value)) {
                throw new Error(`Invalid AES header option: ${key}`);
                }
                cfg[name] = Number(value);
            } else if (name === "header") {
                if (!/^(true|false)$/i.test(value)) {
                throw new Error("Invalid header option");
                }
                cfg.header = value.toLowerCase() === "true";
            } else {
                cfg[name] = value;
            }
            }

            data = data.subarray(end + 1);
        }

        // 2. Validate the supported algorithm options.
        const encoding = String(cfg.encoding).toLowerCase();
        const base64 = encoding === "base64" || encoding === "0";

        if (!base64 && encoding !== "binary" && encoding !== "1") {
            throw new Error("Unsupported AES encoding");
        }
        if (!["cbc", "1"].includes(String(cfg.cipherMode).toLowerCase())) {
            throw new Error("Only AES-CBC is supported");
        }
        if (!["pkcs7", "2"].includes(String(cfg.paddingMode).toLowerCase())) {
            throw new Error("Only PKCS7 padding is supported");
        }
        if (cfg.ivLength !== 16 || cfg.blockSize !== 16 ||
            ![16, 24, 32].includes(cfg.keySize)) {
            throw new Error("Invalid AES IV, block, or key size");
        }
        if (!Number.isInteger(cfg.saltLength) ||
            cfg.saltLength < 0 || cfg.saltLength > 1048576) {
            throw new Error("Invalid salt length");
        }

        // 3. Decode Base64 if required.
        if (base64) {
            const encoded = textDecoder.decode(data).replace(/[\r\n]/g, "");
            const raw = atob(encoded);
            data = Uint8Array.from(raw, c => c.charCodeAt(0));
        }

        // 4. Extract IV, salt, iterations, and ciphertext.
        const metadataLength = cfg.ivLength + cfg.saltLength + 4;
        if (data.length < metadataLength) {
            throw new Error("Incomplete AES metadata");
        }

        const iv = data.subarray(0, cfg.ivLength);
        const salt = data.subarray(
            cfg.ivLength,
            cfg.ivLength + cfg.saltLength
        );

        // .NET BitConverter.GetBytes(int) uses little-endian here.
        const iterations = new DataView(
            data.buffer,
            data.byteOffset + cfg.ivLength + cfg.saltLength,
            4
        ).getInt32(0, true);

        if (iterations <= 0 || iterations > 10_000_000) {
            throw new Error("Invalid PBKDF2 iterations");
        }

        const ciphertext = data.subarray(metadataLength);
        if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
            throw new Error("Invalid AES ciphertext length");
        }

        // 5. Derive the AES key using PBKDF2-HMAC-SHA256.
        const passphrase = typeof password === "function"
            ? password(cfg.version)
            : password;

        if (typeof passphrase !== "string") {
            throw new TypeError("Password must be a string");
        }

        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            textEncoder.encode(passphrase),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        const key = await crypto.subtle.deriveKey(
            {
            name: "PBKDF2",
            salt,
            iterations,
            hash: "SHA-256"
            },
            keyMaterial,
            {
            name: "AES-CBC",
            length: cfg.keySize * 8
            },
            false,
            ["decrypt"]
        );

        // 6. Decrypt using AES-CBC with PKCS7 padding.
        const decrypted = new Uint8Array(
            await crypto.subtle.decrypt(
            { name: "AES-CBC", iv },
            key,
            ciphertext
            )
        );

        // 7. Remove the encrypted salt marker written by C#.
        const markerLength = base64
            ? 4 * Math.ceil(cfg.saltLength / 3)
            : cfg.saltLength;

        if (decrypted.length < markerLength) {
            throw new Error("Incomplete decrypted salt marker");
        }

        const result = decrypted.slice(markerLength);

        // 8. Return the original plaintext.
        return isString ? textDecoder.decode(result) : result;
    }

}