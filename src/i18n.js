class I18n {

    //var
    _config = {
        culture: "en",
        strings: {
        }
    }

    //ctor
    constructor(){
    }

    //props
    get config() {return this._config;}

    //methods
    async init(config) { 
        this._config = config;
        Object.freeze(this._config);
    }
    translate(label) {
        var result = this._config.strings[label];
        if (!result) result = label;
        return result;    
    }
}


// instance
let instance = new I18n();


// function
function i18n (label) {
    return instance.translate(label);
};
i18n.init = async function(config) {
    await instance.init(config);
};
Object.defineProperty(i18n, 'config', {
    get() {
        return instance.config;
    },
});


//export
export default i18n;
export { I18n };