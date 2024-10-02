import logger from "./logger.js";

// class
class Loader {

    //vars
    _config = {
        preload:[],
        map:{}
    };
    _cache = {};

    //ctor
    constructor() {
    }

    //props
    get config() {return this._config;}

    //methods
    async init(config) {
        this._config = config;
    }

    //methods
    register(type, name, value) {
        this._cache[type + ":" + name] = value;
    }
    resolveUrl(type, name) {
        let url = this._config.map[type + ":" + name];
        if (url) return url;
        let aux = name;
        let i = name.lastIndexOf("-");
        while (i!=-1) {
            aux = aux.substring(0, i);
            url = this._config.map[type + ":" + aux];
            if (url) {
                let result = url;
                if (result.indexOf("{name}")!=-1) result = result.replace("{name}", name);
                if (result.indexOf("{name-unprefixed}")!=-1) result = result.replace("{name-unprefixed}", name.substring(aux.length + 1));
                return result;
            }
            i = aux.lastIndexOf("-");
        }
        logger.error(`loader.resolveUrl('${type}', '${name}'): unable to resolve url`);
        return null;
    }
    async load(type, nameOrNames) {
        let names = (typeof(nameOrNames) == "string" ? [nameOrNames] : nameOrNames);
        let tasks = [];
        for(let name of names) {
            let cacheItem = this._cache[type + ":" + name];
            if (cacheItem && cacheItem.then){
                tasks.push(cacheItem);
            } else if (type == "component" && window.customElements.get(name)) {
                this._cache[type + ":" + name] = window.customElements.get(name);
            } else if (type == "layout" && window.customElements.get(name)) {
                this._cache[type + ":" + name] = window.customElements.get(name);
            } else if (!cacheItem) {
                let url = this.resolveUrl(type, name);
                let promise = (async ()=> {
                    if (type == "component" || type == "layout") {
                        let module = await import(url);
                        this.register(type, name, module.default);    
                    } else {
                        let value = await fetch(url);
                        if (value.ok) {
                            if (type == "icon") value = await value.text();
                            this.register(type, name, value);
                        } else {
                            this.register(type, name, null);
                        }
                    }
                })();
                this.register(type, name, promise);
                tasks.push(promise);
            }
        }
        await Promise.all(tasks);        
        let result = [];
        for(let name of names) {
            result.push(this._cache[type + ":" + name]);
        }
        if (typeof(nameOrNames) == "string") {
            return result[0];
        }
        return result;
    }
    
};


//export
export default new Loader();