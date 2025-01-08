import XTemplate from "./x-template.js";
import createState from "./create-state.js";
import { utils, PageInstance } from "../../../shell.js";



class PageInstanceSfc extends PageInstance {


    //vars
    _state = null;
    _xtemplate = null;
    _xtemplateInstance = null;
    _renderTimeoutId = 0;
    _


    //ctor
    constructor() {
        super();
    }

    //props
    get state() { 
        return this._state; 
    }
    set state(value) {
        this._state = createState(value, this);
        this.invalidate();
    }

    //methds
    async init(doc, container) {
        this._page = container;
        //clear container   
        let documentFragment = document.createDocumentFragment();
        //script
        let script = doc.querySelector("body > script[type='module']");
        let module = null;
        if (script) {
            let moduleText = script.textContent;
            module = await utils.importModuleFromJSCode(moduleText, this.srcAbsolute);
            if (module.default) {
                for (var key in module.default) {
                    this[key] = module.default[key];
                }
            }
        }
        //styleSheets
        let styleSheets = [];
        doc.querySelectorAll("style").forEach((style) => {
            //styleSheets.push(style.sheet);
            //style.parentNode.removeChild(style);
        });
        //state
        let metaState = doc.querySelector("meta[name='page-state']");
        if (metaState) {
            let jsonState = metaState.content;
            this.state = JSON.parse(jsonState);
        } else {
            this.state = (module && module.default && module.default.state) || {};
        }
        //template
        let template = "";
        let templateElement = doc.querySelector("template");
        if (templateElement) {
            template = templateElement.innerHTML.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
        }
        //xtemplate
        this._xtemplate = new XTemplate({
            template,
            styleSheets
        });
        //template instance
        this._xtemplateInstance = this._xtemplate.createInstance((command, event) => {
            //handler
            this.onCommand(command, { event });
        }, () => {
            //invalidate
            this.invalidate();
        }, container);
        //add to the dom in one shot
        container.replaceChildren();
        container.appendChild(documentFragment);
    }
    async load() {
        //load
        let src = this.src;
        let searchParams = new URLSearchParams(src.indexOf("?") != -1 ? src.substring(src.indexOf("?") + 1) : "");
        let loadArgs = {};
        for (const [key, value] of searchParams.entries()) {
            loadArgs[key] = value;
        }
        await this.onCommand("load", loadArgs);
        //set status
        this._status = "loaded";
        //render
        this.render();
    }
    stateChanged(prop, oldvalue, newValue) {
        //state changed
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
        if (this._status != "unloaded") {
            this._xtemplateInstance.render(this._state);
        }
    }
}

// export class
export default PageInstanceSfc;
