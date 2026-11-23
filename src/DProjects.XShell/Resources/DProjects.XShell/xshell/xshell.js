import Bus from "./services/bus.js";
import Contracts from "./services/contracts.js";
import Loader from "./services/loader.js";
import Page from "./page.js";
import Resolver from "./services/resolver.js";
import Runtime from "./services/runtime.js";
import Services from "./services.js";
import { createXPageClass } from "./x-page.js";
import JsonValidator from "./services/json-validator.js";
import { compileRoute } from "./utils/route.js";

// class
export default class XShell {

    //fields
    _config = null;
    _bus = null;
    _runtime = null;
    _resolver = null;
    _loader = null;
    _contracts = null;
    _services = null;
    _servicesInitialized = false;
    
    //ctor
    constructor() {}

    //methods
    async init(config, timings) {
        this._servicesInitialized = false;
        // config
        this._config = config;        
        // bus
        this._bus = new Bus({
        }, {});
        // runtime
        this._runtime = new Runtime({ bus: this._bus, timings });
        // resolved
        this._resolver = new Resolver( { 
            config: config 
        }, {});
        // loader
        this._loader = new Loader({ 
            bus: this._bus, 
            resolver: this._resolver,
            services: new Proxy(Object.create(null), {
                get: (target, prop) => {
                    // Resolve registered services on demand
                    if (typeof prop !== "string") return undefined;
                    if (!this._services) throw new Error(`Cannot resolve service '${prop}' before Services initialization`);
                    return this._services.resolve(prop);
                }
            })
        }, {
            appBasePath: config.app.basePath,
            xshellAssetsPath: config.xshell.assets.path,
            componentLazy: config.xshell.ui.components.lazy
        });
        // validate
        await this.validateConfig(config);
        // contracts
        this._contracts = new Contracts( { config: config, loader: this._loader }, { 
            xshellAssetsPath: config.xshell.assets.path,
            xshellFiles: config.xshell.files
        });
        // services
        this._services = new Services( {
            config, 
            loader: this._loader, 
            contracts: this._contracts, 
            resolver: this._resolver, 
            bus: this._bus
        } );
        // compose contracts list in memory from modules             
        await this._contracts.init();
        // services
        this._services.register("document", window.document, {});
        this._services.register("bus", this._bus, { contractItem: this._contracts.getContractItemById("bus")});
        this._services.register("config", this._config, { contractItem: this._contracts.getContractItemById("config")});
        this._services.register("loader", this._loader, { contractItem: this._contracts.getContractItemById("loader")});
        this._services.register("resolver", this._resolver, { contractItem: this._contracts.getContractItemById("resolver")});
        this._services.register("contracts", this._contracts, { contractItem: this._contracts.getContractItemById("contracts")});
        this._services.register("services", this._services, { contractItem: this._contracts.getContractItemById("services")});
        this._services.register("runtime", this._runtime, { contractItem: this._contracts.getContractItemById("runtime")});
        await this._services.init();
        this._servicesInitialized = true;
        // Construct and validate Areas before module controllers execute
        const areas = this._services.resolve("areas");
        // Resolve and initialize Modules and their controllers
        const modules = await this._services.initialize("modules");
        // Compose effective Areas after Modules initialization
        areas.init({ modules });
        // initialize XPage custom element
        const services = this._services;
        const XPage = createXPageClass({
            get config() { return services.resolve("config"); },
            get loader() { return services.resolve("loader"); },
            get bus() { return services.resolve("bus"); },
            get navigation() { return services.resolve("navigation"); },
            get areas() { return services.resolve("areas"); },
            get modules() { return services.resolve("modules"); }
        });
        customElements.define("x-page", XPage);
        // initialize the declaratively registered Navigation service
        await this._services.initialize("navigation");
        
    }   
    async validateConfig(config) {
        // validate
        const configSchema = await this._loader.load("schema:config");
        const result = new JsonValidator().validate(config, configSchema);
        if (!result.valid) {
            console.error(`Invalid config:`, result.errors);
            const detail = result.errors.find(error => error.instanceLocation && error.error) ?? result.errors[0];
            const location = detail?.instanceLocation ?? "#";
            const message = detail?.error ?? "Schema validation failed.";
            throw new Error(`Invalid config at '${location}': ${message}`, { cause: result.errors });
        }
        // validate routes with the same compiler used by Navigation
        for (const [moduleId, module] of Object.entries(config.modules)) {
            for (const path of Object.keys(module.routes || {})) {
                try {
                    compileRoute(path);
                } catch (cause) {
                    throw new Error(`Module '${moduleId}' declares invalid route '${path}'.`, { cause });
                }
            }
        }
    }

}
