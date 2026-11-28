import JsonValidator from "../services/json-validator.js"
import { processStyle } from "../utils/style.js";
import { deepFreeze } from "../utils/object.js";

// utils
function kebabToCamel(str) {
    // convert kebab-case to camelCase
    return str.split('-').map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)).join('');
};
function camelToKebab(str) {
    // convert camelCase to kebab-case
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();                      
}
function throwCleanupErrors(errors, message) {
    // preserve one cleanup failure and aggregate independent lifecycle failures
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, message);
}
function isEmptyPlainObject(value) {
    // check if the value is an empty plain object
    return value && typeof(value) === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === 0;
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
    const properties = definition.contract.properties || {};
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
            throw new Error(`Component '${name}' declares public property '${stateName}' in implementation.state, but the definition.contract property is not state-backed.`);
        }
        if (!areDeclarativeValuesEqual(property.default, value)) {
            throw new Error(`Component '${name}' declares different defaults for public property '${stateName}' in definition.contract.properties and implementation.state.`);
        }
    }
    return stateSkeleton;
}
function isPlainObject(value) {
    // check that a value is a JSON-style plain object
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function convertAttributeValue(property, value) {
    // convert attribute value based on property type
    if (property.attributeParser === "json") {
        if (value === null) return null;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    switch (property.type) {
        case "boolean":
            if (value == "false") return false;
            if (value == "0") return false;
            return value !== null;
        case "number":
            return value === null ? null : Number(value);
        case "array":
        case "object":
            if (value === null) return null;
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        default:
            return value;
    }
}
function findClosestXPage(element) {
    // Find the closest ancestor X-PAGE element, if any.
    let current = element;
    while (current) {
        if (current.tagName === "X-PAGE") return current;
        if (current.parentNode) {
            current = current.parentNode;
            continue;
        }
        const root = current.getRootNode();
        if (root && root.host) {
            current = root.host;
            continue;
        }
        return null;
    }
    return null;
}
function validateSlots(slots, definition, componentId) {
    const contractSlots = definition.contract.slots || {};
    for (const slotName of slots) {
        if (!Object.prototype.hasOwnProperty.call(contractSlots, slotName)) {
            const displayName = slotName || "(default)";
            throw new Error(`Component '${componentId}' template declares slot '${displayName}', but it is not declared in definition.contract.slots.`);
        }
    }
}
async function validateComponent(src, definition, context) {
    // validate
    const definitionObject = Object.fromEntries(Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value]));
    const componentSchema = await context.services.loader.load("schema:component");
    const result = new JsonValidator().validate(definitionObject, componentSchema);
    if (!result.valid) {
        throw new Error(`Invalid component: ${src}`, { cause: result.errors });
    }
}

// create web component from js implementation
export async function createComponentClassFromJsDefinition(src, context, definition) {
    // defaults
    if (!definition.contract) definition.contract = {};
    if (!definition.contract.properties) definition.contract.properties = {};
    if (!definition.contract.events) definition.contract.events = {};
    if (!definition.contract.slots) definition.contract.slots = {};
    if (!definition.contract.methods) definition.contract.methods = {};
    if (!definition.meta) definition.meta = {};
    if (!definition.meta.renderEngine) definition.meta.renderEngine = context.services.config.modules[context.resourceDefinition.moduleId].defaults.component.renderEngine;
    if (!definition.meta.stateEngine) definition.meta.stateEngine = context.services.config.modules[context.resourceDefinition.moduleId].defaults.component.stateEngine;
    if (!definition.dependencies) definition.dependencies = {};
    if (!definition.state) definition.state = {};
    if (!definition.style) definition.style = "";
    if (!definition.template) definition.template = "";
    if (!definition.controller) definition.controller = () => ({});
    // validateComponent 
    // Use the declared custom-element identity and omit schema details from diagnostics.
    const logger = context.services.logger;
    const moduleId = context.resourceDefinition.moduleId;
    const componentId = typeof definition.meta.id === "string" && /^[\w.-]+$/.test(definition.meta.id) ? definition.meta.id : undefined;
    const consumer = Object.freeze({type: "component", id: definition.meta.id});
    try {
        await validateComponent(src, definition, context);
    } catch (error) {
        logger.error("Components: contract validation failed", {componentId, moduleId});
        throw error;
    }
    // freeze and seal the implementation and contract to prevent further modifications
    definition = deepFreeze(definition);
    // process definition CSS once before creating Component instances
    const style = definition.style ? await processStyle({ src, context, css: definition.style }) : "";
    // stylesheets
    const stylesheets = []
    if (style) {
        const stylesheet = new CSSStyleSheet();
        stylesheet.replaceSync(style);
        stylesheets.push(stylesheet);
    }
    // capture the initialized module collection once and reuse the same sheets for every instance
    const sharedStyleSheets = context.services.modules.shadowStyleSheets ?? [];
    // state skeleton
    const stateSkeleton = createStateSkeleton(src, definition);
    // non-state-backed property defaults
    const serializedPropertyDefaults = Object.create(null);;
    for (const [propName, property] of Object.entries(definition.contract.properties)) {
        const defaultValue = property.default;
        if (property.state !== true && defaultValue !== null && typeof(defaultValue) === "object" && (Array.isArray(defaultValue) || isPlainObject(defaultValue))) {
            serializedPropertyDefaults[propName] = JSON.stringify(defaultValue);
        }
    }
    const propertyAttributeNames = [];
    const reflectedPropertyNames = [];
    const stateMapAttributes = [];
    for (const [propName, property] of Object.entries(definition.contract.properties)) {
        if (property.attribute === true) {
            propertyAttributeNames.push(camelToKebab(propName));
        }
        if (property.reflect === true) {
            reflectedPropertyNames.push(propName);
        }
        if (property.state === true && property.attribute === true && isEmptyPlainObject(property.default)) {
            stateMapAttributes.push({ attributePrefix: camelToKebab(propName) + "-", stateName: propName });
        }
    }
    for (const [stateName, value] of Object.entries(definition.state)) {
        if (Object.prototype.hasOwnProperty.call(definition.contract.properties, stateName)) {
            continue;
        }
        if (isEmptyPlainObject(value)) {
            stateMapAttributes.push({ attributePrefix: camelToKebab(stateName) + "-", stateName });
        }
    }
    // state engine
    const changeDetection = {};
    for (const [propName, property] of Object.entries(definition.contract.properties)) {
        if (property.state === true && property.changeDetection) {
            changeDetection[propName] = property.changeDetection;
        }
    }
    const stateEngineFactoryCreator = await context.services.loader.load("state-engine:" + definition.meta.stateEngine);
    const stateEngineFactory = new stateEngineFactoryCreator(stateSkeleton, context, { changeDetection });
    // render engine
    const renderEngineFactoryCreator = await context.services.loader.load("render-engine:" + definition.meta.renderEngine);
    const renderContext = {
        resourceName: context.resourceName,
        resourcePath: context.resourcePath,
        resourceDefinition: context.resourceDefinition,
        appBasePath: context.appBasePath,
        componentLazy: context.componentLazy,
        get i18n() {return context.services.i18n;},
        get navigationMode() {return context.services.navigation.mode;}
    };
    const renderEngineFactory = new renderEngineFactoryCreator(definition.template, renderContext, definition.templateRenderer);
    // validate compiled template slots through the render-engine factory contract
    try {
        validateSlots(renderEngineFactory.slots, definition, definition.meta.id || "unknown");
    } catch (error) {
        logger.error("Components: contract validation failed", {componentId, moduleId});
        throw error;
    }
    // load render engine dependencies
    if (renderEngineFactory.dependencies.length) {
        await context.services.loader.load(renderEngineFactory.dependencies);
    }    
    // load component dependencies
    let dependencies = {};
    if (definition.dependencies && Object.keys(definition.dependencies).length) {
        dependencies = await context.services.loader.load(definition.dependencies);
    }
    // init 
    await renderEngineFactory.init();
    // returns a class that extends base class component
    const WebComponent = class extends HTMLElement {
        // vars
        _state = null;
        _properties = null;
        _stateChanges = [];
        _servicesScope = null;
        _reflectingAttributes = new Set();
        _controller = null;
        _renderEngine = null;
        _mutationObserver = null;
        _renderPending = false;
        _renderCount = 0;
        _postRenderPending = [];
        _connected = false;
        _loadState = definition.meta.awaitLoad === true ? "pending" : "ready";
        _loadPromise = null;
        _unloaded = false;
        // static
        static get observedAttributes() { 
            return propertyAttributeNames;
        }
        static get isXShellComponent() {
            return true;
        }
        static get contract() { 
            return definition.contract;
        }
        get controller() {
            return this._controller;
        }
        // ctor
        constructor() {
            super();
            const self = this;
            // create this Component's independent direct child of the application root scope
            const rootServices = context.services.services;
            this._servicesScope = rootServices.beginScope({context: {
                invokeController(command, ...params) { return self._controller[command](...params); }
            }});
            let stage = "construction";
            try {
            //shadowRoot
            this.attachShadow(definition.meta.shadowRootOptions || {mode: "open"});
            this.shadowRoot.adoptedStyleSheets = [...sharedStyleSheets, ...stylesheets];
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
            this._properties = {};
            for (const [propName, property] of Object.entries(definition.contract.properties)) {
                if (property.state !== true) {
                    this._properties[propName] = Object.hasOwn(serializedPropertyDefaults, propName) ? JSON.parse(serializedPropertyDefaults[propName]) : property.default;
                }
            }
            // services provider
            const servicesProvider = new Proxy({}, {
                get: (obj, prop) => {
                    if (prop == "definition") {
                        // definition of component
                        return definition;
                    } else if (prop == "state") {
                        // state
                        return self._state;
                    } else if (prop == "moduleConfig") {
                        // module configuration
                        return context.services.config.modules[context.resourceDefinition.moduleId];
                    } else if (prop == "module") {
                        // module 
                        return context.services.modules.getModuleById(context.resourceDefinition.moduleId);
                    } else if (prop == "host") {
                        // get current web component
                        return self;
                    } else if (prop == "getPage") {
                        // get current page function
                        return function() {
                            const xpage = findClosestXPage(self);
                            return (xpage ? xpage.page : null);
                        }
                    } else if (prop == "dependencies") {
                        // get dependencies
                        return dependencies;
                    } else if (prop == "postRender") {
                        // queue a controller method for execution after the next render
                        return (methodName, ...args) => {
                            self._postRenderPending.push({ methodName, args: [...args] });
                        };
                    } else if (prop == "services") {
                        // expose this Component's owning Services scope
                        return self._servicesScope;
                    } else if (typeof prop === "symbol") {
                        return undefined;
                    } else {
                        // resolve ordinary services through this Component's scope
                        return self._servicesScope.resolve(prop, consumer);
                    }                    
                }
            });
            // controller
            stage = "controller initialization";
            this._controller = definition.controller(servicesProvider) ?? {};
            // validate public contract methods
            for (const methodName of Object.keys(definition.contract.methods ?? {})) {
                const method = this._controller[methodName];
                if (typeof(method) !== "function") {
                    throw new Error(`Component '${definition.meta.id}' declares public method '${methodName}' in definition.contract.methods but controller.${methodName} is not a function.`);
                }
            }
            stage = "construction";
            // attribute mutation observer (listen for changes in attributes that start with state map attribute names)
            if (stateMapAttributes.length) {
                this._mutationObserver = new MutationObserver((mutationsList) => {
                    for (let mutation of mutationsList) {
                        if (mutation.type === "attributes") {
                            const attrName = mutation.attributeName;
                            const stateMapAttribute = stateMapAttributes.find(item => attrName.startsWith(item.attributePrefix));
                            if (stateMapAttribute) {
                                const subPropName = kebabToCamel(attrName.substring(stateMapAttribute.attributePrefix.length));
                                const attrValue = this.getAttribute(attrName);
                                const propValue = this._state[stateMapAttribute.stateName] || {};
                                propValue[subPropName] = attrValue;
                                this._state[stateMapAttribute.stateName] = propValue;
                            }
                        }
                    }
                });
                this._mutationObserver.observe(this, { attributes: true });
                // init state from attributes
                for (const stateMapAttribute of stateMapAttributes) {
                    for(let attr of this.attributes) {
                        if (attr.name.startsWith(stateMapAttribute.attributePrefix)) {
                            const subPropName = kebabToCamel(attr.name.substring(stateMapAttribute.attributePrefix.length));
                            const propValue = this._state[stateMapAttribute.stateName] || {};
                            propValue[subPropName] = attr.value;
                            this._state[stateMapAttribute.stateName] = propValue;
                        }
                    }
                }
            }
            // invoke load once and retain its completion only when initial rendering must wait
            stage = "load";
            const loadResult = this.onCommand("load", {});
            if (definition.meta.awaitLoad === true && loadResult && typeof(loadResult.then) === "function") {
                const loadPromise = Promise.resolve(loadResult);
                this._loadPromise = loadPromise;
                loadPromise.then(() => {
                    if (this._loadPromise !== loadPromise) return;
                    this._loadPromise = null;
                    this._loadState = "ready";
                    this._mount();
                }, () => {
                    if (this._loadPromise !== loadPromise) return;
                    this._loadPromise = null;
                    this._loadState = "failed";
                    logger.error("Components: lifecycle operation failed", {componentId, moduleId, stage: "load"});
                });
            } else if (definition.meta.awaitLoad === true) {
                this._loadState = "ready";
            }
            } catch (error) {
                // initiate asynchronous cleanup while preserving synchronous constructor behavior
                const scope = this._servicesScope;
                this._servicesScope = null;
                scope.dispose().catch(() => {
                    logger.error("Components: scope disposal failed", {componentId, moduleId, stage: "construction"});
                });
                logger.error("Components: lifecycle operation failed", {componentId, moduleId, stage});
                throw error;
            }
        }        
        // attributeChangedCallback
        attributeChangedCallback(name, oldValue, newValue) {
            if (this._reflectingAttributes.has(name)) return;
            const propName = kebabToCamel(name);
            const property = definition.contract.properties[propName];
            if (!property || property.attribute !== true) return;
            this[propName] = convertAttributeValue(property, newValue);
        }
        // connected/disconnected
        connectedCallback() {
            if (this._unloaded) return;
            this._connected = true;
            this._mount();
        }
        disconnectedCallback() {
            this._connected = false;
            if (this._unloaded) return;
            this._unmount();
        }
        connectedMoveCallback() {
            // A state-preserving DOM move keeps the existing connection and render engine.
        }
        // unload
        async unload() {
            if (this._unloaded) return;
            this._unloaded = true;
            this._connected = false;
            this._loadPromise = null;
            const errors = [];
            let result;

            // invoke existing unmount and controller unload before final cleanup
            try {
                this._unmount();
            } catch (error) {
                errors.push(error);
            }
            try {
                result = await this.onCommand("unload", {});
            } catch (error) {
                errors.push(error);
            }

            // perform the existing observer cleanup independently
            try {
                this._mutationObserver?.disconnect();
            } catch (error) {
                errors.push(error);
            }
            this._mutationObserver = null;
            if (errors.length) {
                logger.error("Components: lifecycle operation failed", {componentId, moduleId, stage: "unload"});
            }

            // dispose the owner scope and its transient helpers after existing cleanup
            const servicesScope = this._servicesScope;
            try {
                if (servicesScope) await servicesScope.dispose();
            } catch (error) {
                errors.push(error);
                logger.error("Components: scope disposal failed", {componentId, moduleId, stage: "unload"});
            } finally {
                this._controller = null;
                this._servicesScope = null;
            }

            throwCleanupErrors(errors, `Multiple errors occurred while unloading Component '${definition.meta.id ?? src}'.`);
            
            return result;
        }
        // methods (private)
        _mount() {
            // mount only the current connected instance after awaited initialization succeeds
            if (this._unloaded || !this._connected || this._loadState !== "ready" || this._renderEngine) return;
            this._renderEngine = renderEngineFactory.create({ host: this.shadowRoot, state: this._state, handler:(command, ...params) => {
                this.onCommand(command, ...params);
            }, invalidate: () => {
                this.invalidate();
            } });
            this._renderEngine.mount();
            this.onCommand("mount", {});
            this.invalidate();
        }
        _unmount() {
            const renderEngine = this._renderEngine;
            if (!renderEngine) return;
            this._renderEngine = null;
            this._renderPending = false;
            try {
                this.onCommand("unmount", {});
            } finally {
                renderEngine.unmount();
            }
        }
        // stateChange(prop, oldValue, newValue) {
        stateChange(prop, oldValue, newValue) {
            this._stateChanges.push({prop, oldValue, newValue});
            // reflect to attribute if needed
            if (reflectedPropertyNames.includes(prop)) {
                this.reflectPropertyToAttribute(prop, newValue);
            }
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
                while (this._postRenderPending.length > 0) {
                    const pending = this._postRenderPending.shift();
                    this.onCommand(pending.methodName, ...pending.args);
                }
            });
        }
        // invoke controller
        onCommand(command, ...params) {
            const handler = this._controller[command];
            if (typeof(handler) === "function") {
                return handler.apply(this._controller, params);
            }
        }
        // reflectPropertyToAttribute
        reflectPropertyToAttribute(propName, value) {
            const attrName = camelToKebab(propName);
            this._reflectingAttributes.add(attrName);
            try {
                if (value === false || value === null) {
                    this.removeAttribute(attrName);
                } else {
                    this.setAttribute(attrName, value === true ? "" : value);
                }
            } finally {
                this._reflectingAttributes.delete(attrName);
            }
        }        
    };
    // add properties
    for (const [propName, property] of Object.entries(definition.contract.properties)) {
        Object.defineProperty(WebComponent.prototype, propName, {
            get() {
                return property.state === true ? this._state[propName] : this._properties[propName];
            },
            set(newValue) {
                if (property.state === true) {
                    this._state[propName] = newValue;
                } else {
                    const oldValue = this._properties[propName];
                    if (oldValue !== newValue) {
                        this._properties[propName] = newValue;
                        if (property.reflect === true) {
                            this.reflectPropertyToAttribute(propName, newValue);
                        }
                    }
                }
            },
            enumerable: true,
            configurable: false
        });
    }
    // add methods
    for (const methodName of Object.keys(definition.contract.methods)) {
        if (methodName == "focus") {
        } else if (methodName in WebComponent.prototype) {
            throw new Error(`Component '${definition.meta.id}' cannot expose public method '${methodName}' because it would overwrite a framework or Web Component method.`);
        }
        Object.defineProperty(WebComponent.prototype, methodName, {
            value: function(...args) {
                return this.onCommand(methodName, ...args);
            },
            enumerable: true,
            configurable: false
        });
    }
    // register
    const id = definition.meta.id;
    if (window.customElements.get(id)) {
        throw new Error(`Component '${id}' from '${src}' cannot be registered because that id is already registered.`);
    }
    window.customElements.define(id, WebComponent);
    logger.trace("Components: definition loaded: " + id, {componentId, moduleId});
    // return class
    return WebComponent
}

//export 
export default class LoaderComponentJs {
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
        // process
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
        return await createComponentClassFromJsDefinition(src, context, definition);        
    }
};
