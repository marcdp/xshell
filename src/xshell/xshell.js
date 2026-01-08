import Api from "./api.js";
import Auth from "./auth.js";
import Binds from "./binds.js";
import Bus from "./bus.js";
import Config from "./config.js";
import Debug from "./debug.js";
import Dialog from "./dialog.js";
import I18n from "./i18n.js";
import Loader from "./loader.js";
import Navigation from "./navigation.js";
import Menus from "./menus.js";
import Modules from "./modules.js";
import Page from "./page.js";
import Pages from "./pages.js";
import Resolver from "./resolver.js";
import Settings from "./settings.js";
import Storage from "./storage.js";
import Tabs from "./tabs.js";
import Utils from "./utils.js";
import XPage from "./x-page.js";


// class
class XShell {

    //fields
    _api = null;
    _auth = null;
    _bus = null;
    _config = null;
    _container = null;
    _debug = null;
    _i18n = null;
    _identity = null;
    _loader = null;
    _menus = null;
    _modules = [];
    _navigation = null;
    _pages = null;
    _resolver = null;
    _settings = null;
    _storage = null;
    _tabs = null;


    //ctor
    constructor() {
    }


    //props
    get api() { return this._api; }
    get auth() { return this._auth; }
    get bus() { return this._bus; }
    get config() { return this._config; }
    get container() { return this._container; }
    get debug() { return this._debug; }
    get dialog() { return this._dialog; }
    get i18n() { return this._i18n; }
    get identity() { return this._identity; }
    get loader() { return this._loader; }
    get menus() { return this._menus; }
    get modules() { return this._modules; }
    get navigation() { return this._navigation; }
    get pages() { return this._pages; }
    get resolver() { return this._resolver; }
    get settings() { return this._settings; }
    get storage() { return this._storage; }
    get tabs() { return this._tabs; }


    //methods
    async init(value) {
        // init
        this._bus = new Bus();
        this._debug = new Debug();
        this._dialog = new Dialog();
        this._config = new Config({ debug: this._debug, bus: this._bus, value: value });
        this._api = new Api( { config: this._config} );
        this._container = document.body;
        this._resolver = new Resolver( { debug: this._debug, config: this._config } );
        this._loader = new Loader({ bus: this._bus, config: this._config, debug: this._debug, resolver: this._resolver });
        this._auth = new Auth({ config: this._config, loader: this._loader });
        this._i18n = new I18n();
        this._modules = new Modules( { bus: this._bud, config: this._config, loader: this._loader, resolver: this._resolver } );
        this._navigation = new Navigation( { bus: this._bus, config: this._config, container: this._container });
        this._settings = new Settings();
        this._storage = new Storage( {config: this.config } );
        this._pages = new Pages();
        this._tabs = new Tabs( { bus: this._bus } );
        this._menus = new Menus( { bus: this._bus, config: this._config, modules: this._modules, navigation: this._navigation } );
        // auth
        this._identity = await this.auth.login(this._config);
        // modules
        await this._modules.init();               
        // navigation
        await this._navigation.init();
    }
   
}

// creates a default instance
let xshell = new XShell();

// export default instance
export default xshell;

// export other objects and classes
export { Binds, Page, Utils };
