
// class
class Modules {


    //fields
    _config = {};
    _instances = [];


    //ctor
    constructor() {
    }


    //props
    get config() {return this._config;}


    //methods
    async init(config, xshell) {
        this._config = config;
        Object.freeze(this._config);
        let tasks = [];
        //load modules
        for(let definition of this._config) {
            let module = definition.module;
            if (typeof(module) == "string") {
                let url = module;
                tasks.push((async()=>{
                    let module = (await import(url));
                    let instance = new module.default();
                    instance.init(definition.args, xshell);
                    this._instances.push(instance);
                })());    
            }
        }
        await Promise.all(tasks);
    } 
    async start() {
        let tasks = [];
        for(let instance of this._instances){
            tasks.push(await instance.start());
        }
        await Promise.all(tasks);
    } 

};


//export
export default new Modules();