import Binds from "./binds.js";


// class
class PageInstance {


    //vars
    _page = null;
    _refs = null;
    _binds = new Binds();
    _status = "";


    //ctor
    constructor() {
    }


    //props
    get page() { return this._page; }

    get src() { return this.page.src; }
    get srcAbsolute() { return this.page.srcAbsolute; }

    get label() { return this.page.label; }
    set label(value) { this.page.label = value; }

    get icon() { return this.page.icon; }
    set icon(value) { this.page.icon = value; }

    get result() { return this.page.result; }
    set result(value) { this.page.result = value; }

    get refs() {
        if (!this._refs) {
            this._refs = new Proxy(this._page, {
                get: (target, prop) => {
                  return target.querySelector(`[ref="${prop}"]`);
                }
            });
        }
        return this._refs;
    }

    //mehods
    async init(doc, container) {
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
        //call load command
        await this.onCommand("load");
        //set status
        this._status = "loaded";
    }
    async onCommand(command, args) {
    }
    error({code, message, src, stack}) {
        this.page.error(code, message, src, stack);
    }
    replace(src) {
        this.page.replace(src);
    }
    close(result) {
        return this.page.close(result);
    }
    async unload() {
        this._binds.clear();
        await this.onCommand("unload");
        this._status = "unloaded";
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

    //rpc methods
    async rpc(mehod, args) {
    }
    
}


//export 
export default PageInstance;