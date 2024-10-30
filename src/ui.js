import loader from "./loader.js";

// class
class UI {


    //vars
    _config = {
        defaults:{
            pageHandler: "",
            errorHandler: "",
            pageLoading:"x-page-loading"
        },
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
        let tasks = [];
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
    createElementsFromObject(list, settings = {}, level = 0) {
        let result = [];
        if (!settings.defaults) settings.defaults = {};
        if (!settings.defaults.tag) settings.defaults.tag = "x-menu-item";
        let defaults = settings.defaults;
        let defaultsByLevel = settings.defaults["level" + level] || {};
        for(let item of list) {
            //tag
            let tag = item.tag || defaultsByLevel.tag || defaults.tag;
            //create node
            let keys = [];
            let node = document.createElement(tag);
            for(let key in item) {
                if (key != "tag" && key != "children") {
                    node.setAttribute(key, item[key]);
                }
                keys.push(key);
            }
            //defaultsByLevel
            for(let key in defaultsByLevel.attributes) {
                let value = defaultsByLevel.attributes[key];
                if (keys.indexOf(key) == -1){
                    node.setAttribute(key, value);
                    keys.push(key);
                }                
            }
            //defaults
            for(let key in defaults.attributes) {
                let value = defaults.attributes[key];
                if (keys.indexOf(key) == -1){
                    node.setAttribute(key, value);
                    keys.push(key);
                }
            }            
            //children
            if (item.children) {
                let container = node;
                let childWrapper = defaultsByLevel.childWrapper || defaults.childWrapper;
                if (childWrapper) {
                    let aux = document.createElement(childWrapper);
                    container.appendChild(aux);
                    container = aux;
                }
                for (let subMenuitem of this.createElementsFromObject(item.children, settings, level + 1)){
                    container.appendChild(subMenuitem);
                }
            }
            //push
            result.push(node);
        }
        return result;
    }

};


//export
export default new UI();