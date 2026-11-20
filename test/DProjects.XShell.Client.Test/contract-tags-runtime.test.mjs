import assert from "node:assert/strict";
import test from "node:test";

import ContractSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json" with { type: "json" };
import ServiceSchema from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/service.schema.json" with { type: "json" };
import CommandsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/commands.json" with { type: "json" };
import ContractsContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/contracts.json" with { type: "json" };
import ModulesContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/modules.json" with { type: "json" };
import ServicesContract from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/contracts/services.json" with { type: "json" };
import Contracts from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/contracts.js";
import Services from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services.js";
import ContractDetail from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell-diagnostics/pages/detail/contract-detail.js";
import JsonValidator from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js";

test("diagnostics registry contracts document valid tag projections", () => {
    const schema = structuredClone(ServiceSchema);
    schema.$defs = { [ContractSchema.$id]: structuredClone(ContractSchema) };
    const validator = new JsonValidator();

    for (const contract of [CommandsContract, ContractsContract, ModulesContract, ServicesContract]) {
        const result = validator.validate(contract, schema);
        assert.equal(result.valid, true, `${contract.label}: ${JSON.stringify(result.errors)}`);
    }
});

test("loaded standalone Service contracts retain and freeze authored tags", async () => {
    const contract = { label: "Storage", tags: ["files", "storage"], methods: {} };
    const schema = structuredClone(ServiceSchema);
    schema.$defs = { [ContractSchema.$id]: structuredClone(ContractSchema) };
    const contracts = new Contracts({
        config: {
            app: { baseUrl: "https://example.test/" },
            modules: {
                storage: {
                    assets: { path: "/_assets/storage" },
                    files: [{ path: "/_assets/storage/contracts/storage.json", size: 10 }]
                }
            }
        },
        loader: {
            async load(resource) {
                if (resource === "contract:storage") return contract;
                if (resource === "schema:service") return schema;
                throw new Error(`Unexpected load: ${resource}`);
            }
        }
    }, {});

    await contracts.init();

    const loaded = contracts.getContractById("storage");
    assert.strictEqual(loaded, contract);
    assert.deepEqual(loaded.tags, ["files", "storage"]);
    assert.equal(Object.isFrozen(loaded.tags), true);
    assert.throws(() => loaded.tags.push("other"), TypeError);

    const registry = contracts.registry;
    assert.deepEqual(registry[0].tags, ["files", "storage"]);
    assert.equal(Object.isFrozen(registry[0].tags), true);
    assert.notStrictEqual(registry[0].tags, loaded.tags);
    assert.throws(() => registry[0].tags.push("other"), TypeError);
});

test("service metadata projects frozen public contract tags without constructing the service", () => {
    let constructions = 0;
    class StorageService {
        static optionsSchema = { type: "object", additionalProperties: false };
        constructor() { constructions++; }
    }
    const contractItem = {
        id: "storage", url: "/contracts/storage.json", contract: { tags: ["files", "storage"] }
    };
    const services = new Services({ config: {}, loader: {}, contracts: {}, resolver: {}, bus: {} });
    services.register("storage", null, { contractItem, implementationItem: { class: StorageService, moduleId: "storage" } });
    services.register("runtime", {});

    const storage = services.getServiceInfo("storage");
    assert.deepEqual(storage.tags, ["files", "storage"]);
    assert.equal(Object.isFrozen(storage.tags), true);
    assert.notStrictEqual(storage.tags, contractItem.contract.tags);
    assert.throws(() => storage.tags.push("other"), TypeError);
    assert.deepEqual(services.getServiceInfo("runtime").tags, []);
    assert.equal(Object.isFrozen(services.getServiceInfo("runtime").tags), true);
    assert.equal(constructions, 0);
});

test("Contract Detail describes and displays contract tags without constructing the resource", async () => {
    let constructions = 0;
    const contract = { label: "Example", description: "Example contract", tags: ["examples", "testing"] };
    class Component {
        static contract = contract;
        constructor() { constructions++; }
    }
    const state = { ...structuredClone(ContractDetail.state), kind: "component", id: "x-example" };
    const page = { label: "", description: "" };
    const controller = ContractDetail.controller({
        state,
        page,
        loader: { async load() { return Component; } },
        resolver: { has() { return true; }, resolve() { return { definition: { moduleId: "examples" } }; } },
        services: {},
        contracts: {},
        config: { xshell: { assets: { basePath: "/_assets" } }, modules: {} }
    });

    await controller.load();

    assert.deepEqual(state.detail.tags, ["examples", "testing"]);
    assert.notStrictEqual(state.detail.tags, contract.tags);
    assert.equal(constructions, 0);
    assert.match(ContractDetail.template, /x-if="state\.detail && state\.detail\.tags\.length"/);
    assert.match(ContractDetail.template, /x-for="tag in state\.detail\.tags"/);
});
