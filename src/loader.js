import logger from "./logger.js";

// class
class Loader {

    //vars
    _config = {
        map:[],
    };
    _cacheMap = {};
    _cache = {};
    
    //ctor
    constructor() {
    }

    //props
    get config() {return this._config;}

    //methods
    async init(config) {
        this._config = config;
        //sort
        this._config.map.sort((a,b)=>{
            return a.resource.localeCompare(b.resource);
        });
        //cache map by: resource
        let cacheMap = {};
        this._config.map.reverse().forEach((definition)=>{
            cacheMap[definition.resource] = definition;
        });
        this._cacheMap = cacheMap;
    }

    //methods
    register(resource, value) {
        this._cache[resource] = value;
    }
    resolve(resource) {
        let scheme = resource.substring(0, resource.indexOf(":"));
        let name = resource.substring(resource.indexOf(":") + 1);
        let aux = resource;
        while (aux) {
            let definition = this._cacheMap[aux];
            if (definition) {
                let url = definition.url;
                if (url.indexOf("{name}")!=-1) url = url.replaceAll("{name}", name);
                if (url.indexOf("{name-unprefixed}")!=-1) url = url.replaceAll("{name-unprefixed}", name.substring(aux.length - scheme.length));
                return { definition, url };
            }
            let i = aux.lastIndexOf("-");
            if (i==0) break;
            aux = aux.substring(0, i);
        }
        logger.error(`loader.resolve('${resource}'): unable to resolve`);
        return null;
    }
    resolveUrl(resource) {
        let result = this.resolve(resource);
        if (result) return result.url;
        return null;
    }
    async load(resources, names) {
        if (names) {
            let aux = [];
            for(let name of names) {
                aux.push(resources + ":" + name);
            }
            resources=aux;
        }
        let isString = typeof(resources) == "string";
        if (resources == undefined) return null;
        if (resources == "" ) return null;
        if (resources == [""] ) return null;;
        if (typeof(resources) == "string") resources = [resources];
        let tasks = [];
        for(let resource of resources) {
            let scheme = resource.substring(0, resource.indexOf(":"));
            let name = resource.substring(resource.indexOf(":") + 1);
            let cacheItem = this._cache[resource];
            if (cacheItem && cacheItem.then){
                tasks.push(cacheItem);
            } else if (scheme == "component" && window.customElements.get(name)) {
                this._cache[scheme + ":" + name] = window.customElements.get(name);
            } else if (scheme == "layout" && window.customElements.get(name)) {
                this._cache[scheme + ":" + name] = window.customElements.get(name);
            } else if (!cacheItem) {
                let { definition , url} = this.resolve(resource);
                let promise = (async ()=> {
                    if ((scheme == "component" || scheme == "layout")) {
                        let module = await import(url);
                        this.register(resource, module.default);    
                    } else {
                        let value = await fetch(url);
                        if (value.ok) {
                            value = await value.text();
                            this.register(resource, value);
                        } else {
                            this.register(resource, null);
                        }
                    }
                })();
                this.register(resource, promise);
                tasks.push(promise);
            }
        }
        await Promise.all(tasks);        
        let result = [];
        for(let resource of resources) {
            result.push(this._cache[resource]);
        }
        if (isString) return result[0];
        return result;
    }
    
};


//export
export default new Loader();