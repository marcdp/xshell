
// class
class UI {


    //vars
    _config = {
        layouts: {
            default: "",
            stack: "",
            dialog: "",
            embed: "",
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
        for(var url of this._config.styleSheets) {
            tasks.push(this.addStyleSheet(url));
        }
        return Promise.all(tasks);
    }
    

    //methods
    async addStyleSheet(url) { 
        let resolve = null;
        let link = document.createElement("link");
        link.setAttribute("rel", "stylesheet");
        link.setAttribute("href", url);
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