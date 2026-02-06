import Binds from "./binds.js";
import { generateId } from "./utils/ids.js";
import xshell from "xshell";


// class
export default class Page {


    //vars
    _id = null;
    _src = null;
    _label = null;
    _icon = null;
    _result = null;

    _host = null;
    _renderEngine = null;
    _refs = null;
    _binds = new Binds();

    //ctor
    constructor({ src }) {
        this._src= src;
        this._id = generateId("page");
    }


    //props
    get host() { return this._host; }

    get id() { return this._id; }
    set id(value) { this._id = value; }

    get src() { return this._src; }

    get label() { return this._label; }
    set label(value) { this._label = value; }

    get icon() { return this._icon; }
    set icon(value) { this._icon = value; }

    get result() { return this._result; }
    set result(value) { this._result = value; }

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

    // lifecycle mehods
    async load() {
        // call load command
        const url = new URL(this._src, document.baseURI);
        const params = {
            query: Object.fromEntries(url.searchParams.entries()),
            path: url.pathname,
            hash: url.hash
        };
        await this.onCommand("load", params);
        // bus event
        xshell.bus.emit("xshell:page:load", { src: this._src, id: this._id });
    }
    async mount({ host, renderEngine }) {
        // mount
        this._host = host;
        this._renderEngine = renderEngine;
        this._renderEngine.mount();
        await this.onCommand("mount", {});
    }
    async onCommand(command, params = {}) {
        // on command
    }
    async unmount() {
        // unmount
        this._renderEngine.unmount();
        this._renderEngine = null;
        this._host = null;
        await this.onCommand("unmount", {});
    }
    async unload() {
        // unload
        this._binds.clear();
        await this.onCommand("unload", {});
        this._refs = null;
    }


    // error methods
    error({code, message, src, stack}) {
        // show error
        this._host.error(code, message, src, stack);
    }


    // close methods
    close(result) {
        // close
        return this._host.close(result);
    }

    // nav methods ??? WE SHOULD REMOVE THIS !
    replace(src) {
        // replace source
        this._host.replace(src);
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
    
    // render engine methods
    invalidate(...params) {
        this._renderEngine?.invalidate(...params);
    }
    
}
