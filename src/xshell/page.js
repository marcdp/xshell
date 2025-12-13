import Binds from "./binds.js";
import utils from "./utils.js";
import pageRegistry from "./page-registry.js";


// class
class Page {


    //vars
    _id = utils.generateId("page");
    _host = null;
    _refs = null;
    _binds = new Binds();
    _status = "";
    _controller = null;


    //ctor
    constructor() {
    }


    //props
    get host() { return this._host; }

    get id() { return this._id; }
    set id(value) { this._id = value; }

    get src() { return this._host.src; }
    get srcAbsolute() { return this._host.srcAbsolute; }

    get label() { return this._host.label; }
    set label(value) { this._host.label = value; }

    get icon() { return this._host.icon; }
    set icon(value) { this._host.icon = value; }

    get result() { return this._host.result; }
    set result(value) { this._host.result = value; }

    get refs() {
        if (!this._refs) {
            this._refs = new Proxy(this._host, {
                get: (target, prop) => {
                  return target.querySelector(`[ref="${prop}"]`);
                }
            });
        }
        return this._refs;
    }

    //mehods
    async init(host) {
        this._host = host;
        pageRegistry.registerPage(this);
    }
    async load() {
        // call load command
        const url = new URL(this.src, document.baseURI);
        const params = {
            query: Object.fromEntries(url.searchParams.entries()),
            path: url.pathname,
            hash: url.hash
        };
        await this.onCommand("load", params);
        // set status
        this._status = "loaded";
    }
    async onCommand(command, params = {}) {
        // on command
        if (this._controller && this._controller.onCommand) {
            await this._controller.onCommand(command, params, this);
        }
    }
    error({code, message, src, stack}) {
        // show error
        this._host.error(code, message, src, stack);
    }
    replace(src) {
        // replace source
        this._host.replace(src);
    }
    close(result) {
        // close
        return this._host.close(result);
    }
    async unload() {
        // unload
        this._binds.clear();
        await this.onCommand("unload");
        this._refs = null;
        this._status = "unloaded";
        pageRegistry.unregisterPage(this);
        this._host = null;
    }


    // bind methods
    bindEvent(target, event, command) {
        this._binds.bindEvent(target, event, (event)=> {
            if (typeof(command) == "string") {
                this.onCommand(command, {event});
            } else {
                command(event);
            }
        });
    }
    bindTimeout(timeout, command) {
        this._binds.bindTimeout(timeout, (event)=> {
            if (typeof(command) == "string") {
                this.onCommand(command, {event});
            } else {
                command(event);
            }
        });
    }
    bindInterval(timeout, command) {
        this._binds.bindInterval(timeout, (event)=> {
            if (typeof(command) == "string") {
                this.onCommand(command, {event});
            } else {
                command(event);
            }
        });
    }

    // rpc methods
    async rpc(method, args) {
    }

    // set page controller (called by page-context, if exists script in page)
    async setController(type, controller){
        // validations
        if (typeof type === "object") {
            controller = type;
            type = "html";
        }
        // todo: perform some things based on type (what exactly ?) -> to think about it: in a future, we should be able to have different types of controllers
        // ...
        // create controller
        this._controller = controller;
    }

   
}

//export 
export default Page;
