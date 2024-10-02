
// class
class User {

    //vars
    _config = {
        id: "",
        username: "anonymous",
        authenticated: false,
        claims: {}
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
export default new User();