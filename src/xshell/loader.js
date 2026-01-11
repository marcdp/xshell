
// LoaderException
class LoaderException extends Error {
    constructor(message, details) {
        debugger;
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
export default class Loader {

    //vars
    _bus = null;
    _config = null;
    _debug = null;
    _resolver = null;

    _cache = {};
    _registry = [];

    //ctor
    constructor( {bus, config, debug, resolver} ) {
        this._bus = bus;
        this._config = config;
        this._debug = debug;
        this._resolver = resolver;
    }

    //props
    get registry() { 
        let result = [];
        for(let item of this._registry){
            result.push({ resource: item.resource, src: item.src, status: item.status });
        }
        return Object.freeze(result);
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
            let definitionObject = this._resolver.resolve(resource);
            if (!definitionObject) {
                throw new LoaderException(`Resource not found: ${resource}`);
            }
            let {definition, src} = definitionObject;
            // get or load handler
            let loader = loaders[definition.loader];
            if (!loader) {
                let appBase = this._config.get("app.base");
                let assetsPrefix = this._config.get("xshell.assetsPrefix");
                let loaderUrl = definition.loader;
                if (loaderUrl.indexOf(":")!=-1) {
                    loaderUrl = definition.loader;
                } else if (loaderUrl.indexOf("/")!=-1) {
                    loaderUrl = appBase + definition.loader;
                } else {
                    loaderUrl = appBase + "/" + assetsPrefix + "/xshell/loaders/" + definition.loader + ".js";
                }
                let loaderToUse = new (await import(loaderUrl)).default();
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
                this._debug.log(`loader: load '${resource}' from ${src} ...`);
                let promise = (async () => {
                    let value = null;
                    let registryItem = {resource, definition, src, status: "pending"};
                    this._registry.push(registryItem);
                    
                    await this._bus.emit("xshell:loader:resource:fetch", {resource, src});
                    try {
                        value = await loader.load(src, name, definition);
                        registryItem.status = "loaded";
                        await this._bus.emit("xshell:loader:resource:loaded", {resource, src});
                    } catch (e) {
                        registryItem.status = "error";
                        await this._bus.emit("xshell:loader:resource:error", {resource, src});
                        throw e;
                    }                    
                    return value;
                })();
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
                    } else if (value.clone) {
                        value = value.clone();
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

    // private methods
    _dispatchEvent(name, detail) {

    }
};

