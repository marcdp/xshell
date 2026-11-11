import Areas from "./areas.js";
import Bus from "./bus.js";
import Contracts from "./contracts.js";
import Dialog from "./dialog.js";
import I18n from "./i18n.js";
import Loader from "./loader.js";
import Navigation from "./navigation.js";
import Modules from "./modules.js";
import Page from "./page.js";
import Registry from "./registry.js";
import Resolver from "./resolver.js";
import Runtime from "./runtime.js";
import Services from "./services.js";
import XPage from "./x-page.js";
import JsonValidator from "./services/json-validator.js";
import { normalizeAreaPrefix } from "./utils/area.js";
import { compileRoute } from "./utils/route.js";

// class
class XShell {

    //fields
    _areas = null;
    _bus = null;
    _config = null;
    _contracts = null;
    _dialog = null;
    _i18n = null;
    _loader = null;
    _modules = null;
    _navigation = null;
    _registry = null;
    _resolver = null;
    _runtime = null;
    _services = null;
    
    //ctor
    constructor() {
    }

    //props
    get areas() { return this._areas; }
    get bus() { return this._bus; }
    get config() { return this._config; }
    get contracts() { return this._contracts; }
    get dialog() { return this._dialog; }
    get i18n() { return this._i18n; }
    get loader() { return this._loader; }
    get modules() { return this._modules; }
    get navigation() { return this._navigation; }
    get resolver() { return this._resolver; }
    get runtime() { return this._runtime; }
    get services() { return this._services; }
    get registry() { return this._registry; }
    get temp() { return this._services?.has("temp") ? this._services.resolve("temp") : null; }

    //methods
    async init(config) {
        // init
        this._bus = new Bus();
        this._config = config;        
        // init basic validateConfig
        this._resolver = new Resolver( { config: config } );
        this._loader = new Loader({ bus: this._bus, config: config, resolver: this._resolver });
        await this.validateConfig(config);
        // initialize rest of the services
        this._areas = new Areas( { bus: this._bus, config: config } );
        this._i18n = new I18n();
        this._contracts = new Contracts( { config: config, loader: this._loader } );
        await this._i18n.init(config.xshell.i18n);
        this._services = new Services( {config, loader: this._loader, contracts: this._contracts, areas: this._areas, bus: this._bus } );
        this._registry = new Registry( {config, loader: this._loader, resolver: this._resolver } );
        this._modules = new Modules( { bus: this._bus, config: config, loader: this._loader, resolver: this._resolver, document: document, services: this._services } );
        this._navigation = new Navigation( { areas: this._areas, bus: this._bus, config: config, container: document.body, resolver: this._resolver });
        this._dialog = new Dialog( { config: config, navigation: this._navigation, i18n: this._i18n } );        
        this._runtime = new Runtime();
        // compose contracts list in memory from modules             
        await this._contracts.init();
        // services
        this._services.register("areas", this._areas, { contractItem: this._contracts.getContractItemById("areas")});
        this._services.register("bus", this._bus, { contractItem: this._contracts.getContractItemById("bus")});
        this._services.register("config", this._config, { contractItem: this._contracts.getContractItemById("config")});
        this._services.register("dialog", this._dialog, { contractItem: this._contracts.getContractItemById("dialog")});
        this._services.register("i18n", this._i18n, { contractItem: this._contracts.getContractItemById("i18n")});
        this._services.register("loader", this._loader, { contractItem: this._contracts.getContractItemById("loader")});
        this._services.register("modules", this._modules, { contractItem: this._contracts.getContractItemById("modules")});
        this._services.register("navigation", this._navigation, { contractItem: this._contracts.getContractItemById("navigation")});
        this._services.register("resolver", this._resolver, { contractItem: this._contracts.getContractItemById("resolver")});
        this._services.register("runtime", this._runtime, { contractItem: this._contracts.getContractItemById("runtime")});
        this._services.register("contracts", this._contracts, { contractItem: this._contracts.getContractItemById("contracts")});
        this._services.register("services", this._services, { contractItem: this._contracts.getContractItemById("services")});
        this._services.register("registry", this._registry, { contractItem: this._contracts.getContractItemById("registry")});
        await this._services.init();
        await this._registry.init();
        // modules
        await this._modules.init();  
        // areas
        this._areas.init({ modules: this._modules });
        // navigation
        await this._navigation.init();
        
    }   
    async validateConfig(config) {
        // validate
        const configSchema = await this.loader.load("schema:config");
        const result = new JsonValidator().validate(config, configSchema);
        if (!result.valid) {
            console.error(`Invalid config:`, result.errors);
            throw new Error(`Invalid config:`, { cause: result.errors });
        }
        // validate static Area configuration
        const definitions = config.xshell.areas.definitions;
        const defaultAreaId = config.xshell.areas.default;
        if (defaultAreaId !== null && !Object.hasOwn(definitions, defaultAreaId)) throw new Error(`Default area '${defaultAreaId}' is not defined.`);
        const prefixes = new Map();
        for (const [areaId, area] of Object.entries(definitions)) {
            const prefix = normalizeAreaPrefix(area.prefix);
            if (prefixes.has(prefix)) throw new Error(`Areas '${prefixes.get(prefix)}' and '${areaId}' have duplicate normalized prefix '${prefix}'.`);
            prefixes.set(prefix, areaId);
            for (const moduleId of area.modules || []) {
                if (!Object.hasOwn(config.modules, moduleId)) throw new Error(`Area '${areaId}' references unknown module '${moduleId}'.`);
            }
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
        // global menu composition accepts only static arrays
        for (const menuName of config.xshell.areas.global) {
            for (const [moduleId, module] of Object.entries(config.modules)) {
                const menu = module.menus?.[menuName];
                if (menu !== undefined && !Array.isArray(menu)) throw new Error(`Global menu '${menuName}' from module '${moduleId}' must be a static array.`);
            }
        }
    }

}

// creates a default instance
let xshell = new XShell();

// export default instance
export default xshell;


