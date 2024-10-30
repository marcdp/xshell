import bus          from "./bus.js";
import i18n         from "./i18n.js";
import loader       from "./loader.js";
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
    _startedAt = new Date();

    //ctor
    constructor() {
        super();
        console.log(`x-shell.constructor()`);
    }

    //props
    get config() { return this._config; }
    get navigator() { return this.firstChild; }
    get startedAt() { return this._startedAt; }


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
            console.log(`x-shell.addConfig('${url}')`);
            let base = url.substring(0, url.lastIndexOf("/"));
            let response = await fetch(url);
            if (response.ok) {
                let json = utils.stripJsonComments(await response.text());
                config = JSON.parse(json);
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
            console.log(`x-shell.addConfig('${src || config}')`);
            this._config = utils.deepAssign(this._config, config);
        } else {
            //error
            console.error(`x-shell.addConfig(): unable to add config, invalid type: ${typeof(config)}`);
        }
    }
    async start() {
        //start
        console.log(`x-shell.start()`);
        //load modules that has remote urls
        let tasks = [];
        for(let i = 0; i < this.config.modules.length; i++) {
            let module = this.config.modules[i];
            if (module.url) {
                console.log(`  fetching module '${module.url}' ...`);
                tasks.push((async() => {
                    let response = await fetch(module.url);
                    if (!response.ok) {
                        module.error = `HTTP error! status: ${response.status}`;
                    }  else {
                        let json = JSON.parse(utils.stripJsonComments(await response.text()));
                        module = Object.assign(module, json);
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
        console.log(`x-shell.ready(): `, this._config);
    }
    

    //public
    async showPage({url, type, sender, target}) {
        await this.navigator.showPage({url, type, sender, target});
    }
    async showDialog({url, sender}) {
        return await this.navigator.showPage({url, target: "#dialog", sender});
    }
    getRealUrl(url, page, settings){
        return this.navigator.getRealUrl(url, page, settings);
    }
    getPage(target) {
        while (target) {
            if (!target.parentNode) {
                target = target.host;
            }
            if (!target) {
                //debugger;
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

