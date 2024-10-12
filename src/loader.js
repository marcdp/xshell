import logger from "./logger.js";


// class
class Loader {

    //vars
    _config = {
        map:[
        ],
    };
    _cache = {};
    _typeConverters = {
        "css": async (module) => {
            let css = await module.text();
            let styleSheet = new CSSStyleSheet();
            styleSheet.replaceSync(css);
            return styleSheet;
        },
        "html": async (module) => {
            let html = await module.text();
            let template = document.createElement("template");
            template.innerHTML = html;
            return template;
        },
        "json": async (module) => {
            let json = await module.text();
            return JSON.parse(json);
        },
        "svg": async (response) => {
            let text = await response.text();
            let div = document.createElement("div");
            div.innerHTML = text;
            return div.firstChild;
        }
    };
    
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
        this._config.map.forEach((definition) => {
            // convert expressions like "component:x-{name}" to regular expressions like "component:x-(?<name>.+)"
            let regexp = "";
            let resource = definition.resource;
            let k = 0;
            let i = resource.indexOf("{"), j = resource.indexOf("}");
            while (i != -1) {
                regexp += resource.substring(k, i);
                regexp += "(?<" + resource.substring(i + 1, j) + ">.+)";
                k = j + 1;
                i = resource.indexOf("{", j), j = resource.indexOf("}", i);
            }
            regexp += resource.substring(k);
            definition.regexp = new RegExp(regexp);
        });
    }

    //methods
    register(resource, value) {
        this._cache[resource] = value;
    }
    resolve(resource) {
        for(let i = this._config.map.length - 1; i >= 0; i--) {
            let mapitem = this._config.map[i];
            let match = resource.match(mapitem.regexp);
            if (match) {
                let src = mapitem.src;
                for(var key in match.groups) {
                    src = src.replaceAll("{" + key + "}", match.groups[key]);
                }
                return { definition: mapitem, src };
            }
        }
        logger.error(`loader.resolve('${resource}'): unable to resolve`);
        return null;
    }
    resolveSrc(resource) {
        let result = this.resolve(resource);
        if (result) return result.src;
        return null;
    }
    async load(resources) {
        //prepare
        let isString = typeof(resources) == "string";
        if (resources == undefined) return null;
        if (resources == "" ) return null;
        if (resources == [""] ) return null;;
        if (typeof(resources) == "string") resources = [resources];
        //load resources
        let tasks = [];
        for(let resource of resources) {            
            let scheme = resource.substring(0, resource.indexOf(":"));
            let name = resource.substring(resource.indexOf(":") + 1);
            let { definition, src } = this.resolve(resource);
            let cacheItem = this._cache[resource];
            if (cacheItem && cacheItem.then){
                tasks.push(cacheItem);
            } else if (!definition.with && window.customElements.get(name)) {
                this._cache[scheme + ":" + name] = window.customElements.get(name);
            } else if (!cacheItem) {
                logger.log(`  loader.load('${resource}') ... ${src}`);
                let promise = (async ()=> {
                    let value = null;
                    //fetch/import
                    if(definition.with) {
                        value = await fetch(src);
                    } else {
                        value = await import(src);
                    }
                    //convert
                    if (definition.with && definition.with.type) {
                        let typeConverter = this._typeConverters[definition.with.type];
                        if (!typeConverter) {
                            typeConverter = (await this.load("type:" + definition.with.type)).default;
                            this._typeConverters[definition.with.type] = typeConverter;
                        }
                        value = await typeConverter(value, src);
                    }        
                    //set            
                    this.register(resource, value);
                })();
                this.register(resource, promise);
                tasks.push(promise);
            }
        }
        //wait until all resources have been loaded
        await Promise.all(tasks);        
        //return result
        let result = [];
        for(let resource of resources) {
            result.push(this._cache[resource]);
        }
        if (isString) return result[0];
        //return
        return result;
    }
    
};


//export
export default new Loader();