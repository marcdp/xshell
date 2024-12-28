import Binds from "./binds.js";

// class
class PageHandler {

    //vars
    _src = null;
    _page = null;
    _binds = new Binds();

    //ctor
    constructor() {
    }

    //props
    get page() { return this._page; }

    get src() { return this.page.src; }

    get label() { return this.page.label; }
    set label(value) { this.page.label = value; }

    get icon() { return this.page.icon; }
    set icon(value) { this.page.icon = value; }

    get result() { return this.page.result; }
    set result(value) { this.page.result = value; }

    //mehods
    async init(doc, src, container) {
        this._src = src;
        this._page = container;
        //create
        let documentFragment = document.createDocumentFragment();
        for(let i = 0; i < doc.body.childNodes.length; i++) {
            let node = doc.body.childNodes[i];
            if (node.localName == "script") {
                //script
                let script = node;
                let newScript = document.createElement("script");
                for (let j = 0; j < script.attributes.length; j++) {
                    newScript.setAttribute(script.attributes[j].name, script.attributes[j].value);
                }
                newScript.textContent = script.textContent;
                documentFragment.appendChild(newScript);            
            } else {
                //element
                documentFragment.appendChild(node.cloneNode(true));
            }
        };
        //add to container in one shot
        container.replaceChildren();
        container.appendChild(documentFragment);
    }
    async load() {
        await this.onCommand("load");
    }
    async onCommand(command, args) {
    }
    close(result) {
        return this.page.close(result);
    }
    async  unload() {
        this._binds.clear();
        await this.onCommand("unload");
    }

    //bind methods
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
    
}


//export 
export default PageHandler;