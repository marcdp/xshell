import XTemplate from "./x-template.js";
import xshell from "./../../../x-shell.js";
import loader from "./../../../loader.js";


// utils
function kebabToCamel(str) {
    return str.split('-')
        .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
};
function camelToKebab(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2') 
      .toLowerCase();                      
}

// class
class XElement extends HTMLElement {

    //fields
    _xtemplateInstance = null;
    _state = null;

    //work fields
    _connected = false;
    _loaded = false;
    _loadCalled = false;
    _renderTimeoutId = 0;
    
    //ctor
    constructor() {
        super();
        //shadowRoot
        let shadowRoot = this.attachShadow(this.settings.shadowRootOptions);
        //state
        let rawState = this.constructor.prototype.state();
        this.state = rawState;
        //instance
        let self = this;
        this._xtemplateInstance = this.constructor.prototype.xtemplate.createInstance(
            rawState,
            (command, event) => {
                self.onCommand(command, event);
            }, 
            shadowRoot
        );
    }

    //props
    get page() {
        return xshell.getPage(this);
    }
    get xshell() {
        return xshell;
    }
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

    //events
    attributeChangedCallback(name, oldValue, newValue) {
        let prop = kebabToCamel(name);
        let oldPropValue = this._state[prop];
        if (typeof(oldPropValue) == "boolean") {
            newValue = (newValue != null);
        }
        if (oldPropValue != newValue) {
            this._state[prop] = newValue;
        }
    }
    connectedCallback() {
        this._connected = true;
        if (!this._loadCalled) {
            this._loaded = true;
            this.onCommand("load", {});
        }
        this.render();
    }
    disconnectedCallback() {
        this._connected= false;
        this.onCommand("unload", {});
    }


    //methods to override
    onCommand(command, args) {
        //to override
    }
    onStateChanged(name, oldValue, newValue) {
        //to override
    }

    //methods to not override
    stateChanged(prop, oldValue, newValue) {
        //a state prop changed
        let attr = camelToKebab(prop);
        if (this.settings.backPropagatedAttributes.indexOf(attr) != -1) {
            if (typeof(newValue) == "boolean") {
                if (newValue) {
                    if (!this.hasAttribute(attr)) this.setAttribute(attr, "");
                } else {
                    if (this.hasAttribute(attr)) this.removeAttribute(attr);
                }
            } else {
                let attrOldValue = this.getAttribute(attr);
                let attrNewValue = newValue ? newValue.toString() : "";
                    if (attrOldValue != attrNewValue) {
                    this.setAttribute(attr, attrNewValue);
                }
            }
        }
        this.onStateChanged(prop, oldValue, newValue);
    }    
    invalidate() {
        //enqueue a render
        if (this._connected) {
            if (!this._renderTimeoutId) {
                this._renderTimeoutId = window.requestAnimationFrame(() => {
                    this.render();
                });
            }
        }
    }
    render() {
        if (this._renderTimeoutId) {
        //cancel pending render
        window.cancelAnimationFrame(this._renderTimeoutId);
            this._renderTimeoutId = 0;
        };
        //render
        this._xtemplateInstance.render();
    }


    //static
    static async define(name, definition) {
        //settings
        let settings = Object.freeze(Object.assign({
            shadowRootOptions: { mode: "open"},
            observedAttributes: [],
            backPropagatedAttributes: [],
            autoGeneratedProperties: true,
        }, definition.settings));
        //create web component class
        let result = class extends XElement {
            //satatic
            static definition = definition;
            static get observedAttributes() { return settings.observedAttributes || []; }
            //props
            get settings() { return settings ;}
        };
        //xtemplate
        result.prototype.xtemplate = new XTemplate({ 
            template: definition.template || "", 
            styleSheets: definition.styleSheets || definition.style || []
        });
        //style global
        if (definition.styleGlobal){
            let style = document.createElement("style");
            style.innerHTML = definition.styleGlobal;
            document.head.appendChild(style);
        }
        //load dependencies
        let names = [];
        result.prototype.xtemplate.dependencies.forEach((name) => {
            names.push("component:" + name);
        });
        await loader.load(names);
        //state
        let stateAsJson = JSON.stringify({});
        if (!definition.state) definition.state = {};
        stateAsJson = JSON.stringify(definition.state);
        result.prototype.state = () => {
            return JSON.parse(stateAsJson);
        };
        //methods
        if (definition.methods){
            for(let key in definition.methods) {
                let value = definition.methods[key];
                result.prototype[key] = value;
            }
        }
        //properties
        let state = definition.state;
        if (settings.autoGeneratedProperties) {
            var propNames = [];
            if (Array.isArray(settings.autoGeneratedProperties)) {
                for(let propName of settings.autoGeneratedProperties) {
                    propNames.push(propName);
                }
            } else {
                for(let propName in state) {
                    propNames.push(propName);
                }
            }
            for(let propName of propNames) {
                //if (propName == "expanded") debugger;
                Object.defineProperty(result.prototype, propName, {
                    get() {
                        return this.state[propName];
                    },
                    set(value) {
                        this.state[propName] = value;
                    }
                });
            }
        }
        //register
        customElements.define(name, result);
        //return
        return result;
    }
}

//export
export default XElement;
