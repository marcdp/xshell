
// App entry point
const meta = name => document.querySelector(`meta[name="${name}"]`)?.content;
const sources = [...document.querySelectorAll('meta[name="xshell:source"]')].map(element => element.content);

// Caches
const repositories = new Map();
const indexes = new Map();
const modules = new Map();
const tasks = new Map();

// Repository indexes
function getRepositoryUrl(source) {
    const suffix = "index.json";
    if (!source.endsWith(suffix)) throw new Error(`Invalid repository source: ${source}`);
    return new URL(source.slice(0, -suffix.length) + "index.json", document.baseURI).href;
}

async function fetchIndex(url) {
    if (!indexes.has(url)) indexes.set(url, (async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
        return response.json();
    })());
    return indexes.get(url);
}

async function loadRepositories() {
    const results = await Promise.allSettled(sources.map(async source => {
        const url = getRepositoryUrl(source);
        const index = await fetchIndex(url);
        if (!index || !index.modules || typeof index.modules !== "object" || Array.isArray(index.modules)) throw new Error(`Invalid repository index: ${url}`);
        return { url, index };
    }));
    results.forEach((result, i) => {
        if (result.status === "fulfilled") repositories.set(i, result.value);
        else console.warn(`Repository unavailable: ${sources[i]}`, result.reason);
    });
    if (!repositories.size) throw new Error("No XShell repositories available.");
}

// Version selection
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const parts = version => version.split(".").map(BigInt);

function compareVersions(a, b) {
    const x = parts(a), y = parts(b);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
    return 0;
}

function matches(version, requirement) {
    if (!stableVersion.test(version)) return false;
    if (requirement === "latest") return true;
    if (stableVersion.test(requirement)) return version === requirement;

    const operator = requirement[0], base = requirement.slice(1);
    if (!["^", "~"].includes(operator) || !stableVersion.test(base)) throw new Error(`Invalid version requirement: ${requirement}`);

    const v = parts(version), b = parts(base);
    if (compareVersions(version, base) < 0) return false;
    if (operator === "~") return v[0] === b[0] && v[1] === b[1];
    return b[0] > 0n ? v[0] === b[0] : b[1] > 0n ? v[0] === 0n && v[1] === b[1] : v[0] === 0n && v[1] === 0n && v[2] === b[2];
}

function selectVersion(index, requirement) {
    return Object.keys(index.versions ?? {}).filter(version => matches(version, requirement)).sort((a, b) => compareVersions(b, a))[0];
}

// Recursive module discovery
async function loadModule(reference) {
    const match = /^module:([a-z][a-z0-9]*(?:-[a-z0-9]+)*):(.+)$/.exec(reference ?? "");
    if (!match) throw new Error(`Invalid module reference: ${reference}`);
    const [, name, requirement] = match;

    for (const [sourceIndex, repository] of repositories) {
        const descriptor = repository.index.modules[name];
        if (!descriptor?.url) continue;

        const indexUrl = new URL(descriptor.url, repository.url).href;
        let index;
        try {
            index = await fetchIndex(indexUrl);
        } catch (error) {
            console.warn(`Module index unavailable: ${indexUrl}`, error);
            continue;
        }
        if (index.module !== name) continue;

        const version = selectVersion(index, requirement);
        if (!version) continue;

        const key = `${name}@${version}`;
        if (modules.has(key)) return modules.get(key);

        const entry = index.versions[version];
        if (!entry || typeof entry.url !== "string") throw new Error(`Missing manifest URL: ${key}`);

        const manifestUrl = new URL(entry.url, indexUrl);
        if (!["http:", "https:"].includes(manifestUrl.protocol) || !manifestUrl.pathname.endsWith("/manifest.json") || manifestUrl.search || manifestUrl.hash) throw new Error(`Invalid manifest URL: ${entry.url}`);

        const module = { name, version, sourceIndex, dependencies: entry.dependencies ?? {}, manifestUrl: manifestUrl.href, baseUrl: new URL(".", manifestUrl).href };
        modules.set(key, module);

        for (const dependency of Object.values(module.dependencies)) schedule(dependency);
        return module;
    }
    throw new Error(`Cannot resolve module: ${reference}`);
}
function schedule(reference) {
    if (tasks.has(reference)) return tasks.get(reference);
    const task = loadModule(reference);
    tasks.set(reference, task);
    return task;
}


// Load repositories and resolve modules
await loadRepositories();
const app = await schedule(meta("xshell:app.module"));
const completed = new Set();
while (completed.size < tasks.size) {
    const batch = [...tasks].filter(([reference]) => !completed.has(reference));
    await Promise.all(batch.map(([, task]) => task));
    batch.forEach(([reference]) => completed.add(reference));
}
console.log("Repositories:", repositories);
console.log("Module indexes:", indexes);
console.log("Resolved modules:", modules);
console.log("Application:", app);


// Validate module generations
function validateModules() {
    const selected = new Map();
    for (const module of modules.values()) {
        const previous = selected.get(module.name);
        if (previous && (previous.version !== module.version || previous.manifestUrl !== module.manifestUrl)) {
            throw new Error(`Conflicting module generations: ${module.name}`);
        }
        selected.set(module.name, module);
    }
}
validateModules();


// Download manifests and resolve physical asset URLs
async function prepareModules() {
    await Promise.all([...modules.values()].map(async module => {
        const response = await fetch(module.manifestUrl);
        if (!response.ok) throw new Error(`Cannot load manifest: ${module.manifestUrl}`);

        const manifest = await response.json();
        const definition = module.name === "xshell" ? manifest.xshell : manifest.modules?.[module.name];
        if (!definition || definition.version !== module.version) throw new Error(`Invalid manifest: ${module.manifestUrl}`);

        const value = definition.assets?.url ?? "url:./";
        if (typeof value !== "string" || !value.startsWith("url:")) throw new Error(`Invalid assets.url: ${module.name}`);

        const assetsUrl = new URL(value.slice(4).trim(), module.manifestUrl);
        if (!["http:", "https:"].includes(assetsUrl.protocol) || assetsUrl.search || assetsUrl.hash) throw new Error(`Invalid assets URL: ${value}`);

        module.manifest = manifest;
        module.assetsUrl = assetsUrl.href;
    }));
}
await prepareModules();


// Normalize manifest URLs before merging
const appBasePath = meta("xshell:app.basePath") ?? "";
const appBaseUrl = new URL(appBasePath.replace(/\/?$/, "/"), document.location.origin).href;
const assetsBasePath = "/_assets";

function normalizeUrl(value, module, declaringPath = "/manifest.json") {
    if (typeof value !== "string") return value;
    if (value.startsWith("app:")) return new URL(value.slice(4).replace(/^\/+/, ""), appBaseUrl).href;
    if (value.startsWith("url:")) return new URL(value.slice(4), module.manifestUrl).href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
    if (!value.startsWith("/") && !value.startsWith("./") && !value.startsWith("../")) return value;

    const root = new URL(`.${module.assetsPath}/`, appBaseUrl);
    const url = value.startsWith("/") ? new URL(value.slice(1), root) : new URL(value, new URL(declaringPath.replace(/^\/+/, ""), root));
    if (!url.href.startsWith(root.href)) throw new Error(`Module URL escapes asset root: ${value}`);
    return url.href;
}

function normalizeManifest(value, module, declaringPath = "/manifest.json") {
    if (Array.isArray(value)) return value.map(item => normalizeManifest(item, module, declaringPath));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeManifest(item, module, declaringPath)]));
    return normalizeUrl(value, module, declaringPath);
}

for (const module of modules.values()) {
    module.assetsPath = `${assetsBasePath}/${module.name}/${module.version}.dev`;
    module.manifest = normalizeManifest(module.manifest, module);
    const definition = module.name === "xshell" ? module.manifest.xshell : module.manifest.modules[module.name];
    definition.assets ??= {};
    definition.assets.url = module.assetsUrl;
}


// Merge resolved manifests into one effective configuration
function mergeManifests() {
    const config = { modules: {} };
    const framework = [...modules.values()].find(module => module.name === "xshell");
    if (!framework) throw new Error("XShell framework module not resolved.");

    config.xshell = structuredClone(framework.manifest.xshell);
    config.xshell.assets ??= {};
    config.xshell.assets.url = framework.assetsUrl;

    for (const module of modules.values()) {
        if (module.name === "xshell") continue;
        const definition = module.manifest.modules?.[module.name];
        if (!definition) throw new Error(`Missing module definition: ${module.name}`);

        config.modules[module.name] = structuredClone(definition);
        config.modules[module.name].assets ??= {};
        config.modules[module.name].assets.url = module.assetsUrl;
        config.modules[module.name].configUrl = module.manifestUrl;
    }

    return config;
}

validateModules();
const config = mergeManifests();
console.log("Effective XShell configuration:", config);



// Locate XShell framework bootstrap               
//for(const key of modules.keys()) {
//    const module = modules.get(key);
//    if (module.name == "xshell") {                        
//        const manifest = module.manifest;
//        const manifestUrl = module.manifestUrl;
//        debugger;
//    }
//}
