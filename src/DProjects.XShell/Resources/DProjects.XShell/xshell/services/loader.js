
// Exceptions
class ResourceError extends Error {
    constructor(resource, message, opts = {}) {
        super(message, { cause: opts.cause });
        this.name = this.constructor.name;
        this.resource = resource;
        this.path = opts.path;
        this.url = opts.url;
        this.code = opts.code;
        this.details = opts.details;
    }
} 


// loaders
const loaders = {
};


// class
export default class Loader {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
            appBasePath: { type: "string" },
            xshellAssetsPath: { type: "string" },
            componentLazy: { type: "string" }
        },
        additionalProperties: false
    }

    // vars
    #bus = null;
    #options = null;
    #resolver = null;
    #services = null;
    
    #cache = {};
    #registry = [];

    // ctor
    constructor( {bus, resolver, services}, options ) {
        this.#bus = bus;
        this.#resolver = resolver;
        this.#services = services;
        this.#options = options;
    }

    // props
    get registry() { 
        // project load metadata without exposing the loaded value or mutable records
        return Object.freeze(this.#registry.map(item => Object.freeze({
            resource: item.resource, 
            url: item.url, 
            path: item.path, 
            status: item.status, 
            time: item.time, 
            moduleId: item.moduleId,
            description: item.description || ""
        })));
    }

    // methods
    async load(resources) {
        const resourcesOriginal = resources;
        const isString = typeof(resources) == "string";
        if (resources == undefined) return null;
        if (resources == "" ) return null;
        if (typeof(resources) == "string") resources = [resources];
        const isArray = Array.isArray(resources);
        const isObject = typeof(resources) == "object" && !isArray;
        if (isObject) resources = Object.values(resources);

        // Resolve global resources and materialize them through the shared loading path.
        let result = await this.#loadResources(resources, resource => this.#resolver.resolve(resource));
        if (isString) {
            result = result[0];
        } else if (isObject) {
            result = Object.fromEntries(Object.keys(resourcesOriginal).map((key, index) => [key, result[index]]));
        }
        return result;
    }
    // private methods
    async #loadResources(resources, resolve) {
        // Materialize resources while preserving Loader cache, diagnostics, events, timing, and error behavior.
        let result = [];
        let urls = [];
        let paths = [];
        let tasks = [];
        for(let resource of resources) {            
            // resolve definition
            let name = resource.split(":")[1];
            let definitionObject = resolve(resource);
            if (!definitionObject) {
                throw new ResourceError(resource, `Resource not found: ${resource}`, { code: "RESOURCE_NOT_FOUND" });
            }
            let {definition, url, path} = definitionObject;
            const cacheKey = this.#getCacheKey(resource, definition);
            urls.push(url);
            paths.push(path);
            //if (url.indexOf("x-page") != -1) debugger;
            // get or load handler
            let loader = loaders[definition.loader];
            if (!loader) {                
                let loaderUrl = definition.loader;
                if (loaderUrl.indexOf(":")!=-1) {
                    loaderUrl = definition.loader;
                } else if (loaderUrl.indexOf("/")!=-1) {
                    loaderUrl = this.#options.appBasePath + definition.loader;
                } else {
                    loaderUrl = this.#options.appBasePath + this.#options.xshellAssetsPath + "/loaders/" + definition.loader + ".js";
                }
                let loaderToUse = new (await import(loaderUrl)).default();
                loaders[definition.loader] = loaderToUse;
                loader = loaderToUse;
            }
            // check cache
            let cacheItem = this.#cache[cacheKey];
            if (cacheItem) {
                tasks.push({index: result.length, promise: cacheItem.promise ?? Promise.resolve(cacheItem.value)});
                result.push(null);
            } else if (loader == loaders["component-js"] && window.customElements.get(name)) {
                result.push(window.customElements.get(name));
            } else {
                // load
                //console.log(`loader: load '${resource}' from ${url} ...`);
                let promise = (async () => {
                    let value = null;
                    let registryItem = {resource, 
                        definition, 
                        url,
                        path,
                        status: "pending", 
                        time: null, 
                        moduleId: definition.moduleId};
                    this.#registry.push(registryItem);
                    this.#bus.emit("xshell:loader:resource:fetch", {resource, url, path, moduleId: definition.moduleId});
                    const context = {
                        resource: resource,
                        resourceName: name,
                        resourcePath: path,
                        resourceDefinition: definition,
                        appBasePath: this.#options.appBasePath,
                        componentLazy: this.#options.componentLazy,
                        services: this.#services
                    };
                    const start = performance.now();
                    try {
                        value = await loader.load(url, context);
                        const end = performance.now();
                        const time = end - start;
                        registryItem.status = "loaded";
                        registryItem.time = time;
                        registryItem.value = value;
                        // retain only descriptive text needed for component and page inspection
                        if (resource.startsWith("component:") || resource.startsWith("page:")) {
                            const description = value?.contract?.description;
                            registryItem.description = typeof description === "string" ? description : "";
                        }
                        this.#bus.emit("xshell:loader:resource:loaded", {resource, url, path, time});
                    } catch (exception) {
                        const end = performance.now();
                        const time = end - start;
                        registryItem.time = time;
                        registryItem.status = "error";
                        this.#bus.emit("xshell:loader:resource:error", {resource, url, path, time, code: exception.code, message: exception.message, details: exception.details});
                        throw exception;
                    }
                    return value;
                })();
                if (definition.cache) {
                    // initialize cache item for this resource
                    cacheItem = {
                        value: null,
                        promise: null
                    };
                    cacheItem.promise = promise.then(value => {
                        if (this.#cache[cacheKey] === cacheItem) {
                            cacheItem.value = value;
                            cacheItem.promise = null;
                        }
                        return value;
                    }, exception => {
                        if (this.#cache[cacheKey] === cacheItem) {
                            delete this.#cache[cacheKey];
                        }
                        throw exception;
                    });
                    this.#cache[cacheKey] = cacheItem;
                    promise = cacheItem.promise;
                }
                tasks.push({index: result.length, promise});
                result.push(null);
            }            
        }
        //wait until all resources have been settled
        const taskResults = await Promise.allSettled(tasks.map(task => task.promise));
        // process result
        let errors = [];
        for(let i = 0 ; i < taskResults.length; i++) {
            let taskResult = taskResults[i];
            let resultIndex = tasks[i].index;
            if (taskResult != null) {
                if (taskResult.status === 'fulfilled') {
                    let value = taskResult.value;
                    if (value.cloneNode) {
                        value = value.cloneNode(true);
                    } else if (value.clone) {
                        value = value.clone();
                    }
                    result[resultIndex] = value;
                } else if (taskResult.status === 'rejected') {
                    const exception = taskResult.reason instanceof Error ? taskResult.reason : new Error(String(taskResult.reason));
                    const error = new ResourceError(
                        resources[resultIndex],
                        exception.message, 
                        {
                            code: exception.code ?? 500,
                            url: urls[resultIndex],
                            path: paths[resultIndex],
                            cause: exception,
                            details: exception.details
                        }
                    );
                    errors.push(error);
                }
            }
        }
        // throw exception if errors
        if (errors.length) {
            if (errors.length === 1) {
                throw errors[0];
            } else {
                let message = errors.map(error => error.message + " (" + error.code + ")").join("; ");
                throw new AggregateError(errors, message);
            }
        }
        return result;
    }
    #removeQuery(resource) {
        // remove only the URL query while preserving the logical resource scheme and fragment
        const queryIndex = resource.indexOf("?");
        const fragmentIndex = resource.indexOf("#");
        if (queryIndex === -1 || (fragmentIndex !== -1 && queryIndex > fragmentIndex)) {
            return resource;
        }
        return resource.substring(0, queryIndex) + (fragmentIndex === -1 ? "" : resource.substring(fragmentIndex));
    }
    #getCacheKey(resource, definition) {
        // select cache identity without changing the resource passed through resolution and loading
        const cacheMode = definition.cacheMode ?? "full";
        switch (cacheMode) {
            case "full":
                return resource;
            case "path":
                return this.#removeQuery(resource);
            default:
                throw new Error(`Unsupported cache mode '${cacheMode}'.`);
        }
    }
};

