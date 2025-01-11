
// LoaderException
class LoaderException extends Error {
    constructor(message, details) {
        super(message); // Call the parent constructor (Error)
        this.name = this.constructor.name; // Set the error name
        this.errors = details; // Custom property for additional info
        this.stack = (new Error()).stack; // Optional: keep the stack trace
    }
}

// Defaults
const DEFAULTS = {
    "layout": {
        handler: "import",
        webComponent: true,
        cache: true
    },
    "component": {
        handler: "import",
        webComponent: true,
        cache: true
    },
    "page-handler": {
        handler: "import",
        cache: true
    },
    "icon": {
        handler: "fetch-svg",
        cache: true
    },
    "page": {
        handler: "fetch-page",
        cache: false
    },
    "file": {
        handler: "fetch"
    }
};

// Handlers
let Handlers = {
    "fetch": async (resource, definition, src, stats) => {
        let response = await fetch(src);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}: ${src}`);
        stats.loadSize = parseInt(response.headers.get("content-length"));
        return response;
    },
    "import": async (resource, definition, src, stats) => {
        let module = await import(src);
        stats.loadSize = -1;
        return module.default;
    },
    "fetch-svg": async (resource, definition, src, stats) => {
        let response = await fetch(src);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}: ${src}`);
        stats.loadSize = parseInt(response.headers.get("content-length"));
        let text = await response.text();
        let div = document.createElement("div");
        div.innerHTML = text;
        let svg = div.firstChild;
        return svg;
    },
    "fetch-page": async (resource, definition, src, stats) => {
        let response = await fetch(src);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}: ${src}`);
        stats.loadSize = parseInt(response.headers.get("content-length"));
        let html = await response.text();
        if (html.indexOf("<html")==-1) html = `<!DOCTYPE html><html><head></head><body>${html}</body></html>`;
        return html;
    },
    "fetch-page-markdown": async (resource, definition, src, stats) => {        
        let path = "file:" + resource.substring(resource.indexOf(":") + 1);
        let result = `<!DOCTYPE html><html><head></head><body><meta name='page-handler' content=''><x-markdown src="${path}" ></x-markdown></body></html>`
        stats.loadSize = result.length;
        return result;
    },
    "fetch-page-pdf": async (resource, definition, src, stats) => {        
        let result = `<!DOCTYPE html><html><head></head><body><meta name='page-handler' content=''><x-fill><iframe src="${src}" style="border:none;flex:1"></iframe></x-fill></body></html>`;
        stats.loadSize = result.length;
        return result;
    }
};

// class
class Loader {


    //vars
    _definitions = [];
    _cache = {};
    _listeners = [];
    

    //ctor
    constructor() {
    }


    //methods
    dispatchEvent(name, args) {
        for(let listener of this._listeners){
            if (listener.name == name){
                listener.callback(args);
            }
        }
    }
    addEventListener(name, callback) {
        this._listeners.push({ name, callback });
    }
    removeEventListener(name, callback) {
        let index = 0;
        for(let listener of this._listeners){
            if (listener.name == name && listener.callback == callback){
                this._listeners.splice(index, 1);
                break;
            }
            index++;
        }
    }
    addDefinition(key, src) {
        let type = key.split(":")[0];
        let pattern = key.split(":")[1];
        let resource = type + ":" + pattern;
        let srcPath = (src.indexOf("?") != -1 ? src.substring(0, src.indexOf("?")) : src)
        let searchParams = new URLSearchParams(src.indexOf("?") != -1 ? src.substring(src.indexOf("?") + 1) : "");
        let defaults = DEFAULTS[type] || {};
        let handler = defaults.handler || "fetch";
        let webComponent = (typeof(defaults.webComponent) == "undefined" ? false : defaults.webComponent);
        let cache = (typeof(defaults.cache) == "undefined" ? false : defaults.cache);
        for(let key of searchParams.keys()) {
            if (key.startsWith("loader-")) {
                if (key == "loader-handler") handler = searchParams.get(key);
                if (key == "loader-cache") cache = (searchParams.get(key) == "true");
                searchParams.delete(key);
            }
        }
        src = srcPath + (searchParams.keys().length ? searchParams.toString() : "");
        //regexp
        let regexp = "^";
        let k = 0;
        let i = resource.indexOf("{"), j = resource.indexOf("}");
        while (i != -1) {
            regexp += resource.substring(k, i);
            regexp += "(?<" + resource.substring(i + 1, j) + ">.+)";
            k = j + 1;
            i = resource.indexOf("{", j), j = resource.indexOf("}", i);
        }
        regexp += resource.substring(k);
        //add definition
        let definition = {
            resource,
            src,
            handler,
            cache,
            webComponent,
            regexp: new RegExp(regexp)
        };
        definition.regexp = new RegExp(regexp);
        this._definitions.push(definition);
    }
    resolve(resource) {        
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
    async load(resources, stats) {
        let isString = typeof(resources) == "string";
        if (resources == undefined) return null;
        if (resources == "" ) return null;
        if (resources == [""] ) return null;;
        if (typeof(resources) == "string") resources = [resources];
        if (!stats) stats = {};
        stats.loadBegin = performance.now();
        stats.loadSize = 0;
        //load resources
        let result = [];
        let tasks = [];
        for(let resource of resources) {            
            //let scheme = resource.substring(0, resource.indexOf(":"));
            let name = resource.substring(resource.indexOf(":") + 1);
            let { definition, src } = this.resolve(resource);
            let cacheItem = this._cache[resource];
            if (cacheItem) {
                if (cacheItem.promise) {
                    tasks.push(cacheItem.promise);
                    result.push(null);
                } else {
                    stats.loadSize += cacheItem.stats.loadSize;
                    result.push(cacheItem.value);
                }
            } else if (definition.webComponent && window.customElements.get(name)) {
                result.push(window.customElements.get(name));
            } else {
                console.log(`loader.load('${resource}') ... ${src}`);
                let promise = this.loadFromDefinition(resource, definition, src);
                if (definition.cache) {
                    this._cache[resource] = {
                        stats: null,
                        value: null,
                        promise
                    };
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
                    let loadFromDefinitionResult = taskResult.value;
                    result[i] = loadFromDefinitionResult.value;
                    stats.loadSize += loadFromDefinitionResult.stats.loadSize;
                } else if (taskResult.status === 'rejected') {
                    errors.push(taskResult.reason);
                }
            }
        }
        //stats
        stats.loadEnd = performance.now();
        stats.loadTime = parseInt(stats.loadEnd - stats.loadBegin);
        //throw exception if errors
        if (isString) {
            if (errors.length) {
                throw errors[0];
            }
            result = result[0];
        } else {
            if (errors.length) throw new LoaderException("Error loading resources", errors);
        }
        //return
        return result;
    }    
    async loadFromDefinition(resource, definition, src){
        let value = null;
        //stats
        let stats = {
            loadBegin: performance.now(),
            loadEnd: null,
            loadTime: NaN,
            loadSize: 0
        };
        //handler
        let handler = Handlers[definition.handler];
        if (!handler) handler = await this.load("handler:" + definition.handler);
        if (!handler) throw new LoaderException("Unknown handler: " + definition.handler, { resource, definition, src });
        value = await handler(resource, definition, src, stats);
        //stats
        stats.loadEnd = performance.now();
        stats.loadTime = parseInt(stats.loadEnd - stats.loadBegin);
        //result
        let result = {
            stats, 
            value
        };
        //cache
        if (definition.cache) {
            this._cache[resource] = result;
        }
        //event
        this.dispatchEvent("load", {detail:{resource, definition, src, value, stats, status: "loaded"}});
        //return
        return result;
    }
};


//export
export default new Loader();