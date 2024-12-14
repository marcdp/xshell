import config from "./config.js"

// defaults
const DEFAULTS = {
    icon: {
        transform: "svg"
    },
}

// class
class Loader {


    //vars
    _definitions = [];
    _cache = {};
    _transforms = {
        "arrayBuffer": async (response) => {
            return await response.arrayBuffer();
        },
        "blob": async (response) => {
            return await response.blob();
        },
        "bytes": async (response) => {
            return await response.bytes();
        },
        "css": async (response) => {
            let css = await module.text();
            let styleSheet = new CSSStyleSheet();
            styleSheet.replaceSync(css);
            return styleSheet;
        },
        "html": async (response) => {
            let html = await response.text();
            let template = document.createElement("template");
            template.innerHTML = html;
            return template;
        },
        "json": async (response) => {
            return await response.json();
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
        //add config event -> listen for changes
        config.subscribe("loader", () => {
            let definitions = [];
            let keys = config.getSubKeys("loader");            
            for (let key of keys) {
                let type = key.split(":")[0];
                let pattern = key.split(":")[1];
                let resource = type + ":" + pattern;
                let src = config.get("loader." + type + ":" + pattern);
                let defaults = DEFAULTS[type];
                let transform = config.get("loader." + type + ":" + pattern + ".transform", (defaults && defaults.transform) || "");
                let regexp = "";
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
                }
                definition.regexp = new RegExp(regexp);
                definitions.push(definition);
            }
            this._definitions = definitions;
        })
    }


    //props
    get config() { return this._config; }


    //methods
    register(resource, value) {
        this._cache[resource] = value;
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
    async load(resources) {
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
            } else if (!definition.transform && window.customElements.get(name)) {
                this._cache[scheme + ":" + name] = window.customElements.get(name);
            } else if (!cacheItem) {
                console.log(`  loader.load('${resource}') ... ${src}`);
                let promise = this.loadDefinition(resource, definition, src);
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
            value = await transform(value, src);
        } else {
            value = value.default;
        }
        //set
        this.register(resource, value);
    }
};


//export
export default new Loader();