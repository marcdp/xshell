import shell from "./../../../shell.js";
import XTemplate from "./x-template.js";
import utils from "../../../utils.js";
import loader from "../../../loader.js";

class Page {

    //vars
    _xtemplate = null;
    _xtemplateInstance = null;
    _renderTimeoutId = 0;


    //ctor
    constructor() {
    }


    //methds
    async init(doc, src, container) {
        //script
        let script = doc.querySelector("body > script[type='module']");
        let module = null;
        if (script) {
            script.parentNode.removeChild(script);
            let moduleText = script.textContent;
            module = await utils.importModuleFromJSCode(moduleText, src);
            if (module.default) {
                for (var key in module.default) {
                    this[key] = module.default[key];
                }
            }
        }
        //styleSheets
        let styleSheets = [];
        doc.querySelectorAll("style").forEach((style) => {
            styleSheets.push(style.sheet);
            style.parentNode.removeChild(style);
        });
        //state
        let metaState = doc.head.querySelector("meta[name='x-page-state']");
        if (metaState) {
            let jsonState = metaState.content
            this.state = JSON.parse(jsonState);
        } else {
            this.state = (module && module.default && module.default.state) || {};
        }
        //remove meta
        doc.querySelectorAll("meta").forEach((meta) => {
            meta.parentNode.removeChild(meta);  
        });
        //template
        let template = doc.body.innerHTML.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
        //xtemplate
        this._xtemplate = new XTemplate({
            template,
            styleSheets
        });
        //load used web components
        if (this._xtemplate.dependencies) {
            let names = [];
            this._xtemplate.dependencies.forEach((name) => {
                names.push("component:" + name);
            });
            await loader.load(names);
        }
        //handle command event
        //this.addEventListener("command", (event) => {
        //    this.onCommand(event.detail.command, { event, data: event.detail.data });
        //    event.preventDefault();
        //    event.stopPropagation();
        //    return false;
        //});
        //template instance
        this._xtemplateInstance = this._xtemplate.createInstance(this._state, (command, event) => {
            //handler
            this.onCommand(command, { event });
        }, () => {
            //invalidate
            this.invalidate();
        }, container);
        //load
        let searchParams = new URLSearchParams(src.indexOf("?") != -1 ? src.substring(src.indexOf("?") + 1) : "");
        let loadArgs = {};
        for (const [key, value] of searchParams.entries()) {
            if (!key.startsWith("x-")) loadArgs[key] = value;
        }
        this.onCommand("load", loadArgs);
        //render
        this.render();
    }
    onCommand(command, args) {
        debugger;
    }
    showPage(args) {
        debugger;
        return this.page.showPage(args);
    }
    showDialog(args) {
        debugger;
        return this.page.showDialog(args);
    }
    close(result) {
        debugger;
        return this.page.close(result);
    }
    stateChanged(prop, oldvalue, newValue) {
        debugger;
    }
    invalidate() {
        //invalidate
        debugger;
        if (!this._renderTimeoutId) {
            this._renderTimeoutId = window.requestAnimationFrame(() => {
                this.render();
            });
        }
    }
    render() {
        //cancel pending render
        debugger;
        if (this._renderTimeoutId) {
            window.cancelAnimationFrame(this._renderTimeoutId);
            this._renderTimeoutId = 0;
        };
        //render
        this._xtemplateInstance.render();
    }
}

// export factory function
export default async function(doc, src, container) {
    let page = new Page();
    await page.init(doc, src, container);
    return page;
}


















// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

// class
class XPageHandlerSfc extends HTMLElement  {

    //fields
    _state = null;
    _xtemplate = null;
    _xtemplateInstance = null;
    _renderTimeoutId = 0;

    //ctor
    constructor() {
        super();
    }

    //properties
    get page() { return shell.getPage(this); }
    get src() { return this.page.src; }

    get label() { return this.page.label; }
    set label(value) { this.page.label = value; }

    get icon() { return this.page.icon; }
    set icon(value) { this.page.icon = value; }

    get result() { return this.page.result; }
    set result(value) { this.page.result = value; }

    get state() { return this._state; }
    set state(value) {
        let self = this;
        this._state = new Proxy(value, {
            set(target, prop, newValue) {
                let oldValue = target[prop];
                target[prop] = newValue;
                self.stateChanged(prop, oldValue, newValue);
                self.invalidate();
                return true;
            }
        });
    }

    //methods
    async init(doc, src) {
        //script
        let script = doc.querySelector("body > script[type='module']");
        let module = null;
        if (script) {
            script.parentNode.removeChild(script);
            let moduleText = script.textContent;
            module = await utils.importModuleFromJSCode(moduleText, src);
            if (module.default) {
                for (var key in module.default) {
                    this[key] = module.default[key];
                }
            }
        }
        //styleSheets
        let styleSheets = [];
        doc.querySelectorAll("style").forEach((style) => {
            styleSheets.push(style.sheet);
            style.parentNode.removeChild(style);
        });
        //template
        let template = doc.body.innerHTML.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
        //state
        let metaState = doc.head.querySelector("meta[name='x-page-state']");
        if (metaState) {
            let jsonState = metaState.content
            this.state = JSON.parse(jsonState);
        } else {
            this.state = (module && module.default && module.default.state) || {};
        }
        //xtemplate
        this._xtemplate = new XTemplate({
            template,
            styleSheets
        });
        //load used web components
        if (this._xtemplate.dependencies) {
            let names = [];
            this._xtemplate.dependencies.forEach((name) => {
                names.push("component:" + name);
            });
            await loader.load(names);
        }
        //handle command event
        this.addEventListener("command", (event) => {
            this.onCommand(event.detail.command, { event, data: event.detail.data });
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
        //template instance
        this._xtemplateInstance = this._xtemplate.createInstance(this._state, (command, event) => {
            //handler
            this.onCommand(command, { event });
        }, () => {
            //invalidate
            this.invalidate();
        }, this);
    }
    async connectedCallback() {
        //load
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?") + 1) : "");
        let loadArgs = {};
        for (const [key, value] of searchParams.entries()) if (!key.startsWith("x-")) loadArgs[key] = value;
        this.onCommand("load", loadArgs);
        //render
        this.render();
    }
    onCommand(command, args) {
    }
    showPage(args) {
        return this.page.showPage(args);
    }
    showDialog(args) {
        return this.page.showDialog(args);
    }
    close(result) {
        return this.page.close(result);
    }
    stateChanged(prop, oldvalue, newValue) {
    }
    invalidate() {
        //invalidate
        if (!this._renderTimeoutId) {
            this._renderTimeoutId = window.requestAnimationFrame(() => {
                this.render();
            });
        }
    }
    render() {
        //cancel pending render
        if (this._renderTimeoutId) {
            window.cancelAnimationFrame(this._renderTimeoutId);
            this._renderTimeoutId = 0;
        };
        //render
        this._xtemplateInstance.render();
    }
}

//define web component
//customElements.define('x-page-handler-sfc', XPageHandlerSfc);

//export 
//export default XPageHandlerSfc;

