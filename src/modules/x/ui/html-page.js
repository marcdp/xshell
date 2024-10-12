import XElement from "./x-element.js";
import XTemplate from "./x-template.js";
import utils from "../../../utils.js";
import loader from "../../../loader.js";

// class
class PageHandler {

    //fields
    _page = null;
    _container = null;
    _state = null;
    _xtemplate = null;
    _xtemplateInstance = null;

    //ctor
    constructor(page, container, template, styles) {
        debugger;
        this._page = page;
        this._container = container;
        this._xtemplate = new XTemplate({
            template: template,
            styleSheets: styles
        });
        
    }

    //properties
    get dependencies() {return this._xtemplate.dependencies;}
    get src() {return this._page.src;}
    get label() {return this._page.label;}
    set label(value) {this._page.label = value;}
    get icon() {return this._page.icon;}
    set icon(value) {this._page.icon = value;}
    get result() {return this._page.result;}
    set result(value) {this._page.result = value;}

    get state() {return this._state;}
    set state(value) {this._state = value;}

    //methods
    load(args) {       
        //state
        let self = this;
        let rawState = this.state || {};
        delete this.state;
        this.state = new Proxy(rawState, {
            set(target, prop, newValue) {
                let oldValue = target[prop];
                target[prop] = newValue;
                self.stateChanged(prop, oldValue, newValue);
                self.render();
                return true;
            }
        });
        //template instance
        this._xtemplateInstance = this._xtemplate.createInstance(rawState, (aa,bb)=>{
            debugger;
        }, this._container);
        //load
        this.onCommand("load", args);
        this.render();
    }
    onCommand(command, args) {
    }
    unload() {
    }
    showPage(args) {
        return this._page.showPage(args);
    }
    showPageStack(args) {
        return this._page.showPageStack(args);
    }
    showPageDialog(args) {
        return this._page.showPageDialog(args);
    }
    close(result) {
        return this._page.close(result);
    }
    stateChanged(prop, oldvalue, newValue) {
    }
    invalidate() {
        //TODO: timeout
        //...        
    }
    render() {
        this._xtemplateInstance.render();
    }   
}


// export
export default async function(doc, src, container, label, icon, breadcrumb) {
    debugger;
    let styles = [];
    doc.body.querySelectorAll(":scope > style").forEach((style) => {styles.push(style);});
    doc.head.querySelectorAll(":scope > style").forEach((style) => {styles.push(style);});
    //template
    let template = doc.body.querySelector(":scope > template") || doc.head.querySelector(":scope > template");
    //script
    let script = doc.body.querySelector(":scope > script[type='module']") || doc.head.querySelector(":scope > script[type='module']");
    let moduleText = script.textContent;
    //let baseUrl = src.substring(0, src.lastIndexOf("/"));
    utils.importModuleFromJSCode(moduleText, src);
    //create instance
    debugger;
    let instance = new PageHandler(this, container, template.innerHTML, styles);
    debugger;
    //load dependencies
    if (instance.dependencies) {
        let resourceNames = [];
        this._instance.dependencies.forEach((componentName) => {
            resourceNames.push("component:" + componentName);
        });
        await loader.load(resourceNames);          
    }
    //load instance
    let loadArgs = {};
    for(const [key, value] of searchParams.entries()) if (!key.startsWith("x-")) loadArgs[key] = value;
    this._instance.load(loadArgs);
    //init
    if(label) this.label = label;
    if(icon) this.icon = icon;
    if (breadcrumb) this.breadcrumb = breadcrumb;

};