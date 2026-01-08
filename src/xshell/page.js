import Binds from "./binds.js";
import Utils from "./utils.js";
import xshell from "./xshell.js";


// class
export default class Page {


    //vars
    _id = Utils.generateId("page");
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

    get controller() { return this._controller; }
    set controller(value) { this._controller = value; }

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
        xshell.pages.registerPage(this);
    }
    async mount() {
        // mount
        await this.onCommand("mount", {}, this);
    }
    async load() {
        // call load command
        const url = new URL(this.src, document.baseURI);
        const params = {
            query: Object.fromEntries(url.searchParams.entries()),
            context: this._host.context,
            path: url.pathname,
            hash: url.hash
        };
        await this.onCommand("load", params, this);
        // set status
        this._status = "loaded";
    }
    async onCommand(command, params = {}, page) {
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
    async unmount() {
        // unmount
        await this.onCommand("unmount", {}, this);
    }
    async unload() {
        // unload
        this._binds.clear();
        await this.onCommand("unload", {}, this);
        this._refs = null;
        this._status = "unloaded";
        xshell.pages.unregisterPage(this);
        this._host = null;
    }


    // bind methods
    bindEvent(target, event, command) {
        this._binds.bindEvent(target, event, (event)=> {
            if (typeof(command) == "string") {
                this.onCommand(command, {event}, this);
            } else {
                command(event);
            }
        });
    }
    bindTimeout(timeout, command) {
        this._binds.bindTimeout(timeout, (event)=> {
            if (typeof(command) == "string") {
                this.onCommand(command, {event}, this);
            } else {
                command(event);
            }
        });
    }
    bindInterval(timeout, command) {
        this._binds.bindInterval(timeout, (event)=> {
            if (typeof(command) == "string") {
                this.onCommand(command, {event}, this);
            } else {
                command(event);
            }
        });
    }

    
   
}
