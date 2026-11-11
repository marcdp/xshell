
// App entry point
const meta = name => document.querySelector(`meta[name="${name}"]`)?.content;
const repositoryUrls = [...document.querySelectorAll('meta[name="xshell:app.source"]')].map(element => element.content);


// ui
function showSpinner() {
    document.addEventListener("DOMContentLoaded", () => {
        const stylesheet = new CSSStyleSheet();
        stylesheet.replaceSync(`
            body {padding:0; margin:0;}
            .spinner {
                display:block;width:100%;
                background:#cccccc;height:.4em;border-radius:.25em;position:absolute;top:50%;left:50%;
                transform:translate(-50%, -50%);width:12em;visibility:hidden;
                animation:spinnerShowDiv 0s forwards;animation-delay:200ms;
            }
            .spinner div {
                display:block;animation:spinnerProgressBar 2s ease-in-out;animation-delay:200ms;
                animation-fill-mode:both;animation-iteration-count:infinite;
                background:#006CE0;height:.4em;border-radius:.25em;position:absolute;
            }
            @keyframes spinnerProgressBar { 0% {left:0;width:0;} 50% {left:0;width:100%;} 100% {left:100%;width:0;} }
            @keyframes spinnerShowDiv { to {visibility:visible;} }
        `);

        document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

        const div = document.createElement("DIV");
        div.innerHTML = "<div></div>";
        div.className = "spinner";
        document.body.appendChild(div);
    });
}
function hideSpinner() {
    document.querySelector(".spinner")?.remove();
}
function showBootstrapError(error) {
    const render = () => {
        hideSpinner();
        console.error("XShell bootstrap failed:", error);
        const container = document.createElement("main");
        const title = document.createElement("h1");
        const message = document.createElement("pre");
        title.textContent = "Application failed to start";
        message.textContent = error?.message || String(error);
        container.append(title, message);
        document.body.replaceChildren(container);
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render, { once: true });
    } else {
        render();
    }
}


// main
async function main() {

    // Performance tracking start
    const started = performance.now();
    let previous = started;
    const timings = [];
    const checkpoint = phase => {
        const now = performance.now();
        timings.push({ phase, durationMs: +(now - previous).toFixed(2), totalMs: +(now - started).toFixed(2) });
        previous = now;
    };

    // action
    try {

        // checkpoint
        console.log("bootstrap: init ...");


        // Show spinner
        showSpinner();
        checkpoint("spinner shown");


        // Caches
        const repositoryIndexes = new Map();
        const indexRequests = new Map();
        const resolvedModules = new Map();
        const moduleRequests = new Map();


        // Repository indexes
        function normalizeRepositoryUrl(source) {
            const suffix = "index.json";
            if (!source.endsWith(suffix)) throw new Error(`Invalid repository source: ${source}`);
            return new URL(source.slice(0, -suffix.length) + "index.json", document.baseURI).href;
        }
        async function fetchIndex(url) {
            if (!indexRequests.has(url)) indexRequests.set(url, (async () => {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
                return response.json();
            })());
            return indexRequests.get(url);
        }
        async function loadRepositories() {
            const results = await Promise.allSettled(repositoryUrls.map(async source => {
                const url = normalizeRepositoryUrl(source);
                const index = await fetchIndex(url);
                if (!index || !index.modules || typeof index.modules !== "object" || Array.isArray(index.modules)) throw new Error(`Invalid repository index: ${url}`);
                return { url, index };
            }));
            results.forEach((result, i) => {
                if (result.status === "fulfilled") repositoryIndexes.set(i, result.value);
                else console.warn(`Repository unavailable: ${repositoryUrls[i]}`, result.reason);
            });
            if (!repositoryIndexes.size) throw new Error("No XShell repositories available.");
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
        async function resolveModule(reference) {
            const match = /^module:([a-z][a-z0-9]*(?:-[a-z0-9]+)*):(.+)$/.exec(reference ?? "");
            if (!match) throw new Error(`Invalid module reference: ${reference}`);
            const [, name, requirement] = match;
            for (const [sourceIndex, repository] of repositoryIndexes) {
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
                if (resolvedModules.has(key)) return resolvedModules.get(key);

                const entry = index.versions[version];
                if (!entry || typeof entry.url !== "string") throw new Error(`Missing manifest URL: ${key}`);

                const manifestUrl = new URL(entry.url, indexUrl);
                if (!["http:", "https:"].includes(manifestUrl.protocol) || !manifestUrl.pathname.endsWith("/manifest.json") || manifestUrl.search || manifestUrl.hash) throw new Error(`Invalid manifest URL: ${entry.url}`);

                const module = { name, hash: entry.hash, version, sourceIndex, dependencies: entry.dependencies ?? {}, manifestUrl: manifestUrl.href, baseUrl: new URL(".", manifestUrl).href };
                resolvedModules.set(key, module);

                for (const dependency of Object.values(module.dependencies)) schedule(dependency);
                return module;
            }
            throw new Error(`Cannot resolve module: ${reference}`);
        }
        function schedule(reference) {
            if (moduleRequests.has(reference)) return moduleRequests.get(reference);
            const task = resolveModule(reference);
            moduleRequests.set(reference, task);
            return task;
        }


        // Load repositories and resolve modules
        console.log("bootstrap: loading repositories indexes ...");
        await loadRepositories();
        checkpoint("repositories loaded");
        const app = await schedule(meta("xshell:app.module"));
        const completed = new Set();
        while (completed.size < moduleRequests.size) {
            const batch = [...moduleRequests].filter(([reference]) => !completed.has(reference));
            await Promise.all(batch.map(([, task]) => task));
            batch.forEach(([reference]) => completed.add(reference));
        }
        checkpoint("modules versions loaded");


        // Validate module generations
        function validateModules() {
            const selected = new Map();
            for (const module of resolvedModules.values()) {
                const previous = selected.get(module.name);
                if (previous && (previous.version !== module.version || previous.manifestUrl !== module.manifestUrl)) {
                    throw new Error(`Conflicting module generations: ${module.name}`);
                }
                selected.set(module.name, module);
            }
        }
        validateModules();
        checkpoint("modules validated");


        // Download manifests and resolve physical asset URLs
        async function loadModuleManifests() {
            await Promise.all([...resolvedModules.values()].map(async module => {
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
        console.log("bootstrap: loading module manifests ...");
        await loadModuleManifests();
        checkpoint("modules manifests downloaded");

        // Normalize manifest URLs before merging
        const appBasePath = (meta("xshell:app.basePath") ?? "").replace(/\/+$/, "");
        const appBaseUrl = new URL(`${appBasePath}/`, document.location.origin).href;
        const assetsBasePath = "/_assets";
        const xshellTempUrl = meta("xshell:xshell.temp.url");
        const environment = meta("xshell:app.environment");
        function normalizeUrl(value, module, declaringPath = "/manifest.json") {
            if (typeof value !== "string") return value;
            const restoreBraces = url => url.replace(/%7B/gi, "{").replace(/%7D/gi, "}");
            if (value.startsWith("app:")) {
                const root = new URL(appBaseUrl);
                const url = new URL(value.slice(4).trim().replace(/^\/+/, ""), root);
                if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error(`Application URL escapes app root: ${value}`);
                return restoreBraces(url.href);
            }
            if (value.startsWith("url:")) return restoreBraces(new URL(value.slice(4).trim(), module.manifestUrl).href);
            if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
            if (!value.startsWith("/") && !value.startsWith("./") && !value.startsWith("../")) return value;
            const root = new URL(`.${module.assetsPath}/`, appBaseUrl);
            const url = value.startsWith("/") ? new URL(value.slice(1), root) : new URL(value, new URL(declaringPath.replace(/^\/+/, ""), root));
            if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error(`Module URL escapes asset root: ${value}`);
            return restoreBraces(url.pathname.slice(new URL(appBaseUrl).pathname.length - 1) + url.search + url.hash);
        }
        function normalizeManifest(value, module, declaringPath = "/manifest.json") {
            if (Array.isArray(value)) return value.map(item => normalizeManifest(item, module, declaringPath));
            if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeManifest(item, module, declaringPath)]));
            return normalizeUrl(value, module, declaringPath);
        }
        for (const module of resolvedModules.values()) {
            const definition = module.name === "xshell" ? module.manifest.xshell : module.manifest.modules[module.name];
            if (Object.hasOwn(definition.assets ?? {}, "path")) throw new Error(`Module '${module.name}' must not define generated assets.path.`);
            const generation = environment?.toLowerCase() === "development" ? `${module.version}.dev` : `${module.version}.${module.hash}`;
            if (environment?.toLowerCase() !== "development" && !module.hash) throw new Error(`Missing package hash: ${module.name}@${module.version}`);
            module.assetsPath = `${assetsBasePath}/${module.name}/${generation}`;
            module.manifest = normalizeManifest(module.manifest, module);
            const normalizedDefinition = module.name === "xshell" ? module.manifest.xshell : module.manifest.modules[module.name];
            normalizedDefinition.assets ??= {};
            normalizedDefinition.assets.url = module.assetsUrl;
            normalizedDefinition.assets.path = module.assetsPath;
        }
        validateModules();
        checkpoint("modules normalized");


        // Merge resolved manifests into one effective configuration
        function mergeManifests() {
            const selected = new Map([...resolvedModules.values()].map(module => [module.name, module]));
            const framework = selected.get("xshell");
            if (!framework) throw new Error("XShell framework module not resolved.");
            const order = [framework], visited = new Set(["xshell"]), visiting = [];
            const visit = module => {
                if (visited.has(module.name)) return;
                if (visiting.includes(module.name)) throw new Error(`Circular module dependency: ${[...visiting, module.name].join(" -> ")}`);
                visiting.push(module.name);
                for (const name of Object.keys(module.dependencies ?? {})) {
                    const dependency = selected.get(name);
                    if (!dependency) throw new Error(`Unresolved dependency '${name}' of module '${module.name}'.`);
                    visit(dependency);
                }
                visiting.pop();
                visited.add(module.name);
                order.push(module);
            };
            visit(app);
            const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
            const merge = (target, source) => {
                for (const [key, value] of Object.entries(source)) {
                    if (Array.isArray(value)) target[key] = Array.isArray(target[key]) ? [...target[key], ...value] : [...value];
                    else if (isObject(value)) target[key] = merge(isObject(target[key]) ? target[key] : {}, value);
                    else target[key] = value;
                }
                return target;
            };
            const config = order.reduce((result, module) => merge(result, module.manifest), {});

            const frameworkEntry = framework.manifest.xshell?.resolver?.esm?.xshell;
            if (typeof frameworkEntry?.src !== "string" || !frameworkEntry.src) throw new Error("Selected XShell framework does not define resolver.esm.xshell.src");
            config.xshell.resolver.esm.xshell = structuredClone(frameworkEntry);

            config.xshell.assets ??= {};
            config.xshell.assets.url = framework.assetsUrl;
            config.xshell.assets.path = framework.assetsPath;
            config.xshell.configUrl = framework.manifestUrl;
            for (const module of order) {
                if (module.name === "xshell") continue;
                const definition = config.modules?.[module.name];
                if (!definition) throw new Error(`Missing module definition: ${module.name}`);
                definition.assets ??= {};
                definition.assets.url = module.assetsUrl;
                definition.assets.path = module.assetsPath;
                definition.configUrl = module.manifestUrl;
            }
            return config;
        }
        console.log("bootstrap: merging module manifests ...");
        let config = mergeManifests();
        const effectiveRoot = config.modules[app.name];
        if (!effectiveRoot) throw new Error(`Root module '${app.name}' not found.`);
        effectiveRoot.params = Object.fromEntries(new URLSearchParams(meta("xshell:app.params") ?? ""));
        config.app = {
            id: app.name,
            label: effectiveRoot.label ?? "",
            version: effectiveRoot.version,
            copyright: effectiveRoot.copyright ?? "",
            icon: effectiveRoot.icon ?? "",
            basePath: appBasePath,
            baseUrl: appBaseUrl,
            params: effectiveRoot.params,
            sources: repositoryUrls.map(normalizeRepositoryUrl),
            environment: environment
        };
        checkpoint("app config filled");


        // Fill config
        function fillXShell(config) {
            config.xshell.temp.url ??= new URL(xshellTempUrl, document.baseURI).href;
            config.xshell.assets.basePath = assetsBasePath;
            return config;
        }
        function fillXShellResolverRules(config) {
            const resolver = config.xshell.resolver;
            const contractDeclarations = new Map();
            resolver.contract ??= {};
            const addContractDeclarations = (ownerType, ownerId, assetsPath, files) => {
                const contractsPath = assetsPath + "/contracts";
                for (const file of files ?? []) {
                    if (!file.path.startsWith(contractsPath + "/") || !file.path.endsWith(".json")) continue;
                    const id = file.path.substring(contractsPath.length + 1).replace(/\.json$/, "");
                    const first = contractDeclarations.get(id);
                    if (first) throw new Error(`Duplicate contract '${id}' declared by ${first.ownerType} '${first.ownerId}' in '${first.path}' ` + `and ${ownerType} '${ownerId}' in '${file.path}'.`);
                    if (Object.hasOwn(resolver.contract, id)) throw new Error(`Duplicate contract '${id}' conflicts with an existing resolver entry while processing ` + `${ownerType} '${ownerId}' file '${file.path}'.`);
                    contractDeclarations.set(id, { ownerType, ownerId, path: file.path });
                    resolver.contract[id] = {
                        src: `${contractsPath}/${id}.json`,
                        loader: "object-json",
                        cache: true,
                        moduleId: ownerId,
                        modulePath: assetsPath
                    };
                }
            };
            resolver.schema ??= {};
            const schemaDeclarations = new Map();
            const addSchemaDeclarations = (ownerType, ownerId, assetsPath, files) => {
                const schemasPath = assetsPath + "/schemas";
                for (const file of files ?? []) {
                    if (!file.path.startsWith(schemasPath + "/") || !file.path.endsWith(".schema.json")) continue;
                    const id = file.path.substring(schemasPath.length + 1).replace(/\.schema\.json$/, "");
                    const first = schemaDeclarations.get(id);
                    if (first) throw new Error(`Duplicate schema '${id}' declared by ${first.ownerType} '${first.ownerId}' in '${first.path}' ` + `and ${ownerType} '${ownerId}' in '${file.path}'.`);
                    if (Object.hasOwn(resolver.schema, id)) throw new Error(`Duplicate schema '${id}' conflicts with an existing resolver entry while processing ` + `${ownerType} '${ownerId}' file '${file.path}'.`);
                    schemaDeclarations.set(id, { ownerType, ownerId, path: file.path });
                    resolver.schema[id] = {
                        src: `${schemasPath}/${id}.schema.json`,
                        loader: "schema-json",
                        cache: true,
                        moduleId: ownerId,
                        modulePath: assetsPath
                    };
                }
            };
            resolver.command ??= {};
            const commandDeclarations = new Map();
            const addCommandDeclarations = (ownerType, ownerId, assetsPath, files) => {
                const commandsPath = assetsPath + "/commands";
                for (const file of files ?? []) {
                    if (!file.path.startsWith(commandsPath + "/") || !file.path.endsWith(".js")) continue;
                    const id = file.path.substring(commandsPath.length + 1).replace(/\.js$/, "");
                    const first = commandDeclarations.get(id);
                    if (first) throw new Error(`Duplicate command '${id}' declared by ${first.ownerType} '${first.ownerId}' in '${first.path}' ` + `and ${ownerType} '${ownerId}' in '${file.path}'.`);
                    if (Object.hasOwn(resolver.command, id)) throw new Error(`Duplicate command '${id}' conflicts with an existing resolver entry while processing ` + `${ownerType} '${ownerId}' file '${file.path}'.`);
                    commandDeclarations.set(id, { ownerType, ownerId, path: file.path });
                    resolver.command[id] = {
                        src: `${commandsPath}/${id}.js`,
                        loader: "command-js",
                        cache: true,
                        moduleId: ownerId,
                        modulePath: assetsPath
                    };
                }
            };

            if (config.xshell.assets?.path) {
                const frameworkAssetsPath = config.xshell.assets.path;
                resolver.esm ??= {};
                resolver.esm[`${frameworkAssetsPath}/{path}.js`] ??= {
                    src: `${frameworkAssetsPath}/{path}.js`,
                    loader: "esm-js",
                    cache: true,
                    moduleId: "xshell",
                    modulePath: frameworkAssetsPath
                };
                addContractDeclarations("XShell", "xshell", frameworkAssetsPath, config.xshell.files);
                addSchemaDeclarations("XShell", "xshell", frameworkAssetsPath, config.xshell.files);
                addCommandDeclarations("XShell", "xshell", frameworkAssetsPath, config.xshell.files);
            }

            for (const [moduleId, module] of Object.entries(config.modules)) {
                const moduleAssetsPath = module.assets.path;
                // icon
                resolver.icon ??= {};
                resolver.icon[moduleId] ??= {
                    src: `${moduleAssetsPath}/icons/${moduleId}.svg`,
                    loader: "icon-svg",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.icon[`${moduleId}-{name}`] ??= {
                    src: `${moduleAssetsPath}/icons/${moduleId}-{name}.svg`,
                    loader: "icon-svg",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.icon[`${moduleId}:${moduleId}-{name}`] ??= {
                    src: `${moduleAssetsPath}/icons/${moduleId}-{name}.svg`,
                    loader: "icon-svg",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // layout
                resolver.layout ??= {};
                resolver.layout[`${moduleId}-layout-{name}`] ??= {
                    src: `${moduleAssetsPath}/layouts/${moduleId}-layout-{name}.js`,
                    loader: "component-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.layout[`${moduleId}:${moduleId}-layout-{name}`] ??= {
                    src: `${moduleAssetsPath}/layouts/${moduleId}-layout-{name}.js`,
                    loader: "component-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // component
                resolver.component ??= {};
                resolver.component[`${moduleId}-{name}`] ??= {
                    src: `${moduleAssetsPath}/components/${moduleId}-{name}.js`,
                    loader: "component-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };        
                resolver.component[`${moduleId}`] ??= {
                    src: `${moduleAssetsPath}/components/${moduleId}.js`,
                    loader: "component-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };        
                resolver.component[`${moduleId}:${moduleId}-{name}`] ??= {
                    src: `${moduleAssetsPath}/components/${moduleId}-{name}.js`,
                    loader: "component-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };        

                // page
                resolver.page ??= {};
                resolver.page[`${moduleAssetsPath}/{path}.js`] ??= {
                    src: `${moduleAssetsPath}/{path}.js`,
                    loader: "page-js",
                    cache: true,
                    cacheMode: "path",
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.page[`${moduleId}:/{path}.js`] ??= {
                    src: `${moduleAssetsPath}/{path}.js`,
                    loader: "page-js",
                    cache: true,
                    cacheMode: "path",
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.page[`${moduleAssetsPath}/{path}.html`] ??= {
                    src: `${moduleAssetsPath}/{path}.js`,
                    loader: "page-js",
                    cache: true,
                    cacheMode: "path",
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.page[`${moduleId}:/{path}.html`] ??= {
                    src: `${moduleAssetsPath}/{path}.js`,
                    loader: "page-js",
                    cache: true,
                    cacheMode: "path",
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.page[`${moduleAssetsPath}/{path}.md`] ??= {
                    src: `${moduleAssetsPath}/{path}.md`,
                    loader: "page-md",
                    cache: true,
                    cacheMode: "path",
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.page[`${moduleId}:/{path}.md`] ??= {
                    src: `${moduleAssetsPath}/{path}.md`,
                    loader: "page-md",
                    cache: true,
                    cacheMode: "path",
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // ES module
                resolver.esm ??= {};
                resolver.esm[`${moduleId}-{name}`] ??= {
                    src: `${moduleAssetsPath}/${moduleId}-{name}.js`,
                    loader: "esm-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.esm[`${moduleId}:${moduleId}-{name}`] ??= {
                    src: `${moduleAssetsPath}/${moduleId}-{name}.js`,
                    loader: "esm-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.esm[`${moduleAssetsPath}/{path}.js`] ??= {
                    src: `${moduleAssetsPath}/{path}.js`,
                    loader: "esm-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.esm[`${moduleId}:/{path}.js`] ??= {
                    src: `${moduleAssetsPath}/{path}.js`,
                    loader: "esm-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // style
                resolver.style ??= {};
                resolver.style[`${moduleAssetsPath}/{path}.css`] ??= {
                    src: `${moduleAssetsPath}/{path}.css`,
                    loader: "style-css",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.style[`${moduleId}:/{path}.css`] ??= {
                    src: `${moduleAssetsPath}/{path}.css`,
                    loader: "style-css",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // string
                resolver.string ??= {};
                resolver.string[`${moduleAssetsPath}/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "string-any",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.string[`${moduleId}:/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "string-any",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // object
                resolver.object ??= {};
                resolver.object[`${moduleAssetsPath}/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "object-json",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.object[`${moduleId}:/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "object-json",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // bytes
                resolver.bytes ??= {};
                resolver.bytes[`${moduleAssetsPath}/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "bytes-any",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.bytes[`${moduleId}:/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "bytes-any",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // datasets
                resolver.dataset ??= {};
                resolver.dataset[`${moduleAssetsPath}/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "dataset-url",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.dataset[`${moduleId}:{name}`] ??= {
                    src: `${moduleAssetsPath}/datasets/{name}.json`,
                    loader: "dataset-url",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.dataset[`${moduleId}:/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "dataset-url",
                    cache: false,
                    moduleId,
                    modulePath: moduleAssetsPath
                };

                // schemas
                resolver.schema ??= {}; 
                resolver.schema[`${moduleId}:{name}`] ??= {
                    src: `${moduleAssetsPath}/schemas/{name}.schema.json`,
                    loader: "schema-json",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                resolver.schema[`${moduleId}:/{path}`] ??= {
                    src: `${moduleAssetsPath}/{path}`,
                    loader: "schema-json",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPath
                };
                addSchemaDeclarations("module", moduleId, moduleAssetsPath, module.files);

                // contracts
                const moduleAssetsPathContracts = moduleAssetsPath + "/contracts";
                resolver.contract[`${moduleId}:{name}`] ??= {
                    src: `${moduleAssetsPathContracts}/{name}.json`,
                    loader: "object-json",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPathContracts
                };
                addContractDeclarations("module", moduleId, moduleAssetsPath, module.files);

                // commands
                const moduleAssetsPathCommands = moduleAssetsPath + "/commands";
                resolver.command[`${moduleId}:{name}`] ??= {
                    src: `${moduleAssetsPathCommands}/{name}.js`,
                    loader: "command-js",
                    cache: true,
                    moduleId,
                    modulePath: moduleAssetsPathCommands
                };
                addCommandDeclarations("module", moduleId, moduleAssetsPath, module.files);
            }

            return config;
        }
        config = fillXShell(config)
        config = fillXShellResolverRules(config)
        checkpoint("app config filled with missing values");

        // Install service worker
        async function installServiceWorker(config) {
            console.log("bootstrap: service worker: installing ...");
            // generate the mappings requested by this effective application generation after all asset locations are finalized
            config.xshell.serviceWorker ??= {};
            config.xshell.serviceWorker.mappings = [{
                src: new URL(config.xshell.assets.path.substring(1), appBaseUrl).href,
                dst: config.xshell.assets.url,
                version: config.xshell.version,
                name: "xshell",
                exceptions: [config.xshell.configUrl]
            }, ...Object.entries(config.modules).map(([moduleId, module]) => ({
                src: new URL(module.assets.path.substring(1), appBaseUrl).href,
                dst: module.assets.url,
                version: module.version,
                name: moduleId,
                exceptions: [module.configUrl]
            }))];
            // register service worker with the generated mappings
            const reg = await navigator.serviceWorker.register(appBasePath + "/sw.js", {
                scope: appBasePath + "/"
            });
            console.log("bootstrap: service worker: rules: ", config.xshell.serviceWorker.mappings);
            // wait for ready
            console.log("bootstrap: service worker: waiting for ready ...");
            await navigator.serviceWorker.ready;
            if (!navigator.serviceWorker.controller) {
                console.log("bootstrap: page is not controlled ... forcing reload");
                location.reload();
                return;
                //throw new Error("Service Worker installation failed: page is not controlled.");
            }
            // register mappings with the service worker
            console.log("bootstrap: service worker: registering mappings ...");
            await new Promise((resolve, reject) => {
                const channel = new MessageChannel();
                channel.port1.onmessage = event => {
                    clearTimeout(timeoutId);
                    channel.port1.close();
                    if (event.data?.type === "registered") {
                        resolve();
                    } else if (event.data?.type === "error") {
                        debugger;
                        reject(new Error(event.data.message || "Service Worker mapping registration failed."));
                    } else {
                        reject(new Error(`Unexpected Service Worker mapping registration response: '${event.data?.type}'.`));
                    }
                };
                const timeoutId = setTimeout(() => {
                    reject(new Error("Service Worker did not reply in time"));
                    channel.port1.close();
                }, 5000);
                reg.active.postMessage({ type: "registerMappings", payload: { rules: config.xshell.serviceWorker.mappings } }, [channel.port2]);
            });
            console.log("bootstrap: service worker: ready");
            return true;
        }
        await installServiceWorker(config)
        checkpoint("service worker installed");


        // import and start xshell
        function getXShellUrl(config) {
            const src = config.xshell?.resolver?.esm?.xshell?.src;
            if (typeof src !== "string" || !src.trim()) throw new Error("Missing XShell entry point: resolver.esm.xshell.src");
            return new URL(src.startsWith("/") ? src.substring(1) : src, appBaseUrl).href;
        }
        function deepFreeze(obj){
            if(obj===null||typeof obj!=="object") return obj;Object.freeze(obj);
            for(const value of Object.values(obj)) deepFreeze(value);
            return obj;
        }
        const xshellUrl = getXShellUrl(config);
        console.log("bootstrap: xshell: import  from ... ", xshellUrl);
        const xshellModule = await import(xshellUrl);
        checkpoint("xshell instance imported");

        const xshell = xshellModule.default;
        console.log("bootstrap: xshell: init", config);
        await xshell.init(deepFreeze(config));
        checkpoint("xshell initialized");

    } catch (error) {
        // error
        checkpoint("Failed phase");
        console.error("bootstrap: error", error);
        showBootstrapError(error);
    } finally {
        // hide spinner in finally block to ensure it is hidden even if an error occurs
        hideSpinner();
        console.group("bootstrap: performance timmings:");
        console.table(timings);
        console.log(`Total: ${(performance.now() - started).toFixed(2)} ms`);
        console.groupEnd();
    }
}

// main
main();