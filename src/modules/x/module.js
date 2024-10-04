
export default class {

    //vars
    _name = "x";
    _config = {};

    //ctor
    constructor() {       
    }

    //props
    get name() {return this._name;}
    get config() {return this._config;}

    //methods
    init(config, xshell) {
        this._config = config;
        //add config
        var base = import.meta.url.substring(0, import.meta.url.lastIndexOf("/"));
        xshell.addConfig({            
            loader: {
                map: {
                    "component:x":  base + "/components/{name}.js",
                    "layout:x":     base + "/layouts/{name}.js",
                    "page:x":       base + "/pages/{name}.html",
                    "icon:x":       base + "/icons/{name-unprefixed}.svg",
                }
            },
            ui: {
                errors: {
                    default:        "x-error"
                },
                layouts: {
                    app: {
                        main:    "x-layout-app-main",
                    },
                    page: {
                        main:       "x-layout-page-main",
                        stack:      "x-layout-page-stack",
                        dialog:     "x-layout-page-dialog",
                        default:     "x-layout-page-default",
                    }
                },
                styleSheets: [
                    base + "/css/index.css"
                ]
            }
        });
    } 
    async start() {
    }

}
