import XTemplate from "./x-template.js";
import createState from "./create-state.js";

class XController {

    //vars
    _state = null;
    _xtemplate = null;
    _xtemplateInstance = null;
    _renderTimeoutId = 0;
    _onCommandHandler = null;
    _mounted = false;

    //ctor
    constructor(definition) {
        this._onCommandHandler = definition.onCommand || function(){};
        this.state = definition.state || {};
        this.invalidate();
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
    async onCommand(command, params, page) {
        // pre command hook
        if (command == "mount") {
            // styleSheets
            let styleSheets = [];
            page.host.querySelectorAll("style").forEach((style) => {
                styleSheets.push(style.sheet);
            });
            // template
            let template = "";
            let templateElement = page.host.querySelector("template");
            if (templateElement) {
                template = templateElement.innerHTML.replaceAll("{{", "<x:text>").replaceAll("}}", "</x:text>").trim();
            }
            // xtemplate
            this._xtemplate = new XTemplate({
                template,
                styleSheets
            });
            // template instance
            this._xtemplateInstance = this._xtemplate.createInstance((command, event) => {
                //handler
                this.onCommand(command, { event }, page);
            }, () => {
                //invalidate
                this.invalidate();
            }, page.host);
            // remove child nodes from
            page.host.replaceChildren();
            //
            this._mounted = true;
        } else if (command == "unmount") {
            // unmount
            this._mounted = false;
        }
        // command
        await this._onCommandHandler.call(this, command, params, page);
        // post command
        if (command == "load") {
            // load
            this.render();
        }
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
        if (this._mounted) {
            this._xtemplateInstance.render(this._state);
        }
    }
}

// export default
export default XController;
