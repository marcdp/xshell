import assert from "node:assert/strict";
import test from "node:test";
import { encodeBase64, encodeMetadata, decodeMetadata } from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/meta.js";
import HandlerEnv from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/env.js";
import HandlerJson from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/json.js";
import HandlerJsonc from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/jsonc.js";
import HandlerYaml from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/yaml.js";
import HandlerMarkdown from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/markdown.js";
import HandlerOvpn from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/js/handlers/ovpn.js";

const metadata = { crypto_version: 2, salt: "00".repeat(16), encrypted_key: encodeBase64(new Uint8Array(60)) };
const encoded = encodeMetadata(metadata);
const cases = [
    [HandlerEnv, `# retained\r\n_xvault=${encoded}\r\nA=enc:first\r\nB=visible\r\n`],
    [HandlerOvpn, `client\n# _xvault=${encoded}\nremote host\n<key>\nenc:first\n</key>\n`],
    [HandlerJson, `{"_xvault":"${encoded}","A":"enc:first","nested":{"_xvault":"unrelated"}}`],
    [HandlerJson, `{"A":"enc:first", "_xvault":"${encoded}"}`],
    [HandlerJson, `{"_xvault":"${encoded}"}`],
    [HandlerJsonc, `{\n // before\n _xvault: '${encoded}',\n // after\n A: "enc:first",\n}`],
    [HandlerYaml, `# retained\n_xvault: '${encoded}'\nA: enc:first\nnested:\n  _xvault: unrelated\n`],
    [HandlerYaml, `A: enc:first\n_xvault: >-\n  ${encoded}\nB: visible\n`],
    [HandlerYaml, `{_xvault: '${encoded}', A: "enc:first"}`],
    [HandlerMarkdown, `---\r\ntitle: Retained\r\n_xvault: ${encoded}\r\n---\r\nBody \${enc:first}\r\n_xvault is body text\r\n`]
];

for (const [index, [Type, source]] of cases.entries()) {
    test(`handler metadata removal/restoration ${index} ${Type.name}`, () => {
        const handler = new Type();
        const parsed = handler.parse(source);
        assert.deepEqual(parsed.metadata, metadata);
        assert.ok(!parsed.text.includes(encoded));
        const restored = handler.restore(parsed.text.replace("enc:first", "enc:changed"), parsed);
        assert.deepEqual(handler.parse(restored).metadata, metadata);
        assert.ok(restored.includes(encoded));
        assert.ok(restored.includes("changed") || !source.includes("first"));
        if (source.includes("unrelated")) assert.ok(parsed.text.includes("unrelated"));
        if (source.includes("// before")) assert.ok(parsed.text.includes("// before"));
        if (source.includes("// after")) assert.ok(parsed.text.includes("// after"));
        if (source.includes("\r\n")) assert.ok(!restored.replaceAll("\r\n", "").includes("\n"));
    });
}

test("handlers reject duplicate and malformed metadata in their own syntax", () => {
    for (const [Type, text] of [
        [HandlerEnv, "_xvault=bad\n_xvault=bad\n"],
        [HandlerOvpn, "# _xvault=bad\n# _xvault=bad\n"],
        [HandlerJson, '{"_xvault":"bad","_xvault":"bad"}'],
        [HandlerJsonc, "{_xvault:'bad', '_xvault':'bad'}"],
        [HandlerYaml, "_xvault: bad\n_xvault: bad\n"],
        [HandlerMarkdown, "---\n_xvault: bad\n_xvault: bad\n---\n"]
    ]) assert.throws(() => new Type().parse(text), /Duplicate/);
    for (const [Type, source] of cases) assert.throws(() => new Type().parse(source.replace(encoded, "broken")), /metadata/);
});

test("Python marker delimiters and source ordering", () => {
    assert.deepEqual(new HandlerEnv().tokens('A=enc:hello #comment\nB="enc:world"\nC=${enc:quoted#\'value}\n').map(t => t.value),
        ["hello ", "world", "quoted#'value"]);
    assert.deepEqual(new HandlerOvpn().tokens('remote enc:ignored\nenc:first\nremote ${enc:second}\n').map(t => t.value), ["first", "second"]);
    for (const Type of [HandlerJson, HandlerJsonc, HandlerYaml, HandlerMarkdown]) {
        assert.deepEqual(new Type().tokens('enc:first # tail\n${enc:second} "enc:third"').map(t => t.value), ["first # tail", "second", "third"]);
    }
});

test("metadata validates versions, salt, fields, base64 and wrapped length", () => {
    for (const value of [null, {}, { ...metadata, crypto_version: 3 }, { ...metadata, crypto_version: null }, { ...metadata, salt: "bad" },
        { ...metadata, encrypted_key: "%%%" }, { ...metadata, encrypted_key: "AAAA" }, { ...metadata, check: "unwanted" }]) {
        const encodedValue = "xvault:" + encodeBase64(new TextEncoder().encode(JSON.stringify(value)));
        assert.throws(() => decodeMetadata(encodedValue));
    }
    const duplicate = '{"crypto_version":2,"crypto_version":2,"salt":"' + metadata.salt + '","encrypted_key":"' + metadata.encrypted_key + '"}';
    assert.throws(() => decodeMetadata("xvault:" + encodeBase64(new TextEncoder().encode(duplicate))));
});

test("new Markdown metadata follows the body's CRLF line endings", () => {
    const handler = new HandlerMarkdown();
    const text = "# Notes\r\nSecret: ${enc:value}\r\n";
    const restored = handler.restore(text, { metadata, slot: null });
    assert.ok(!restored.replaceAll("\r\n", "").includes("\n"));
    assert.deepEqual(handler.parse(restored).metadata, metadata);
});
