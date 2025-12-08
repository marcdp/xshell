import utils from "./utils.js";

// normalize urls
function normalizeUrls(key, obj, from, path) {
    if (typeof(obj) == "string") {
        if (obj.startsWith("./") || obj.startsWith("../") || obj == ".") {
            if (key == "href" && path) {
                //relative to path
                obj = utils.combineUrls(path + "/", obj);
            } else if (from) {
                //relative to from (module url)
                obj = utils.combineUrls(from, obj);
            }
        }
    } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = normalizeUrls(i, obj[i], from, path);
        }
    } else if (obj instanceof Object) {
        for (let subkey in obj) {
            obj[subkey] = normalizeUrls(subkey, obj[subkey], from, path);
        }    
    }
    return obj;
}

// class
class Config {

    //vars
    _config = {};
    _listeners = [];
    
    //ctor
    constructor() {
    }

    //props
    get config() { return this._config; }

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
    set(config, from, path) {
        normalizeUrls("", config, from, path);
        var keys = [];
        for (let key in config) {
            let value = config[key];
            this._config[key] = value;
            keys.push(key);
        }
        this.dispatchEvent("change");
    }
    has(key) {
        let result = this._config[key];
        if (typeof (result) != "undefined") return true;
        return false;
    }
    get(key, defaultValue) {
        let result = this._config[key];
        if (typeof (result) != "undefined") return result;
        if (typeof (defaultValue) == "undefined") {
            debugger;
            console.warn(`config.get('${key}') configuration key is undefined`);
        }
        return defaultValue;
    }
    getKeys(prefix) {
        let result = [];
        for (let key in this._config) {
            if (key.startsWith(prefix + ".")) {
                result.push(key);
            };
        }
        return result;
    }
    getSubKeys(prefix) {
        let result = [];
        for (let key in this._config) {
            if (key.startsWith(prefix + ".")) {
                let subKey = key.substring(prefix.length + 1).split(".")[0];
                if (result.indexOf(subKey)==-1) {
                    result.push(subKey);
                }
            };
        }
        return result;
    }
    getAsObject(prefix) {
        let result = {};
        for (let key in this._config) {
            if (key.startsWith(prefix + ".")) {
                result[key.substring(prefix.length + 1)] = this._config[key];
            }
        }
        return result;
    }
    getAsObjects(prefix) {
        let result = [];
        let subKeys = this.getSubKeys(prefix);
        for (let subKey of subKeys) {
            let value = {};
            for (let key in this._config) {
                let aux = prefix + "." + subKey;
                if (key == aux) {
                    value.name = this._config[key];
                } else if (key.startsWith(aux + ".")) {
                    value[key.substring(aux.length+1)] = this._config[key];
                }
            }
            result.push(value);
        }
        return result;
    }
    
};


//export
export default new Config();