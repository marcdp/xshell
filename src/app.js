
// class
class App {

    //vars
    _config =  {
        name:       "",
        title:      "",
        version:    "",
        base:       "/",
        copyright:  "",
        logo:       ""
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
export default new App();