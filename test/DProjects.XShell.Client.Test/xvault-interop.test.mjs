import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import XVault from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/services/xvault.js";

const repository = process.env.XVAULT_PYTHON_REPO;
const password = "interop-pässword-🔐";
const vault = new XVault({});
const samples = {
    env: '# retained\nFIRST=enc:shared-secret\nSECOND=${enc:雪 café # \' " = !}\n',
    json: '{"first":"enc:shared-secret","second":"${enc:雪 café # = !}","plain":"visible"}\n',
    jsonc: '{\n // retained\n first: "enc:shared-secret", second: "${enc:雪 café # = !}",\n}\n',
    yaml: 'first: enc:shared-secret\nsecond: "${enc:雪 café # = !}"\n# retained\n',
    markdown: '---\ntitle: Retained\nnested:\n  value: visible\n---\nFirst: ${enc:shared-secret}\nSecond: ${enc:雪 café # = !}\n',
    ovpn: 'client\n<auth-user-pass>\nenc:shared-secret\n${enc:雪 café # = !}\n</auth-user-pass>\n'
};

function python(records) {
    const result = spawnSync(process.env.XVAULT_PYTHON || "python", ["-B", fileURLToPath(new URL("./fixtures/xvault/python-oracle.py", import.meta.url))], {
        input: JSON.stringify(records), encoding: "utf8", maxBuffer: 2 ** 22,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONIOENCODING: "utf-8" }
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}

test("real Python XVault ↔ JavaScript interoperability", { skip: !repository && "Set XVAULT_PYTHON_REPO to the authoritative Python checkout." }, async t => {
    const records = [1, 2].flatMap(version => Object.entries(samples).map(([format, text]) => ({
        operation: "encrypt", format, text, version, password
    })));
    const generated = python(records);
    for (const [index, record] of records.entries()) {
        await t.test(`V${record.version} ${record.format}: Python source, edited JavaScript output, new JavaScript vault`, async () => {
            const source = record.version === 2 ? generated[index].replace(/\r?\n/g, "\r\n") : generated[index];
            const opened = await vault.decrypt(source, password, { format: record.format });
            assert.ok(!opened.text.includes("_xvault"));
            assert.ok(opened.text.includes("shared-secret"));
            assert.ok(opened.text.includes("雪 café"));
            if (record.text.includes("retained")) assert.ok(opened.text.includes("retained"));
            assert.equal(await vault.encrypt(opened.text, password, opened.context), source);
            const edited = await vault.encrypt(opened.text.replace("shared-secret", "changed-secret"), password, opened.context);
            const initialized = await vault.encrypt(record.text, password, { kind: "new", format: record.format, cryptoVersion: record.version });
            const [editedPython, newPython, originalPython] = python([edited, initialized, source].map(text => ({
                operation: "decrypt", format: record.format, text, password
            })));
            assert.deepEqual(editedPython.metadata, originalPython.metadata);
            assert.deepEqual(editedPython.values.sort(), originalPython.values.map(value => value === "shared-secret" ? "changed-secret" : value).sort());
            assert.deepEqual(newPython.values.sort(), originalPython.values.sort());
            assert.equal(newPython.metadata.crypto_version, record.version);
            assert.deepEqual(Object.keys(newPython.metadata).sort(), record.version === 1 ? ["check", "crypto_version", "salt"] :
                ["crypto_version", "encrypted_key", "salt"]);
        });
    }
});
