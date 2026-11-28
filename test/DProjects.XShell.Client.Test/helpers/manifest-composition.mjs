import { readFileSync } from "node:fs";
import vm from "node:vm";

const bootstrap = readFileSync(new URL("../../../src/DProjects.XShell/Resources/DProjects.XShell/bootstrap/index.js", import.meta.url), "utf8");
const merge = bootstrap.match(/^        function mergeManifests\(\) \{[\s\S]*?^        \}/m)[0];
const normalize = bootstrap.match(/^        function normalizeUrl\([\s\S]*?^        \}\r?\n        function normalizeManifest\([\s\S]*?^        \}/m)[0];
const resolverRules = bootstrap.slice(
    bootstrap.indexOf("function fillXShellResolverRules(config)"),
    bootstrap.indexOf("config = fillXShell(config);")
).trim();

export const fillResolverRules = vm.runInNewContext("(" + resolverRules + ")");

export function mergeManifests(modules, app) {
    return vm.runInNewContext(merge + "\nmergeManifests()", {
        app, resolvedModules: new Map(modules.map(module => [module.name, module])), structuredClone
    });
}

export function normalizeManifest(manifest, module, appBaseUrl = "https://example.test/") {
    return vm.runInNewContext(normalize + "\nnormalizeManifest(manifest, module)", { URL, manifest, module, appBaseUrl });
}
