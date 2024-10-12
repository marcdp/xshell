import loader from "./loader.js";

// class
class UI {


    //vars
    _config = {
        layouts: {
            app: {
                main:""
            },
            page: {
                main: "",
                stack: "",
                dialog: "",
                default: "",    
            }
        },
        styleSheets: []
    };

    //ctor
    constructor() {
    }

    //props
    get config() {return this._config;}
    
    //methods
    async init(config) { 
        this._config = config;
    }
    async start() { 
        var tasks = [];
        //load layouts
        for(let layoutKey in this._config.layouts) {
            let layoutValue = this._config.layouts[layoutKey]; 
            for(var layoutSubkey in layoutValue) {
                let layoutSubvalue = layoutValue[layoutSubkey];
                let task = loader.load("layout:" + layoutSubvalue);
                tasks.push(task);
            }
        }
        //load style sheets
        for(var item of this._config.styleSheets) {
            tasks.push(this.addStyleSheet(item.src));
        }
        //return
        return Promise.all(tasks);
    }
    

    //methods
    async addStyleSheet(src) { 
        let resolve = null;
        let link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", src);
        link.addEventListener("load", ()=>{
            resolve();
        });
        document.head.appendChild(link);
        return new Promise((resolv)=>{
            resolve = resolv;
        });
    }

};


//export
export default new UI();