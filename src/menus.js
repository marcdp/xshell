
// class
class Menus {

    //vars
    _config = {
    };

    //ctor
    constructor() {
    }

    //props
    get config() {return this._config;}
    
    //methods
    async init(config) {
        this._config = config;
        Object.freeze(this._config);
    }

};


//export
export default new Menus();