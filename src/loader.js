import config from "./config.js";

// defaults
const DEFAULTS = {
    icon: {
        transform: "svg"
    },
    page: {
        transform: "response",
        cache: false
    }
};

// LoaderException
class LoaderException extends Error {
    constructor(message, details) {
        super(message); // Call the parent constructor (Error)
        this.name = this.constructor.name; // Set the error name
        this.errors = details; // Custom property for additional info
        this.stack = (new Error()).stack; // Optional: keep the stack trace
    }
}

// class
class Loader {


    //vars
    _definitions = [];
    _cache = {};
    _transforms = {
        "arrayBuffer": async (response) => {
            //return response as arrayBuffer
            return await response.arrayBuffer();
        },
        "blob": async (response) => {
            //return response as blob
            return await response.blob();
        },
        "bytes": async (response) => {
            //return response as bytes
            return await response.bytes();
        },
        "css": async (response) => {
            //return response as css styleSheet
            let css = await response.text();
            let styleSheet = new CSSStyleSheet();
            styleSheet.replaceSync(css);
            return styleSheet;
        },
        "template": async (response) => {
            //return response as template
            let html = await response.text();
            let template = document.createElement("template");
            template.innerHTML = html;
            return template;
        },
        "string": async (response) => {
            //return response as string
            return await response.text();
        },
        "json": async (response) => {
            //return response to object
            return await response.json();
        },
        "svg": async (response) => {
            //return response to SVG element
            let text = await response.text();
            let div = document.createElement("div");
            div.innerHTML = text;
            return div.firstChild;
        },
        "response": async (response) => {
            //return response
            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: await response.text(),
                text() { return this.data; },
            };
        }
    };


    //ctor
    constructor() {
        //add config event -> listen for changes
        config.addEventListener("loader", () => {
            let definitions = [];
            let keys = config.getSubKeys("loader");            
            for (let key of keys) {
                let type = key.split(":")[0];
                let pattern = key.split(":")[1];
                let resource = type + ":" + pattern;
                let src = config.get("loader." + type + ":" + pattern);
                let defaults = DEFAULTS[type] || {};
                let transform = config.get("loader." + type + ":" + pattern + ".transform", (defaults.transform ?? ""));
                let regexp = "";
                let cache = config.get("loader." + type + ":" + pattern + ".cache", (defaults.cache ?? true));
                let k = 0;
                let i = resource.indexOf("{"), j = resource.indexOf("}");
                while (i != -1) {
                    regexp += resource.substring(k, i);
                    regexp += "(?<" + resource.substring(i + 1, j) + ">.+)";
                    k = j + 1;
                    i = resource.indexOf("{", j), j = resource.indexOf("}", i);
                }
                regexp += resource.substring(k);
                let definition = {
                    resource,
                    src,
                    transform,
                    regexp: new RegExp(regexp),
                    cache
                };
                definition.regexp = new RegExp(regexp);
                definitions.push(definition);
            }
            this._definitions = definitions;
        });
    }


    //props
    get config() { return this._config; }


    //methods
    register(resource, value) {
        this._cache[resource] = value;
    }
    resolve(resource) {        
        //if (resource.indexOf("/") != -1) {
        //    let type = resource.split(":")[0];
        //    let src = resource.split(":")[1];
        //    let defaults = DEFAULTS[type] || {};
        //    return { definition: { transform: defaults.transform}, src };
        //}
        for(let i = this._definitions.length - 1; i >= 0; i--) {
            let mapitem = this._definitions[i];
            let match = resource.match(mapitem.regexp);
            if (match) {
                let src = mapitem.src;
                for(var key in match.groups) {
                    src = src.replaceAll("{" + key + "}", match.groups[key]);
                }
                return { definition: mapitem, src };
            }
        }
        console.error(`loader.resolve('${resource}'): unable to resolve`);
        return null;
    }
    resolveSrc(resource) {
        let result = this.resolve(resource);
        if (result) return result.src;
        return null;
    }
    async load(resources) {
        let isString = typeof(resources) == "string";
        if (resources == undefined) return null;
        if (resources == "" ) return null;
        if (resources == [""] ) return null;;
        if (typeof(resources) == "string") resources = [resources];
        //load resources
        let result = [];
        let tasks = [];
        for(let resource of resources) {            
            let scheme = resource.substring(0, resource.indexOf(":"));
            let name = resource.substring(resource.indexOf(":") + 1);
            let { definition, src } = this.resolve(resource);
            let cacheItem = this._cache[resource];
            if (cacheItem) {
                if (cacheItem.then) {
                    tasks.push(cacheItem);
                    result.push(null);
                } else {
                    result.push(cacheItem);
                }
            } else if (!definition.transform && window.customElements.get(name)) {
                let customElement = window.customElements.get(name);
                this._cache[scheme + ":" + name] = customElement;
                result.push(customElement);
            } else {
                console.log(`loader.load('${resource}') ... ${src}`);
                let promise = this.loadDefinition(resource, definition, src);
                if (definition.cache) {
                    this.register(resource, promise);
                }
                tasks.push(promise);
                result.push(null);
            }
            
        }
        //wait until all resources have been settled
        const taskResults = await Promise.allSettled(tasks);
        // process result
        let errors = [];
        for(let i = 0 ; i < taskResults.length; i++) {
            let taskResult = taskResults[i];
            if (taskResult != null) {
                if (taskResult.status === 'fulfilled') {
                    result[i] = taskResult.value;
                } else if (taskResult.status === 'rejected') {
                    errors.push(taskResult.reason);
                }
            }
        }
        // throw exception if required
        if (errors.length) {
            throw new LoaderException("Error loading resources", errors);
        }
        //if single result
        if (isString) return result[0];
        //return
        return result;
    }    
    async loadDefinition(resource, definition, src){
        let value = null;
        //fetch/import
        if(definition.transform) {
            value = await fetch(src);
        } else {
            value = await import(src);
        }
        //transform
        if (definition.transform) {
            let transform = this._transforms[definition.transform];
            if (!transform) throw new LoaderException("Unknown transform: " + definition.transform, { resource, definition, src });
            value = await transform(value, src, this);
        } else {
            value = value.default;
        }
        //set
        if (definition.cache) {
            this.register(resource, value);
        }
        //return
        return value;
    }
};


//export
export default new Loader();