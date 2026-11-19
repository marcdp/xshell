// class
export default class Modules {

    // options
    static optionsSchema = {
        type: "object",
        additionalProperties: false
    };

    // vars
    _bus = null;
    _config = null;
    _loader = null;
    _resolver = null;
    _modules = null;
    _shadowStyleSheets = null;
    _document = null;
    _services = null;
    
    
    // ctor
    constructor({ bus, config, loader, resolver, services, document }, options = {}) {
        // initialize injected dependencies
        this._bus = bus;
        this._config = config;
        this._loader = loader;
        this._resolver = resolver;
        this._document = document;
        this._services = services;
        this._modules = [];
        this._shadowStyleSheets = Object.freeze([]);
    }

    // props
    get registry() {
        // expose module metadata without returning controllers or mutable runtime records
        return Object.freeze(this._modules.map(module => Object.freeze({
            id: module.id,
            label: module.label,
            path: module.path,
            version: module.config.version || "",
            assets: Object.freeze({
                path: module.config.assets.path,
                url: module.config.assets.url || ""
            }),
            builtAt: module.config.builtAt || "",
            configUrl: module.config.configUrl || "",
            icon: module.config.icon || null,
            files: Object.freeze(module.config.files.map(file => Object.freeze({ path: file.path, size: file.size })))
        })));
    }
    get shadowStyleSheets() {
        // expose the shared sheets in deterministic module order without allowing collection changes
        return this._shadowStyleSheets;
    }

    // method
    async init() {
        // init modules instances
        // validate service requirements before loading or starting any module controller
        for (const moduleId of Object.keys(this._config.modules)) {
            const moduleConfig = this._config.modules[moduleId];
            for (const serviceName of moduleConfig.requires || []) {
                if (!this._services.has(serviceName)) throw new Error(`Module '${moduleId}' requires unavailable service '${serviceName}'.`);
            }
        }

        // create modules
        let tasks = [];
        const shadowStyleTasks = [];
        for(var moduleId of Object.keys(this._config.modules)) {
            const moduleConfig = this._config.modules[moduleId];
            // instance
            let module = {
                id: moduleId,
                config: moduleConfig,
                label: moduleConfig.label || moduleId,
                path: moduleConfig.assets.path,
                params: moduleConfig.params,
                routes: moduleConfig.routes || Object.freeze({}),
                styles: [],
                controller: {
                    onCommand: function() {}
                }
            };
            // styles
            const moduleIndexCss = moduleConfig.assets.path + "/styles/index.css";
            if (moduleConfig.files.some(file => file.path == moduleIndexCss)) {
                tasks.push((async() => {
                    let styleSheet = await this._loader.load("style:" + moduleIndexCss);
                    module.styles.push(styleSheet);
                })());
            }
            // shared Shadow DOM styles
            const moduleShadowCss = moduleConfig.assets.path + "/styles/shadow.css";
            if (moduleConfig.files.some(file => file.path == moduleShadowCss)) {
                const task = this._loader.load("style:" + moduleShadowCss);
                shadowStyleTasks.push(task);
                tasks.push(task);
            }
            // add module instance
            this._modules.push(module);
        }
        await Promise.all(tasks);

        // publish shared sheets before module controllers can instantiate Components or Pages
        this._shadowStyleSheets = Object.freeze(await Promise.all(shadowStyleTasks));

        // load module controllers after both stylesheet categories are ready
        for (const module of this._modules) {
            const moduleId = module.id;
            const moduleConfig = module.config;
            const moduleControllerJs = moduleConfig.assets.path + "/module.js";
            if (!moduleConfig.files.some(file => file.path == moduleControllerJs)) continue;
            const moduleClass = await this._loader.load("esm:" + moduleControllerJs);
            const servicesProvider = new Proxy({}, {
                get: (obj, prop) => {
                    if (prop == "moduleAssetsPath") {
                        // module assets path
                        return moduleConfig.assets.path;
                    } else if (prop == "moduleConfig") {
                        // module config
                        return { id: moduleId, ...moduleConfig };
                    } else {
                        // resolve from services
                        return this._services.resolve(prop);
                    }
                }
            });
            module.controller = new moduleClass(servicesProvider);
        }

        // dispatch module-load to all instances
        await this.start();

        // freeze modules
        for (let module of this._modules) {
            Object.freeze(module);
        }

        // add styles to document header
        for (let module of this._modules) {
            for (let styleSheet of module.styles) {
                this._document.adoptedStyleSheets.push(styleSheet);
            }
        }
    }

    // start/stop
    async start() {
        const started = [];
        try {
            for (const module of [...this._modules]) {
                if (module.controller?.start) {
                    await module.controller.start();
                }
                started.push(module);
            }
        } catch (error) {
            for (const module of [...started].reverse()) {
                try {
                    if (module.controller?.stop) {
                        await module.controller.stop();
                    }
                } catch {
                    // Keep the original startup error.
                }
            }
            throw error;
        }
    } 
    async stop() {
        for (const module of [...this._modules].reverse()) {
            if (module.controller?.stop) {
                await module.controller.stop();
            }
        }
    }


    // methods
    resolveModuleId(src) {
        //get module name by src
        if (!src) return null;
        for (let module of this._modules) {
            if (src.startsWith(module.path + "/")) {
                return module.id;
            }
        }
        return null;
    }
    getModuleById(id) {
        //get module by id
        for (let module of this._modules) {
            if (module.id == id) {
                return module;
            }
        }
        return null;
    }
}

