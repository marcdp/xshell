class I18n {

    //var
    _config = {
        lang: "en",
        langs: [
            { id: 'en', label: 'English'},
            { id: 'es', label: 'Spanish'},
            { id: 'fr', label: 'French' },
            { id: 'de', label: 'German' },
        ],
        strings: {
        }
    };
    _cache = {};
    
    //ctor
    constructor(){
    }

    //props
    get config() { return this._config; }

    //methods
    async init(config) { 
        this._config = config;
        Object.freeze(this._config);
    }
    getMainLangs() {
        let result = this._cache.mainLangs;
        if (!result) {
            result = this.config.langs.filter( (lang) => lang.main).map( (lang) => lang.id);
            this._cache.mainLangs = result;
        }
        return [...result];
        
    }
    getLang(id) {
        let result = this._cache[id];
        if (!result) {
            result = this.config.langs.filter( (lang) => lang.id == id)[0] || null;
            this._cache[id] = result;
        }
        return result;
    }
    translate(label) {
        var translations = this._strings[this.config.lang];
        if (!translations) return label;
        var result = translations[label];
        if (!result) return label;
        return result;    
    }
}

// export
export default new I18n();
