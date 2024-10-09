import i18n         from "./i18n.js";
import loader       from "./loader.js";
import logger       from "./logger.js";
import ui           from "./ui.js";
import utils        from "./utils.js";

import XPage        from "./x-page.js";
import XNavigator   from "./x-navigator.js";

// class
class XShell extends HTMLElement {
    
    //fields
    _config = {
        app: {
            name:       "",
            title:      "",
            version:    "",
            copyright:  "",
            logo:       ""
        },
        i18n: i18n.config,
        loader: loader.config,
        logger: logger.config,
        menus: {},
        modules: [],
        navigator: {
            base:  document.location.pathname.substring(0, document.location.pathname.lastIndexOf("/")),
            start: "",
        },
        ui: ui.config,
        user: {
            id: "",
            username: "anonymous",
            authenticated: false,
            claims: {}
        }
    };

    //ctor
    constructor() {
        super();
        logger.log(`x-shell.constructor()`);
    }

    //props
    get config() { return this._config; }
    get navigator() { return this.firstChild; }


    //events
    async connectedCallback() {
        let src = this.getAttribute("src");
        await this.addConfig(src);
        await this.start();
    }

    //methods    
    async addConfig(config, src = null) {
        if (typeof(config) == "string") {
            //add config from remote json file
            let url = utils.combineUrls(this.config.navigator.base, config); 
            logger.log(`x-shell.addConfig('${url}')`);
            let base = url.substring(0, url.lastIndexOf("/"));
            let response = await fetch(url);
            if (response.ok) {
                config = await response.json();
                utils.traverse(config, (obj, key) => {
                    let value = obj[key];
                    if (typeof value === "string") {
                        if (value.startsWith("./") || value.startsWith("../")){
                            obj[key] = utils.combineUrls(base, value);
                        } else if (value == ".") {
                            obj[key] = base;
                        }
                    }
                });
                this._config = utils.deepAssign(this._config, config);
            } else {
                console.error(`x-shell.addConfig(): ${response.status} ${response.statusText}`);
            }
        } else if (typeof(config) == "object") {
            //add config from object
            logger.log(`x-shell.addConfig('${src || config}')`);
            this._config = utils.deepAssign(this._config, config);
        } else {
            //error
            console.error(`x-shell.addConfig(): unable to add config, invalid type: ${typeof(config)}`);
        }
    }
    async start() {
        //start
        logger.log(`x-shell.start()`);
        //load modules that has remote urls
        let tasks = [];
        for(let i = 0; i < this.config.modules.length; i++) {
            let module = this.config.modules[i];
            if (module.url) {
                logger.log(`  fetching module '${module.url}' ...`);
                tasks.push((async() => {
                    let response = await fetch(module.url);
                    if (!response.ok) {
                        module.error = `HTTP error! status: ${response.status}`;
                    }  else {
                        module = Object.assign(module, await response.json());
                        this.config.modules[i] = module;
                    }
                })());
            }
        }
        await Promise.all(tasks);
        //merge modules configs into main config
        for(let module of this.config.modules) {
            if (module.config) {
                let base = module.url.substring(0, module.url.lastIndexOf("/"));
                utils.traverse(module.config, (obj, key) => {
                    let value = obj[key];
                    if (typeof value === "string" && value.startsWith("./")) {
                        obj[key] = base + value.substring(1);
                    }
                });
                this.addConfig(module.config, module.url);
                delete module.config;
            }
        }
        //init i18n
        await i18n.init(this._config.i18n);
        //init loader
        await loader.init(this._config.loader);
        //init logger
        await logger.init(this._config.logger);
        //init uri
        await ui.init(this._config.ui);
        //init navigator
        this.appendChild(new XNavigator());
        await this.navigator.init(this._config.navigator);
        //start ui
        await ui.start();
        //start navigator
        await this.navigator.start();
        //ready
        await this.ready();
    }
    async ready() {
        //ready
        logger.log(`x-shell.ready(): `, this._config);
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
            if (!target) {
                debugger;
                return null;
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

