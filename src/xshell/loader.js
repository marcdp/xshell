import resolver from "./resolver.js";
import config from "./config.js";

// LoaderException
class LoaderException extends Error {
    constructor(message, details) {
        super(message); // Call the parent constructor (Error)
        this.name = this.constructor.name; // Set the error name
        this.errors = details; // Custom property for additional info
        this.stack = (new Error()).stack; // Optional: keep the stack trace
    }
}

// loaders
const loaders = {
};

// class
class Loader {

    //vars
    _cache = {};

    //ctor
    constructor() {
    }

    //methods
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
            // resolve definition
            let name = resource.split(":")[1];
            let definitionObject = resolver.resolve(resource);
            if (!definitionObject) {
                throw new LoaderException(`Resource not found: ${resource}`);
            }
            var {definition, src} = definitionObject;
            // get or load handler
            let loader = loaders[definition.loader];
            if (!loader) {
                let appBase = config.get("app.base");
                let loaderUrl = (definition.loader.startsWith("/") ? appBase : "") + definition.loader;
                let loaderToUse = (await import(loaderUrl)).default;
                loaders[definition.loader] = loaderToUse;
                loader = loaderToUse;
            }
            // check cache
            let cacheItem = this._cache[resource];
            if (cacheItem) {
                if (cacheItem.promise) {
                    tasks.push(cacheItem.promise);
                    result.push(null);
                } else {
                    result.push(cacheItem.value);
                }
            } else if (loader == loaders.component && window.customElements.get(name)) {
                result.push(window.customElements.get(name));
            } else {
                // load
                console.log(`loader: load '${resource}' from ${src} ...`);
                let promise = loader.load(src, name, definition);
                if (definition.cache) {
                    this._cache[resource] = {
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
                    let value = taskResult.value;
                    if (value.cloneNode) {
                        value = value.cloneNode(true);
                    }
                    result[i] = value;
                } else if (taskResult.status === 'rejected') {
                    errors.push(taskResult.reason);
                }
            }
        }
        //throw exception if errors
        if (isString) {
            if (errors.length) {
                throw errors[0];
            }
            result = result[0];
        } else {
            if (errors.length) {
                throw new LoaderException("Error loading resources", errors);
            }
        }
        //return
        return result;
    }    
};


//export
export default new Loader();