import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import XVault from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/services/xvault.js";
import { encodeMetadata } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/meta.js";
import HandlerEnv from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/env.js";

const vault = new XVault({});
const handler = new HandlerEnv();
const fixture = version => readFileSync(new URL(`./fixtures/xvault/v${version}.env`, import.meta.url), "utf8");
const password = version => version === 1 ? "fixture-password" : "fixture-v2-password";

for (const version of [1, 2]) {
    test(`Python V${version} fixture, editing context, preservation and authentication`, async () => {
        const source = fixture(version);
        const result = await vault.decrypt(source, password(version));
        assert.deepEqual(Object.keys(result).sort(), ["context", "text"]);
        assert.ok(result.text.includes(version === 1 ? "enc:fixture-secret" : "enc:fixture-v2-secret"));
        assert.ok(!result.text.includes("_xvault"));
        assert.deepEqual(Object.keys(result.context).sort(), ["cryptoVersion", "format", "kind", "metadata", "originalText"]);
        assert.equal(result.context.originalText, source);
        assert.equal(result.context.cryptoVersion, version);
        assert.deepEqual(result.context.metadata, handler.parse(source).metadata);
        assert.ok(!JSON.stringify(result.context).includes(password(version)));
        assert.equal(await vault.encrypt(result.text, password(version), structuredClone(result.context)), source);
        const changed = await vault.encrypt(result.text + "NEW=enc:new-secret\n", password(version), result.context);
        assert.equal(handler.tokens(changed)[0].value, handler.tokens(source)[0].value);
        assert.equal(result.context.originalText, source);
        assert.equal(handler.parse(changed).metadata.salt, result.context.metadata.salt);
        assert.equal((await vault.decrypt(changed, password(version))).text, result.text + "NEW=enc:new-secret\n");
        await assert.rejects(vault.decrypt(source, "wrong-password"), /authentication|password/i);
        await assert.rejects(vault.encrypt(result.text, "wrong-password", result.context), /authentication|password/i);
        const token = handler.tokens(source)[0];
        const damaged = source.slice(0, token.start + 4) + (token.value[0] === "A" ? "B" : "A") + token.value.slice(1) + source.slice(token.end);
        await assert.rejects(vault.decrypt(damaged, password(version)), /authentication/i);
        await assert.rejects(vault.encrypt(result.text, password(version), { ...result.context, originalText: damaged }), /authentication/i);
        await assert.rejects(vault.encrypt(result.text.replace(/enc:/g, ""), password(version), result.context), /marker removal/i);
        const plaintext = handler.tokens(result.text)[0].value;
        await assert.rejects(vault.encrypt(result.text.replace(/enc:/g, ""), password(version), {
            ...result.context, originalText: source + "PUBLIC=" + plaintext + "\n"
        }), /marker removal/i);
    });
}

test("repeated values retain distinct ciphertext through insertion, deletion and reordering", async () => {
    const password = "editing-password";
    const source = await vault.encrypt("FIRST=enc:shared-secret\nSECOND=enc:shared-secret\n", password, { kind: "new", format: "env" });
    const opened = await vault.decrypt(source, password);
    const before = handler.tokens(source).map(token => token.value);
    assert.notEqual(before[0], before[1]);
    const changed = await vault.encrypt("FIRST=enc:shared-secret\nSECOND=enc:changed\n", password, opened.context);
    assert.equal(handler.tokens(changed)[0].value, before[0]);
    assert.notEqual(handler.tokens(changed)[1].value, before[1]);
    const reordered = await vault.encrypt("SECOND=enc:shared-secret\nTHIRD=enc:shared-secret\nFIRST=enc:shared-secret\n", password, opened.context);
    assert.deepEqual(handler.tokens(reordered).filter((_, i) => i !== 1).map(token => token.value), [before[1], before[0]]);
    assert.ok(!before.includes(handler.tokens(reordered)[1].value));
    const deleted = await vault.encrypt("SECOND=enc:shared-secret\n", password, opened.context);
    assert.deepEqual(handler.tokens(deleted).map(token => token.value), [before[1]]);
    assert.equal((await vault.decrypt(deleted, password)).text, "SECOND=enc:shared-secret\n");
    const refreshed = await vault.decrypt(changed, password);
    assert.equal(await vault.encrypt(refreshed.text, password, refreshed.context), changed);
});

test("invalid contexts and malformed initialized metadata never initialize replacement vaults", async () => {
    const source = fixture(2);
    const metadata = handler.parse(source).metadata;
    const context = { kind: "existing", format: "env", cryptoVersion: 2, metadata, originalText: source };
    for (const invalid of [undefined, {}, { kind: "existing" }, { ...context, originalText: "A=enc:plain" },
        { ...context, cryptoVersion: 1 }, { ...context, metadata: { ...metadata, salt: "11".repeat(16) } },
        { kind: "new", format: "env", metadata }, { kind: "new", format: "env", cryptoVersion: 3 },
        { kind: "new", format: "env", cryptoVersion: null }]) {
        await assert.rejects(vault.encrypt("A=enc:plain", "password", invalid));
    }
    await assert.rejects(vault.decrypt(source.replace(/_xvault=[^\n]+\n/, ""), "password", { format: "env" }), /without metadata/);
    await assert.rejects(vault.decrypt(source.replace(/_xvault=[^\n]+/, "_xvault=bad"), "password"), /metadata/);
    const corrupt = { ...metadata, encrypted_key: (metadata.encrypted_key[0] === "A" ? "B" : "A") + metadata.encrypted_key.slice(1) };
    await assert.rejects(vault.decrypt(source.replace(/xvault:[A-Za-z0-9_=-]+/, encodeMetadata(corrupt)), password(2)), /authentication/);
    assert.deepEqual(await vault.decrypt("A=enc:plain", "password", { format: "env" }), {
        text: "A=enc:plain", context: { kind: "new", format: "env", cryptoVersion: 2 }
    });
    await assert.rejects(vault.decrypt("ambiguous text", "password"), /format/);
});

test("ambiguous structural edits fail and contexts remain immutable on failure", async () => {
    const password = "editing-password";
    const source = await vault.encrypt("A=enc:shared\nA=enc:shared\n", password, { kind: "new", format: "env" });
    const result = await vault.decrypt(source, password);
    const snapshot = structuredClone(result.context);
    await assert.rejects(vault.encrypt(result.text + "B=enc:new\n", password, result.context), /Ambiguous/);
    assert.deepEqual(result.context, snapshot);
});

test("deleting a public duplicate cannot hide marker removal in a JSON field", async () => {
    const source = fixture(2);
    const metadata = handler.parse(source).metadata;
    const ciphertext = handler.tokens(source)[0].value;
    const json = JSON.stringify({ _xvault: encodeMetadata(metadata), secret: "enc:" + ciphertext, public: "fixture-v2-secret" });
    const opened = await vault.decrypt(json, password(2));
    await assert.rejects(vault.encrypt('{"secret":"fixture-v2-secret"}', password(2), opened.context), /marker removal/);
});
