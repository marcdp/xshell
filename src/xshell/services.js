
// class
export default class Services {

    // vars
    _cache = new Map();

    // ctor
    constructor() {
    }

    //methods
    register(name, service) {
        this._cache.set(name, service);
    }
    createProvider(callback) {
        let target = {};
        return new Proxy(target, {
            get: (obj, prop) => {
                let result = this._cache.get(prop);
                if (result == undefined) result = callback(prop);
                if (result == undefined) throw new Error(`Service not found: ${prop}`);
                return result;
            }
        });
    }

};


