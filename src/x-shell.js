import app          from "./app.js";
import bus          from "./bus.js";
import i18n         from "./i18n.js";
import menus        from "./menus.js";
import modules      from "./modules.js";
import loader       from "./loader.js";
import logger       from "./logger.js";
import server       from "./server.js";
import ui           from "./ui.js";
import user         from "./user.js";
import utils        from "./utils.js";

import XPage        from "./x-page.js";
import XNavigator   from "./x-navigator.js";


// class
class XShell extends HTMLElement {
    

    //fields
    _config = {
        app: app.config,
        bus: bus.config,
        i18n: i18n.config,
        loader: loader.config,
        logger: logger.config,
        menus: menus.config,
        modules: modules.config,
        navigator: {
            base:  "",
            start: "",
            titlePrefix: "",
            titleSuffix: ""
        },
        ui: ui.config,
        user: user.config,
        server: server.config
    };

    //ctor
    constructor() {
        super();
        
    }

    //props
    get config() { return this._config; }
    get navigator() { return this.firstChild; }

    //methods    
    addConfig(config) {
        this._config = utils.deepAssign(this._config, config);
    }
    async start(config) {
        //init
        logger.log(`x-shell.start()`);
        this._config = Object.assign(config);
        //init modules
        await modules.init(this._config.modules, this);
        //init the rest of the features
        await app.init(this._config.app);
        await bus.init(this._config.bus);
        await i18n.init(this._config.i18n);
        await loader.init(this._config.loader);
        await logger.init(this._config.logger);
        await menus.init(this._config.menus);
        await server.init(this._config.server);
        await ui.init(this._config.ui);
        await user.init(this._config.user);        
        //init navigator
        this.appendChild(new XNavigator());
        await this.navigator.init(this._config.navigator);
        //start ui
        await ui.start();
        //start all modules
        await modules.start();
        //start navigator
        await this.navigator.start();
        //ready
        await this.ready();
    }
    async ready() {
        //ready
        logger.log(`x-shell.ready(): ${JSON.stringify(this._config, null, 2)}`);
    }

    //public
    async showPage({url, type, sender}) {
        await this.navigator.showPage({url, type, sender});
    }
    async showPageStack({url, sender}) {
        await this.navigator.showPage({url, type: "stack", sender});
    }
    async showPageDialog({url, sender}) {
        return await this.navigator.showPage({url, type: "dialog", sender});
    }
    getRealUrl(url, page = null, includeCurrentPage = false){
        return this.navigator.getRealUrl(url, page, includeCurrentPage);
    }
    getPage(target) {
        while (target) {
            if (!target.parentNode) {
                target = target.host;
            }
            if (target.localName == "x-page") return target;
            target = target.parentNode;
        }
        return null;
    }

}


//define web component
customElements.define('x-shell', XShell);


//get or create instance
let xshell = document.querySelector("x-shell");
if (!xshell) {
    xshell = document.createElement("x-shell");
    document.body.appendChild(xshell);
}


//export default instance
export default xshell;

