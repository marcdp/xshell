import xshell from "../../../x-shell.js";
import XTemplate from "../ui/x-template.js";
import utils from "../../../utils.js";
import loader from "../../../loader.js";

// class
class XPageHandler extends HTMLElement  {

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
    get page() {return xshell.getPage(this);}
    get src() {return this.page.src;}

    get label() {return this.page.label;}
    set label(value) {this.page.label = value;}
    
    get icon() {return this.page.icon;}
    set icon(value) {this.page.icon = value;}
    
    get result() {return this.page.result;}
    set result(value) {this.page.result = value;}

    get state() {return this._state;}
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
        //styles
        let styleSheets = [];
        doc.body.querySelectorAll(":scope > style").forEach((style) => {styleSheets.push(style.sheet);});
        doc.head.querySelectorAll(":scope > style").forEach((style) => {styleSheets.push(style.sheet);});
        //template
        let template = doc.body.querySelector(":scope > template") || doc.head.querySelector(":scope > template");
        if (template) template = template.innerHTML.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
        //script
        let script = doc.body.querySelector(":scope > script[type='module']") || doc.head.querySelector(":scope > script[type='module']");
        let moduleText = script.textContent;
        let module = await utils.importModuleFromJSCode(moduleText, src);
        for(var key in module.default) {
            this[key] = module.default[key];
        }
        //state
        this.state = module.default.state || {};
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
            this.onCommand(event.detail.command, {event, data:event.detail.data});
            event.preventDefault();
            event.stopPropagation();
            return false;
        });
    }
    connectedCallback() {
        //template instance
        this._xtemplateInstance = this._xtemplate.createInstance(this._state, (command, args) => {
            //handler
            this.onCommand(command, args);
        }, () => {
            //invalidate
            this.invalidate();
        }, this);
        //search
        let searchParams = new URLSearchParams(this.src.indexOf("?") != -1 ? this.src.substring(this.src.indexOf("?")+1) : "");
        //load
        let loadArgs = {};
        for(const [key, value] of searchParams.entries()) if (!key.startsWith("x-")) loadArgs[key] = value;
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

// custom

//define web component
customElements.define('x-page-handler', XPageHandler);

//export 
export default XPageHandler;

