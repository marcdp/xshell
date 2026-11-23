
//class
export default class I18n {

    // options schema
    static optionsSchema = {
        type: "object",
        required: ["lang", "langs", "datetime", "strings"],
        properties: {
            lang: {
                type: "string",
                minLength: 1,
                description: "Current application language."
            },
            langs: {
                type: "array",
                items: {
                    type: "object",
                    required: ["id", "label"],
                    properties: {
                        id: { type: "string", minLength: 1, description: "Language identifier used by Intl and translation dictionaries." },
                        label: { type: "string", description: "Human-readable language label." },
                        main: { type: "boolean", description: "Whether the language is included in the main application language set." }
                    },
                    additionalProperties: false,
                    description: "Language available to the application."
                },
                description: "Languages available to the application."
            },
            datetime: {
                type: "object",
                required: ["options", "formats"],
                properties: {
                    options: {
                        type: "object",
                        additionalProperties: true,
                        description: "Default Intl.DateTimeFormat options."
                    },
                    formats: {
                        type: "object",
                        additionalProperties: {
                            type: "object",
                            additionalProperties: true
                        },
                        description: "Named Intl.DateTimeFormat option sets."
                    }
                },
                additionalProperties: false,
                description: "Default and named date/time formatting options."
            },
            strings: {
                type: "object",
                additionalProperties: {
                    type: "object",
                    additionalProperties: { type: "string" }
                },
                description: "Translation dictionaries keyed by language id."
            }
        },
        additionalProperties: false,
        description: "Internationalization service configuration."
    };
    
    //var
    #config = {
        lang: "en",
        langs: [
            { id: 'en', label: 'English'},
            { id: 'es', label: 'Spanish'},
            { id: 'fr', label: 'French' },
            { id: 'de', label: 'German' },
        ],
        datetime: { 
            options: {
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            },
            formats: {
                time: {
                    timeStyle: "short",
                },
                date: {
                    dateStyle: "short",
                },
                datetime: {
                    timeStyle: "short",
                    dateStyle: "short",
                }
            }
        },
        strings: {
        }
    };
    #cache = {};
    
    //ctor
    constructor( {}, options ){
        this.#config = options;
    }

    //props
    get config() { 
        return this.#config;
    }

    //methods
    async init(config) { 
        this.#config = config;
        Object.freeze(this.#config);
    }
    getMainLangs() {
        let result = this.#cache.mainLangs;
        if (!result) {
            result = this.config.langs.filter( (lang) => lang.main).map( (lang) => lang.id);
            this.#cache.mainLangs = result;
        }
        return [...result];
        
    }
    getDefaultLang(){
        return this.config.lang;
    }
    getLang(id) {
        let result = this.#cache[id];
        if (!result) {
            result = this.config.langs.filter( (lang) => lang.id == id)[0] || null;
            this.#cache[id] = result;
        }
        return result;
    }
    getLangLabel(id) {
        let lang = this.getLang(id);
        return lang ? lang.label : id;
    }
    translate(label) {
        var translations = this.config.strings?.[this.config.lang];
        if (!translations) return label;
        return translations[label] ?? label;
    }
    formatText(value, lang) {
        if (!value) return "";
        var key = "i18n:" + (lang || this.config.lang) + "=";
        if (value.startsWith(key)) {
            let j = value.indexOf("|");
            return value.substring(key.length, j != -1 ? j : value.length).replaceAll("&#124;","|");
        } else {
            let k = value.indexOf("|" + key);
            if (k != -1) {
                let j = value.indexOf("|", k + 1);
                return value.substring(k + key.length + 1, j != -1 ? j : value.length).replaceAll("&#124;","|");
            }
        }
        return "";   
    }
    formatDateTime(datetime, format, opts) {
        if (datetime=="") return "";
        if (typeof(datetime) == "string") datetime = new Date(datetime);
        let lang = this.config.lang;
        let options = opts || {};
        if (format == "iso") {
            if (typeof(datetime) == "number") datetime = new Date(datetime);
            let result = 
                datetime.getUTCFullYear() + "-" +
                String(datetime.getUTCMonth() + 1).padStart(2, "0") + "-" +
                String(datetime.getUTCDate()).padStart(2, "0") + "T" +
                String(datetime.getUTCHours()).padStart(2, "0") + ":" +
                String(datetime.getUTCMinutes()).padStart(2, "0") + ":" +
                String(datetime.getUTCSeconds()).padStart(2, "0") + "." +
                String(datetime.getUTCMilliseconds()).padStart(3, "0") + "Z";
            return result;
        } else if (format) {
            options = Object.assign(options, this.#config.datetime.formats[format]);
            let dateTimeFormat = new Intl.DateTimeFormat(lang, options);
            return dateTimeFormat.format(datetime);
        } else {
            options = Object.assign(options, this.#config.datetime.options);
            let dateTimeFormat = new Intl.DateTimeFormat(lang, options);
            return dateTimeFormat.format(datetime);
        }        
    }   
    setLanguage(lang) {
        // TODO ...
        console.warn("Pending: Implement setLanguage. This will change the application's language. Currently, this is just a placeholder. No actual language change will occur.");
    }
}
