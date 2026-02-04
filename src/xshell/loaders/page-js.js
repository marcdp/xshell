import Page from "../page.js"
import xshell from "xshell";
import {combineUrls} from "../utils/urls.js";
import {rewriteDocumentUrls} from "../utils/rewriteDocumentUrls.js";

// create page class from definition
export async function createPageClassFromDefinition(src, context, definition) {
    const resourcePath = context.resourcePath;
    const modulePath = context.resourceDefinition.modulePath;
    const appBase = context.appBase;
    const navigationMode = context.navigationMode;
    const navigationHashPrefix = context.navigationHashPrefix;
    // style
    const style = [];
    if (typeof(definition.style) == "string") {
        style.push(`<style>@scope (:scope) {${definition.style}}</style>`);
    } else if (Array.isArray(definition.style)) {
        for(let styleText of definition.style) {
            style.push(`<style>@scope (:scope) {${styleText}}</style>`);
        }
    }
    // template
    const template = document.createElement("template");
    template.innerHTML = definition.template + style.join("\n"); 
    const fragment = rewriteDocumentUrls(template.content, (tag, attr, type, url) => {
        if (url.indexOf(":") != -1) {
            return url;
        } else if (url.startsWith("xshell/")) {
            return url;
        } else if (xshell.resolver.has("import:" + url)) {
            return xshell.resolver.resolveUrl("import:" + url);
        } else if (type == "resource") {
            if (url.startsWith("/")) {
                return xshell.resolver.resolveUrl(modulePath + url);
            } else{
                return appBase + combineUrls(resourcePath, url);
            }
        } else if (type == "navigation") {
            let virtualUrl = null;
            if (url.startsWith("/")) {
                virtualUrl = modulePath + url;
            } else if (url.startsWith("#")) {
                virtualUrl = resourcePath + url;
            } else {
                virtualUrl = combineUrls(resourcePath, url);
            }
            let realUrl = null;
            if (navigationMode == "hash") {
                realUrl = navigationHashPrefix + virtualUrl;
            } else {
                realUrl = appBase + virtualUrl;
            }
            return realUrl;
        } else {
            throw new Error("Unknown rewrite type: " + type);
        }
    });
    // validations
    if (template.content.querySelector("link")) {
        throw new Error(`Error loading page: link tags are not allowed in page templates. Use the \`style\` property or <meta name="xshell.style"> instead.: ${src}`);
    }
    // dependencies
    const shellLazyName = xshell.config.get("xshell.component.lazy");
    const dependencies = new Set();
    fragment.querySelectorAll("*").forEach(el => {
        if (el.tagName.includes("-")) {
            if (shellLazyName && (el.localName != shellLazyName && el.closest(shellLazyName) != null)) return;
            dependencies.add("component:" + el.tagName.toLowerCase());
        }
    });
    if (dependencies.size) {
        try {
            await xshell.loader.load(dependencies);
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
    // state engine
    const stateEngineXShell = xshell.config.get(`page.stateEngine`);
    const stateEngineModule = xshell.config.get(`modules.${context.resourceDefinition.module}.page.stateEngine`, stateEngineXShell);
    const stateEnginePage = definition.meta.stateEngine || stateEngineModule;
    const stateEngineFactoryCreator = await xshell.loader.load("state-engine:" + stateEnginePage);
    const stateEngineFactory = new stateEngineFactoryCreator(definition.state);
    // render engine
    const renderEngineXShell = xshell.config.get(`page.renderEngine`);
    const renderEngineModule = xshell.config.get(`modules.${context.resourceDefinition.module}.page.renderEngine`, renderEngineXShell);
    const renderEnginePage = definition.meta.renderEngine || renderEngineModule;
    const renderEngineFactoryCreator = await xshell.loader.load("render-engine:" + renderEnginePage);
    const renderEngineFactory = new renderEngineFactoryCreator(definition.template);
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
            this._state = stateEngineFactory({
                stateChanged(prop, oldValue, newValue) {
                    // state changed
                }, invalidate(path) {
                    // invalidate
                    self.invalidate();
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
                renderEngine: renderEngineFactory({ host, fragment, state: this._state })
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
        return await createPageClassFromDefinition(src, context, definition);        
    }
};