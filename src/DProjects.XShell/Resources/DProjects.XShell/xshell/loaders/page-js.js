import Page from "../page.js"
import Timer from "../timer.js"
import Events from "../events.js"
import xshell from "../xshell.js";
import JsonValidator from "../services/json-validator.js"
import { processStyle } from "../utils/style.js";
import { deepFreeze } from "../utils/object.js";


// utils
function camelToKebab(str) {
    // convert camelCase to kebab-case
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();                      
}
function areDeclarativeValuesEqual(left, right) {
    // compare declarative values by structure and value
    if (left === right) {
        return true;
    }
    if (left === null || right === null || typeof(left) !== "object" || typeof(right) !== "object") {
        return false;
    }
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
            return false;
        }
        return left.every((value, index) => areDeclarativeValuesEqual(value, right[index]));
    }
    if (!isPlainObject(left) || !isPlainObject(right)) {
        return false;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    return leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) && areDeclarativeValuesEqual(left[key], right[key]));
}
function createStateSkeleton(src, definition) {
    // build state with contract defaults as the canonical values for public properties
    const stateSkeleton = {};
    const properties = definition.contract?.properties || {};
    const state = definition.state || {};
    const name = definition.meta?.name || src;
    for (const [propName, property] of Object.entries(properties)) {
        if (property.state === true) {
            stateSkeleton[propName] = property.default;
        }
    }
    for (const [stateName, value] of Object.entries(state)) {
        const property = properties[stateName];
        if (!property) {
            stateSkeleton[stateName] = value;
            continue;
        }
        if (property.state !== true) {
            throw new Error(`Page '${name}' declares public property '${stateName}' in implementation.state, but the definition.contract property is not state-backed.`);
        }
        if (!areDeclarativeValuesEqual(property.default, value)) {
            throw new Error(`Page '${name}' declares different defaults for public property '${stateName}' in definition.contract.properties and implementation.state.`);
        }
    }
    return stateSkeleton;
}
function isPlainObject(value) {
    // check that a value is a JSON-style plain object
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function escapeCssString(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ");
}
function validateSlots(slots, pageName) {
    for (const slotName of slots) {
        const displayName = slotName || "(default)";
        throw new Error(`Page '${pageName}' template declares slot '${displayName}', but pages cannot declare slots.`);
    }
}
function validateQueryProperties(definition, pageName) {
    // validate Page-specific query metadata
    const supportedTypes = new Set(["string", "number", "integer", "boolean"]);
    for (const [propertyName, property] of Object.entries(definition.contract.properties || {})) {
        if (property.query !== true) {
            continue;
        }
        if (property.state !== true) {
            throw new Error(`Page property '${propertyName}' declares query:true but is not state-backed.`);
        }
        if (!supportedTypes.has(property.type)) {
            throw new Error(`Page property '${propertyName}' declares query:true with unsupported type '${property.type}'.`);
        }
    }
}
function parseQueryPropertyValue(propertyName, property, value) {
    // convert one query-string value according to its contract type
    switch (property.type) {
        case "string":
            return value;
        case "number": {
            if (value.trim() === "") {
                throw new Error(`Page property '${propertyName}' has an invalid number query value.`);
            }
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
                throw new Error(`Page property '${propertyName}' has an invalid number query value.`);
            }
            return parsed;
        }
        case "integer": {
            if (value.trim() === "") {
                throw new Error(`Page property '${propertyName}' has an invalid integer query value.`);
            }
            const parsed = Number(value);
            if (!Number.isInteger(parsed)) {
                throw new Error(`Page property '${propertyName}' has an invalid integer query value.`);
            }
            return parsed;
        }
        case "boolean": {
            switch (value.toLowerCase()) {
                case "true":
                case "1":
                    return true;
                case "false":
                case "0":
                    return false;
                default:
                    throw new Error(`Page property '${propertyName}' has an invalid boolean query value.`);
            }
        }
        default:
            throw new Error(`Page property '${propertyName}' declares query:true with unsupported type '${property.type}'.`);
    }
}
async function validatePage(src, definition) {
    // validate
    const componentSchema = await xshell.loader.load("schema:page");
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
    const result = new JsonValidator().validate(definitionObject, componentSchema);
    if (!result.valid) {
        console.error(`Invalid component: ${src}`, result.errors);
        throw new Error(`Invalid component: ${src}`, { cause: result.errors });
    }
}
function serializeQueryPropertyValue(propertyName, property, value) {
    // serialize one reflected query value according to its contract type
    if (value === null || typeof(value) === "undefined") {
        return null;
    }
    switch (property.type) {
        case "string":
            if (typeof(value) !== "string") {
                throw new Error(`Page property '${propertyName}' has an invalid string query value.`);
            }
            return value;
        case "number":
            if (typeof(value) !== "number" || !Number.isFinite(value)) {
                throw new Error(`Page property '${propertyName}' has an invalid number query value.`);
            }
            return String(value);
        case "integer":
            if (typeof(value) !== "number" || !Number.isInteger(value)) {
                throw new Error(`Page property '${propertyName}' has an invalid integer query value.`);
            }
            return String(value);
        case "boolean":
            if (typeof(value) !== "boolean") {
                throw new Error(`Page property '${propertyName}' has an invalid boolean query value.`);
            }
            return value ? "true" : "false";
        default:
            throw new Error(`Page property '${propertyName}' declares query:true with unsupported type '${property.type}'.`);
    }
}
function getPageQueryParams(src) {
    // parse query parameters from the Page source without using browser location
    const queryStart = src.indexOf("?");
    if (queryStart < 0) {
        return new URLSearchParams();
    }
    const fragmentStart = src.indexOf("#", queryStart);
    const query = src.slice(queryStart + 1, fragmentStart < 0 ? undefined : fragmentStart);
    return new URLSearchParams(query);
}


// create page class from js implementation
export async function createPageClassFromJsDefinition(src, context, definition) {
    // defaults
    const moduleId = context.resourceDefinition.moduleId;
    const moduleConfig = xshell.config.modules[moduleId];
    if (!definition.contract) definition.contract = {};
    if (!definition.contract.properties) definition.contract.properties = {};
    if (!definition.contract.events) definition.contract.events = {};
    if (!definition.contract.slots) definition.contract.slots = {};
    if (!definition.contract.methods) definition.contract.methods = {};
    if (!definition.meta) definition.meta = {};
    if (!definition.meta.stateEngine) definition.meta.stateEngine = moduleConfig.defaults.page.stateEngine;
    if (!definition.meta.renderEngine) definition.meta.renderEngine = moduleConfig.defaults.page.renderEngine;
    if (!definition.dependencies) definition.dependencies = {};
    if (!definition.state) definition.state = {};
    if (!definition.style) definition.style = "";
    if (!definition.template) definition.template = "";
    if (!definition.controller) definition.controller = () => ({});
    // freeze implementation and contract
    definition = deepFreeze(definition);
    // validate
    validateQueryProperties(definition, definition.meta?.name || src);
    await validatePage(src, definition);
    // process definition CSS before Page scoping and instance construction
    const style = definition.style ? await processStyle({ src, context, css: definition.style }) : "";
    // state skeleton
    const stateSkeleton = createStateSkeleton(src, definition);
    const queryProperties = [];
    let contextProperties = []; 
    for (const [propName, property] of Object.entries(definition.contract.properties)) {
        if (property.query === true) {
            queryProperties.push({ name: propName, property });
        }
        if (property.context === true) {
            contextProperties.push({ name: propName, property });
        }
    }
    // state engine
    const stateEngineFactoryCreator = await xshell.loader.load("state-engine:" + definition.meta.stateEngine);
    const stateEngineFactory = new stateEngineFactoryCreator(stateSkeleton, context);
    // render engine
    const renderEngineFactoryCreator = await xshell.loader.load("render-engine:" + definition.meta.renderEngine);
    const renderEngineFactory = new renderEngineFactoryCreator(definition.template, context, definition.templateRenderer);
    // validate compiled template slots through the render-engine factory contract
    validateSlots(renderEngineFactory.slots, definition.meta?.name || "unknown");
    // load render engine dependencies
    if (renderEngineFactory.dependencies.length) {
        await xshell.loader.load(renderEngineFactory.dependencies);
    }    
    // load page dependencies
    let dependencies = {};
    if (definition.dependencies && Object.keys(definition.dependencies).length) {
        dependencies = await xshell.loader.load(definition.dependencies);
    }
    // init 
    await renderEngineFactory.init();
    // returns a class that extends base class Page
    const PageClass = class extends Page {
        // vars
        _state = null;
        _stateChanges = [];
        _renderEngine = null;
        _renderPending = false;
        _styleSheets = [];
        _disposables = [];
        _initializingQuery = true;
        _commandsPending = [];
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
                    self.stateChange(prop, oldValue, newValue);
                }, invalidate(path) {
                    // invalidate
                    self.invalidate(path);
                }
            });
            // query-string initialization
            if (queryProperties.length) {
                const queryParams = getPageQueryParams(src);
                for (const { name, property } of queryProperties) {
                    const queryName = camelToKebab(name);
                    if (queryParams.has(queryName)) {
                        self._state[name] = parseQueryPropertyValue(name, property, queryParams.get(queryName));
                    }
                }
            }
            // contextProperties
            if (contextProperties.length) {
                for (const { name, property } of contextProperties) {
                    if (typeof context[name] != "undefined") {
                        self._state[name] = context[name];
                    }
                }
            }
            this._initializingQuery = false;
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
                        const timer = new Timer((command, ...params) => { self._controller[command]?.(...params); });
                        self._disposables.push(timer);
                        return timer;
                    } else if (prop == "events") {
                        // events
                        const events = new Events((command, ...params) => { self._controller[command]?.(...params); });
                        self._disposables.push(events);
                        return events;
                    } else if (prop == "page") {
                        // get current page
                        return self;
                    } else if (prop == "dependencies") {
                        // get dependencies
                        return dependencies;
                    } else if (prop == "query") {
                        // get query
                        return getPageQueryParams(self.src);
                    } else if (prop == "commands") {
                        // get commands
                        return {
                            enqueue: (command, ...params) => { self._commandsPending.push( { command, params: [...params] }); }
                        };
                    } else if (prop == "moduleInstance") {
                        // get module instance
                        return xshell.modules.getModuleById(moduleId);
                    } else if (prop == "moduleController") {
                        // get module controller
                        return xshell.modules.getModuleById(moduleId).controller;
                    } else {
                        // resolve from services
                        return xshell.services.resolve(prop);                    
                    }
                }
            });            
            // controller
            this._controller = definition.controller(servicesProvider) ?? {};
            // validate public contract methods
            for (const methodName of Object.keys(definition.contract.methods ?? {})) {
                const method = this._controller[methodName];
                if (typeof(method) !== "function") {
                    throw new Error(`Page '${definition.meta.id}' declares public method '${methodName}' in definition.contract.methods but controller.${methodName} is not a function.`);
                }
            }
            
        }
        // props
        static get definition() {return definition;}
        // mount/unmount
        async mount({ host }) {
            if (this._unloaded) return;
            // style
            const cssPageSelector = `${host.nodeName.toLowerCase()}[src="${escapeCssString(host.getAttribute("src"))}"]`;
            if (style) {
                const cssStyleSheet = new CSSStyleSheet();
                cssStyleSheet.replaceSync(`@scope (${cssPageSelector}) {${style};}`);
                this._styleSheets.push(cssStyleSheet);        
            }
            host.getRootNode().adoptedStyleSheets = [...host.getRootNode().adoptedStyleSheets,...this._styleSheets];
            // render engine
            this._renderEngine = renderEngineFactory.create({ host, state: this._state, handler:(command, ...params) => {
                this._controller[command](...params);
            }, invalidate: () => { 
                this.invalidate(); 
            } })
            this._renderEngine.mount();
            // mount
            await super.mount({ host });
            // invalidate
            this.invalidate();
        }
        async unmount() {
            if (this._unloaded) return;
            // detach this mount's resources immediately
            const renderEngine = this._renderEngine;
            const styleSheets = this._styleSheets;
            // capture the current render engine and style sheets for cleanup after unmount
            this._renderEngine = null;
            this._styleSheets = [];
            this._renderPending = false;
            // remove this mount's style sheets from the host's adopted style sheets
            if (styleSheets.length && this.host) {
                this.host.getRootNode().adoptedStyleSheets = this.host.getRootNode().adoptedStyleSheets.filter(stylesheet => !styleSheets.includes(stylesheet));
            }
            // controller may be async
            await super.unmount();
            // clean only resources captured from this mount
            if (renderEngine) {
                renderEngine.unmount();
            }
        }
        async unload() {
            if (this._unloaded) return;
            try {
                await super.unload();
            } finally {
                if (this._renderEngine) {
                    this._renderEngine.unmount();
                    this._renderEngine = null;
                }
                this._renderPending = false;
                this._styleSheets = [];
                for (const disposable of this._disposables) {
                    disposable.dispose();
                }
                this._disposables = [];
                this._stateChanges = [];
                this._controller = null;
            }
        }
        // statechange
        stateChange(prop, oldValue, newValue) {
            // state changed
            this._stateChanges.push({prop, oldValue, newValue});
            const queryProperty = queryProperties.find(item => item.name === prop);
            if (this._initializingQuery || !queryProperty || queryProperty.property.reflect !== true) {
                return;
            }
            const queryValue = areDeclarativeValuesEqual(newValue, queryProperty.property.default)
                ? null
                : serializeQueryPropertyValue(prop, queryProperty.property, newValue);
            this.replaceQuery({ [camelToKebab(prop)]: queryValue });
        }
        // invalidate
        invalidate(path) {
            const renderEngine = this._renderEngine;
            if (!renderEngine) return;
            if (this._renderPending) return;
            this._renderPending = true;
            requestAnimationFrame(() => {
                if (this._renderEngine !== renderEngine) return;
                this.onCommand("stateChange", {changes: this._stateChanges});
                this._stateChanges = [];
                this._renderPending = false;
                renderEngine.render();
                while (this._commandsPending.length > 0) {
                    const cmd = this._commandsPending.shift();
                    this.onCommand(cmd.command, ...cmd.params);
                }
            });
        }
    };
    // add methods
    for (const methodName of Object.keys(definition.contract.methods)) {
        if (methodName in PageClass.prototype) {
            throw new Error(`Page '${definition.meta.id}' cannot expose public method '${methodName}' because it would overwrite a framework or Page method.`);
        }
        Object.defineProperty(PageClass.prototype, methodName, {
            value: function(...args) {
                return this.onCommand(methodName, ...args);
            },
            enumerable: true,
            configurable: false
        });
    }
    return PageClass;
}

//export 
export default class LoaderPageJs {
    async load(src, context) {
        // import
        let module = null;
        try {
            module = await import(src);
        } catch (error) {
            try {
                const response = await fetch(src, { cache: "no-store" });
                if (!response.ok) {
                    error.code = response.status;
                    error.message = `Failed to fetch ${src}:`;
                    error.details = await response.text();
                }
            } catch {
                // Network or CORS error
            }
            throw error;
        }
        // proccess
        let definition = module.default;
        // check if its a promise
        if (typeof(definition) === "object" && typeof(definition.then) === "function") {
            definition = await definition;
        }
        // check if its a class
        if (typeof(definition) === "function"  && /^class\s/.test(Function.prototype.toString.call(definition))) {
            return definition;
        }
        // else, asume its a implementation object
        if (!definition.meta) definition.meta = {};
        if (!definition.meta.id) {
            let aux = src.split("?")[0];
            aux = aux.substring(aux.lastIndexOf("/")+1).split(".")[0];
            definition.meta.id = aux;
        }
        // create class implementation
        return await createPageClassFromJsDefinition(src, context, definition);        
    }
};
