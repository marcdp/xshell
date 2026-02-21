import Page from "../page.js"
import Timer from "../timer.js"
import Events from "../events.js"
import xshell from "xshell";

// create page class from js definition
export async function createPageClassFromJsDefinition(src, context, definition) {
    // style
    const style = [];
    if (typeof(definition.style) == "string") {
        style.push(`<style>@scope (:scope) {${definition.style}}</style>`);
    } else if (Array.isArray(definition.style)) {
        for(let styleText of definition.style) {
            style.push(`<style>@scope (:scope) {${styleText}}</style>`);
        }
    }    
    // state skeleton
    let stateSkeleton = {};
    let stateQsNames = []
    let stateReflectedQsNames = []
    for(let propName in definition.state) {
        const propDefinition = definition.state[propName];
        if (typeof(propDefinition.value) == "undefined") propDefinition.value = null;
        if (typeof(propDefinition.type) == "undefined") propDefinition.type = "string";
        stateSkeleton[propName] = propDefinition.value; 
        if (propDefinition.qs === true) stateQsNames.push(propName);
        if (propDefinition.reflect) stateReflectedQsNames.push(propName);
    }
    // state engine
    const stateEngineXShell = xshell.config.get(`page.stateEngine`);
    const stateEngineModule = xshell.config.get(`modules.${context.resourceDefinition.module}.page.stateEngine`, stateEngineXShell);
    const stateEnginePage = definition.meta.stateEngine || stateEngineModule;
    const stateEngineFactoryCreator = await xshell.loader.load("state-engine:" + stateEnginePage);
    const stateEngineFactory = new stateEngineFactoryCreator(stateSkeleton, context);
    // render engine
    const renderEngineXShell = xshell.config.get(`page.renderEngine`);
    const renderEngineModule = xshell.config.get(`modules.${context.resourceDefinition.module}.page.renderEngine`, renderEngineXShell);
    const renderEnginePage = definition.meta.renderEngine || renderEngineModule;
    const renderEngineFactoryCreator = await xshell.loader.load("render-engine:" + renderEnginePage);
    const renderEngineFactory = new renderEngineFactoryCreator(definition.template + style.join(""), context);
    // render engine dependencies
    if (renderEngineFactory.dependencies.length) {
        await xshell.loader.load(renderEngineFactory.dependencies);
    }    
    // init 
    renderEngineFactory.init();
    // returns a class that extends base class Page
    return class extends Page {
        // vars
        _state = null;
        _renderEngine = null;
        _renderPending = false;
        _disposables = [];
        // ctor
        constructor({ src, context }) {
            super({ src, context });
            const self = this;
            // meta
            this._label = definition.meta.title || "";
            this._description = definition.meta.description || "";
            this._icon = definition.meta.icon || "";
            // state
            this._state = stateEngineFactory.create({
                stateChange(prop, oldValue, newValue) {
                    // state changed
                }, invalidate(path) {
                    // invalidate
                    self.invalidate(path);
                }
            });
            // stateQsNames
            if (stateQsNames.length) {
                var qs = new URLSearchParams(src.split("?")[1] || "");
                for(let propName of stateQsNames) {
                    if (qs.has(propName)) {
                        let value = qs.get(propName);
                        let oldValue = self._state[propName];
                        const propDefinition = definition.state[propName];
                        if (propDefinition.type == "boolean" || typeof(oldValue) == "boolean") {
                            self._state[propName] = (value == "true" || value == "1");
                        } else if (propDefinition.type == "number" || typeof(oldValue) == "number") {
                            if (value !== "" && isNaN(value) == false){
                                self._state[propName] = Number(value);
                            }
                        } else {
                            self._state[propName] = value;
                        }
                    }
                }
            }
            // services provider
            const servicesProvider = new Proxy({}, {
                get: (obj, prop) => {
                    if (prop == "definition") {
                        // page definition
                        return definition;
                    } else if (prop == "state") {
                        // state
                        return self._state;
                    } else if (prop == "context") {
                        // context
                        return self._context;
                    } else if (prop == "timer") {
                        // timer
                        const timer = new Timer( (command) => {self.onCommand(command);} );
                        self._disposables.push(timer);
                        return timer;
                    } else if (prop == "events") {
                        // events
                        const events = new Events( (command) => {self.onCommand(command);} );
                        self._disposables.push(events);
                        return events;
                    } else {
                        // resolve from services
                        return xshell.services.resolve(prop);                    
                    }
                }
            });            
            // set methods
            const methods = definition.script?.(servicesProvider) ?? {};
            // bind methods to the instance
            Object.assign(this, methods);
        }
        // mount/unmount
        async mount({ host }) {
            this._renderEngine = renderEngineFactory.create({ host, state: this._state, handler:(command, ...params) => {
                this.onCommand(command, ...params);
            }, invalidate: () => { 
                this.invalidate(); 
            } })
            this._renderEngine.mount();
            await super.mount({ host });
            this.invalidate();
        }
        async unmount() {
            await super.unmount();
            this._renderEngine.unmount();
            this._renderEngine = null;
            for(var disposable of this._disposables){
                disposable.dispose();
            }
            this._disposables = null;
        }
        // invalidate
        invalidate(path) {
            if (this._renderPending) return;
            this._renderPending = true;
            requestAnimationFrame(() => {
                this.onCommand("refresh");
                this._renderPending = false;
                this._renderEngine.render();
            });
        }
    };
}

//export 
export default class LoaderPageJs {
    async load(src, context) {
        // import
        const module = await import(src);
        let definition = module.default;
        // check if its a promise
        if (typeof(definition) === "object" && typeof(definition.then) === "function") {
            definition = await definition;
        }
        // check if its a class
        if (typeof(definition) === "function"  && /^class\s/.test(Function.prototype.toString.call(definition))) {
            return definition;
        }
        // else, asume its a definition object
        if (!definition.meta) definition.meta = {};
        definition = Object.seal(Object.freeze(definition));
        // create class definition
        return await createPageClassFromJsDefinition(src, context, definition);        
    }
};