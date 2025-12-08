import utils from "./utils.js";

// class
class Resolver {


    //vars
    _definitions = [];
    

    //ctor
    constructor() {
    }


    //methods
    addDefinition(key, src) {
        let type = key.split(":")[0];
        let pattern = key.split(":")[1];
        let resource = type + ":" + pattern;
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
            regexp: new RegExp(regexp)
        };
        definition.regexp = new RegExp(regexp);
        this._definitions.push(definition);
    }
    resolveDefinition(resource) {        
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
        console.error(`resolver.resolveDefinition('${resource}'): unable to resolve`);
        return null;
    }
    resolve(resource) {
        let result = this.resolveDefinition(resource);
        if (result) return result.src;
        return null;
    }
    virtualToRealUrl(url) {
        let result = document.location.pathname + url;
        return result.replaceAll("//", "/");
    }
};


//export
export default new Resolver();