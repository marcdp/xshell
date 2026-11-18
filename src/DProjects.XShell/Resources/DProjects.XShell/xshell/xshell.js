import Bus from "./services/bus.js";
import Contracts from "./services/contracts.js";
import Loader from "./services/loader.js";
import Page from "./page.js";
import Resolver from "./services/resolver.js";
import Services from "./services.js";
import XPage from "./x-page.js";
import JsonValidator from "./services/json-validator.js";
import { compileRoute } from "./utils/route.js";

// class
class XShell {

    //fields
    _config = null;
    _bus = null;
    _resolver = null;
    _loader = null;
    _contracts = null;
    _services = null;
    
    //ctor
    constructor() {
    }

    //props
    get areas() { return this._services.resolve("areas"); }
    get bus() { return this._bus; }
    get config() { return this._config; }
    get contracts() { return this._contracts; }
    get loader() { return this._loader; }
    get modules() { return this._services.resolve("modules"); }
    get navigation() { return this._services.resolve("navigation"); }
    get resolver() { return this._resolver; }
    get services() { return this._services; }

    //methods
    async init(config) {
        // init
        this._config = config;        
        // core services
        this._bus = new Bus({}, {});
        this._resolver = new Resolver( { config: config }, {});
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
            componentLazy: config.xshell.ui.component.lazy
        });
        // validate config
        await this.validateConfig(config);
        // advanced services
        this._contracts = new Contracts( { config: config, loader: this._loader }, { 
            xshellAssetsPath: config.xshell.assets.path,
            xshellFiles: config.xshell.files
        });
        this._services = new Services( {config, loader: this._loader, contracts: this._contracts, resolver: this._resolver, bus: this._bus } );
        // compose contracts list in memory from modules             
        await this._contracts.init();
        // services
        this._services.register("bus", this._bus, { contractItem: this._contracts.getContractItemById("bus")});
        this._services.register("config", this._config, { contractItem: this._contracts.getContractItemById("config")});
        this._services.register("loader", this._loader, { contractItem: this._contracts.getContractItemById("loader")});
        this._services.register("resolver", this._resolver, { contractItem: this._contracts.getContractItemById("resolver")});
        this._services.register("contracts", this._contracts, { contractItem: this._contracts.getContractItemById("contracts")});
        this._services.register("services", this._services, { contractItem: this._contracts.getContractItemById("services")});
        await this._services.init();
        // Initialize the declaratively registered Registry
        await this._services.resolve("registry").init();
        // Construct and validate Areas before module controllers execute
        const areas = this._services.resolve("areas");
        // Resolve and initialize Modules and their controllers
        const modules = this._services.resolve("modules");
        await modules.init();
        // Compose effective Areas after Modules initialization
        areas.init({ modules });
        // initialize the declaratively registered Navigation service
        await this._services.resolve("navigation").init();
        
    }   
    async validateConfig(config) {
        // validate
        const configSchema = await this.loader.load("schema:config");
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

// creates a default instance
let xshell = new XShell();

// export default instance
export default xshell;


