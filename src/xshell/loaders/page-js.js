import Page from "../page.js"
import xshell from "xshell";

// create page class from js definition
export async function createPageClassFromJsDefinition(src, context, definition) {
    const resourcePath = context.resourcePath;
    const modulePath = context.resourceDefinition.modulePath;
    const appBase = context.appBase;
    const navigationMode = context.navigationMode;
    const navigationHashPrefix = context.navigationHashPrefix;
    // style
    /*
    const style = [];
    if (typeof(definition.style) == "string") {
        style.push(`<style>@scope (:scope) {${definition.style}}</style>`);
    } else if (Array.isArray(definition.style)) {
        for(let styleText of definition.style) {
            style.push(`<style>@scope (:scope) {${styleText}}</style>`);
        }
    }
    
    // validations
    if (template.content.querySelector("link")) {
        throw new Error(`Error loading page: link tags are not allowed in page templates. Use the \`style\` property or <meta name="xshell.style"> instead.: ${src}`);
    }*/
    // state engine
    const stateEngineXShell = xshell.config.get(`page.stateEngine`);
    const stateEngineModule = xshell.config.get(`modules.${context.resourceDefinition.module}.page.stateEngine`, stateEngineXShell);
    const stateEnginePage = definition.meta.stateEngine || stateEngineModule;
    const stateEngineFactoryCreator = await xshell.loader.load("state-engine:" + stateEnginePage);
    const stateEngineFactory = new stateEngineFactoryCreator(definition.state, context);
    // render engine
    const renderEngineXShell = xshell.config.get(`page.renderEngine`);
    const renderEngineModule = xshell.config.get(`modules.${context.resourceDefinition.module}.page.renderEngine`, renderEngineXShell);
    const renderEnginePage = definition.meta.renderEngine || renderEngineModule;
    const renderEngineFactoryCreator = await xshell.loader.load("render-engine:" + renderEnginePage);
    const renderEngineFactory = new renderEngineFactoryCreator(definition.template, context);
    // render engine dependencies
    if (renderEngineFactory.dependencies.length) {
        try {
            await xshell.loader.load(renderEngineFactory.dependencies);
        } catch (e) {
            let errorTexts = [];
            if (e.errors) {
                for(let error of e.errors) errorTexts.push(error);
            } else {
                errorTexts.push(e.message);
            }
            throw new Error(errorTexts.join(""));
        }
    }     
    // returns a class that extends base class Page
    return class extends Page {
        // vars
        _state = null;
        // ctor
        constructor({ src }) {
            super({ src });
            const self = this;
            // meta
            this._label = definition.meta.title || "";
            this._icon = definition.meta.icon || "";
            // state
            this._state = stateEngineFactory.create({
                stateChanged(prop, oldValue, newValue) {
                    // state changed
                }, invalidate(path) {
                    // invalidate
                    self.invalidate(path);
                }
            });
            // services provider
            const servicesProvider = new Proxy({}, {
                get: (obj, prop) => {
                    if (prop == "definition") return Object.seal(Object.freeze(definition));
                    if (prop == "state") return self._state;
                    if (prop == "bus") return xshell.bus;
                    throw new Error(`Unknown service key: ${prop.toString()}`);
                }
            });            
            // set methods
            const methods = definition.script?.(servicesProvider) ?? {};
            // bind methods to the instance
            Object.assign(this, methods);
        }
        // methods
        async mount({ host }) {
            await super.mount({ 
                host, 
                renderEngine: renderEngineFactory.create({ host, state: this._state })
            });
        }
    };
}

//export 
export default class LoaderPageJs {
    async load(src, context) {
        const module = await import(src);
        let definition = module.default;
        if (!definition.meta) definition.meta = {};
        definition = Object.seal(Object.freeze(definition));
        return await createPageClassFromJsDefinition(src, context, definition);        
    }
};