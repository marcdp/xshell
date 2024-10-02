
// class
class Bus  {

    //vars
    _config = {
        debug: true
    };

    //props
    get config() {return this._config;}

    //methods
    async init(config) {
        this._config = config;
    }
    

    
};


//export
export default new Bus();