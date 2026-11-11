import assert from "node:assert/strict";
import test from "node:test";
import contract from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/contracts/xvault.json" with { type: "json" };
import schema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import commonSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import XVault from "../../src/DProjects.XShell/Resources/DProjects.XShell/x-vault/services/xvault.js";

test("XVault contract uses supported object descriptors and service construction", () => {
    const result = new JsonValidator().validate(contract, schema, { "./contract.schema.json": commonSchema });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.deepEqual(Object.getOwnPropertyNames(XVault.prototype).sort(), ["constructor", "decrypt", "encrypt"]);
    const services = new Services({});
    services.register("xvault", null, { contractItem: { contract }, implementationItem: { class: XVault } });
    assert.ok(services.resolve("xvault") instanceof XVault);
    assert.equal(services.resolve("xvault"), services.resolve("xvault"));
    const validator = new JsonValidator();
    assert.equal(validator.validate({ kind: "new", format: "env" }, contract.types.encryptionContext.schema).valid, true);
    assert.equal(validator.validate({ kind: "existing", format: "env" }, contract.types.encryptionContext.schema).valid, false);
});

test("two-argument format detection recognizes ENV and JSONC with leading comments", async () => {
    const vault = new XVault({});
    assert.equal((await vault.decrypt("A=enc:plain\n", "password")).context.format, "env");
    assert.equal((await vault.decrypt('// retained\n{a:"enc:plain"}', "password")).context.format, "jsonc");
    await assert.rejects(vault.decrypt("A: enc:plain", "password"), /Ambiguous/);
});
