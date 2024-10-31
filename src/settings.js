
// class
class Settings {


    //vars
    _config = {
        prefix: ""
    };

    //ctor
    constructor() {
    }

    //props
    get config() {return this._config;}

    //methods
    get(key, defaultValue = null) {
        let value = localStorage.getItem(this._config.prefix + key);
        if (typeof(value) == "undefined") value = defaultValue;
        return value;
    }
    set(key, value) {
        localStorage.setItem(this._config.prefix + key, value);
        this.persist(key);
    }
    remove(key) {
        localStorage.removeItem(this._config.prefix + key);
        this.persist(key);
    }
    clear(){
        localStorage.clear();
        this.persist();
    }
    persist(key = null){
        //todo ....
    }
    

};


//export
export default new Settings();