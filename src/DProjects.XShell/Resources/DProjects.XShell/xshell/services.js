
import JsonValidator from "./services/json-validator.js";

// class
export default class Services {

    static #lifetimes = new Set(["singleton", "scoped", "transient"]);

    // vars
    #config = null;
    #loader = null;
    #contracts = null;
    #items = null;
    #resolver = null;
    #bus = null;
    #creationPath = [];
    #jsonValidator = null;
    #parent = null;
    #root = null;
    #context = null;
    #children = [];
    #disposables = [];
    #disposableSet = new Set();
    #scopedInstances = new Map();
    #lifecycleState = "active";
    #disposalPromise = null;

    // props
    get registry() {
        // expose the root registration metadata only while this scope is active
        this.#assertActive();
        return this.#root.#getRegistrySnapshot();
    }

    // ctor
    constructor( {config, loader, contracts, resolver, bus, context} = {}, parent = null ) {
        // associate child scopes with their direct parent and shared root container
        if (parent) {
            this.#parent = parent;
            this.#root = parent.#root;
            this.#context = context ?? null;
            return;
        }

        // initialize registration and singleton state only for the root container
        this.#root = this;
        this.#items = {};
        this.#jsonValidator = new JsonValidator();
        this.#config = config;
        this.#loader = loader;
        this.#contracts = contracts;
        this.#resolver = resolver;
        this.#bus = bus;
    }

    //methods
    beginScope(options = {}) {
        // create and track a distinct child without constructing any services
        this.#assertActive();
        if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("Services scope options must be an object.");
        const unexpected = Object.keys(options).find(name => name !== "context");
        if (unexpected) throw new TypeError(`Unknown Services scope option '${unexpected}'.`);
        if (options.context !== undefined && (!options.context || typeof options.context !== "object" || Array.isArray(options.context))) {
            throw new TypeError("Services scope context must be an object.");
        }
        const scope = new Services({context: options.context}, this);
        this.#children.push(scope);
        return scope;
    }
    addDisposable(resource) {
        // retain each valid resource at most once within this scope
        this.#assertActive();
        if (typeof resource?.dispose !== "function") throw new TypeError("Disposable resource must expose a callable dispose() method.");
        if (!this.#disposableSet.has(resource)) {
            this.#disposableSet.add(resource);
            this.#disposables.push(resource);
        }
        return resource;
    }
    dispose() {
        // mark synchronously and retain one shared cleanup operation
        if (this.#disposalPromise) return this.#disposalPromise;
        this.#lifecycleState = "disposing";
        this.#disposalPromise = Promise.resolve().then(() => this.#disposeScope());
        return this.#disposalPromise;
    }
    async init() {
        // restrict application registration initialization to the root container
        if (this !== this.#root) throw new Error("Only the root Services instance can initialize the service registry.");
        this.#assertActive();

        // validate contract references before loading any implementations
        const serviceContractItems = {};
        for(const serviceName in this.#config.xshell.services) {
            const service = this.#config.xshell.services[serviceName];
            if (!Object.hasOwn(service, "lifetime")) throw new Error(`Configured service '${serviceName}' must declare a lifetime.`);
            if (!Services.#lifetimes.has(service.lifetime)) throw new Error(`Invalid lifetime '${service.lifetime}' for configured service '${serviceName}'.`);
            const serviceContractItem = this.#contracts.getContractItemById(service.contract);
            if (!serviceContractItem) throw new Error(`Service '${serviceName}' references unknown contract '${service.contract}'.`);
            serviceContractItems[serviceName] = serviceContractItem;
        }

        // initialize services based on the config
        const tasks = [];
        for(const serviceName in this.#config.xshell.services) {
            const service = this.#config.xshell.services[serviceName];
            const serviceContractItem = serviceContractItems[serviceName];
            tasks.push((async () => {
                // resolve the implementation's module ownership from its resource definition
                const resource = "esm:" + service.implementation;
                const resolved = this.#resolver.resolve(resource);
                if (!resolved) throw new Error(`Service '${serviceName}' implementation could not be resolved: ${resource}`);
                const moduleId = resolved.definition.moduleId;
                if (!moduleId) throw new Error(`Service '${serviceName}' implementation has no module ownership: ${resource}`);
                // load the service implementation and measure the time taken
                const start = performance.now();
                const serviceImplementation = await this.#loader.load(resource);
                const owner = moduleId === "xshell" ? this.#config.xshell : this.#config.modules[moduleId];
                const implementationFile = owner?.files?.find(file => file.path === service.implementation);
                this.register(serviceName, null, {
                    contractItem: serviceContractItem, 
                    lifetime: service.lifetime,
                    implementationItem: {
                        class: serviceImplementation,
                        moduleId: moduleId,
                        size: implementationFile?.size ?? 0,
                        time: performance.now() - start,
                        path: service.implementation,
                        url: new URL(service.implementation.replace(/^\/+/, ""), this.#config.app.baseUrl).href
                    }
                });
                this.#items[serviceName].options = service.options ?? {};
            })());
        }
        await Promise.all(tasks);
        this.#items = Object.freeze(this.#items);
    }
    register(name, instance, { contractItem, implementationItem, lifetime = "singleton" } =  {}) {
        // keep registration topology exclusively owned by the root container
        if (this !== this.#root) throw new Error("Only the root Services instance can register services.");
        this.#assertActive();
        if (Object.isFrozen(this.#items)) throw new Error("Service registry is immutable after initialization.");
        if (Object.hasOwn(this.#items, name)) throw new Error(`Service already exists: ${name}`);
        if (!Services.#lifetimes.has(lifetime)) throw new Error(`Invalid lifetime '${lifetime}' for service '${name}'.`);
        if (instance != null && lifetime !== "singleton") throw new Error(`Preconstructed service '${name}' must use the singleton lifetime.`);
        if (instance != null && contractItem) this.#validateImplementation(name, instance, contractItem);
        this.#items[name] = {
            instance, contractItem, implementationItem, lifetime,
            state: instance == null ? "" : "created",
            initializationState: "not-initialized",
            initializationPromise: null
        };
    }
    has(name) {
        // check the shared root registry without constructing a configured service
        this.#assertActive();
        return Object.hasOwn(this.#root.#items, name);
    }
    resolve(name) {
        // select root, scope-local, or per-resolution ownership by registration lifetime
        this.#assertActive();
        return this.#root.#resolve(name, this);
    }
    initialize(name) {
        // initialize cached singleton or scoped instances through their owning context
        this.#assertActive();
        return this.#root.#initialize(name, this);
    }
    getServiceInfo(id) {
        // project shared root metadata without exposing mutable registration records
        this.#assertActive();
        return this.#root.#getServiceInfo(id);
    }

    // methods (private)
    #getRegistrySnapshot() {
        // project the current mutable records into independent inspection data
        return Object.freeze(Object.entries(this.#items).map(([id, item]) => this.#projectServiceInfo(id, item)));
    }
    #resolve(name, context) {
        const result = this.#items[name];
        if (result == undefined) {
            throw new Error(`Service not found: ${name}`); 
        }
        this.#validateLifetimeResolution(name, result, context);

        // return or construct the instance through its lifetime owner
        switch (result.lifetime) {
            case "singleton":
                return this.#resolveCached(name, result, result, this);
            case "scoped": {
                const scopedRecord = context.#getScopedRecord(name);
                return this.#resolveCached(name, result, scopedRecord, context);
            }
            case "transient":
                return this.#construct(name, result, null, context);
        }
    }
    #initialize(name, context) {
        const registration = this.#items[name];
        if (registration == undefined) return this.#resolve(name, context);
        if (registration.lifetime === "transient") {
            throw new Error(`Transient service '${name}' cannot be initialized by name; resolve and initialize a specific instance instead.`);
        }

        // resolve and select the lifetime-owned initialization record
        const instance = this.#resolve(name, context);
        const result = registration.lifetime === "singleton" ? registration : context.#scopedInstances.get(name);

        return this.#initializeRecord(name, instance, result);
    }
    #initializeRecord(name, instance, result) {
        // Reuse the completed result or the single in-flight/failed operation
        if (result.initializationState === "initialized") return Promise.resolve(instance);
        if (result.initializationPromise) return result.initializationPromise;

        // establish the shared operation before invoking service code to prevent duplicate initialization
        result.initializationState = "initializing";
        result.initializationPromise = Promise.resolve().then(async () => {
            if (typeof instance?.init !== "function") throw new Error(`Service '${name}' does not implement init().`);
            await instance.init.call(instance);
            result.initializationState = "initialized";
            result.initializationPromise = null;
            return instance;
        }).catch(error => {
            result.initializationState = "failed";
            throw error;
        });
        return result.initializationPromise;
    }
    #resolveCached(name, registration, runtime, context) {
        // reuse a completed lifetime-owned instance or construct it once
        if (runtime.instance != null || !registration.implementationItem) return runtime.instance;
        return this.#construct(name, registration, runtime, context);
    }
    #construct(name, registration, runtime, context) {
        // detect cycles coherently across singleton, scoped, and transient construction
        const cycleStart = this.#creationPath.findIndex(frame => frame.name === name);
        if (cycleStart !== -1) {
            const cycle = [...this.#creationPath.slice(cycleStart).map(frame => frame.name), name].join(" -> ");
            throw new Error(`Circular service dependency detected: ${cycle}`);
        }
        if (!registration.implementationItem) return null;

        // validate and construct with dependencies resolving through the owning context
        if (runtime) runtime.state = "creating";
        this.#creationPath.push({ name, lifetime: registration.lifetime });
        try {
            const dependencies = new Proxy({}, {
                get: (target, prop) => prop === "services" ? context
                    : prop === "scopeContext" ? context.#context
                    : typeof prop === "string" ? context.resolve(prop) : undefined
            });
            const options = registration.options ?? {};
            this.#validateOptions(name, registration.implementationItem.class, options);
            const instance = new registration.implementationItem.class(dependencies, options);
            this.#validateImplementation(name, instance, registration.contractItem);
            if (runtime) {
                runtime.instance = instance;
                runtime.state = "created";
            }
            if (registration.lifetime !== "singleton" && typeof instance?.dispose === "function") context.addDisposable(instance);
            this.#bus?.emit("xshell:service:created", { id: name });
            return instance;
        } catch (error) {
            if (runtime) {
                runtime.instance = null;
                runtime.state = "registered";
            }
            throw error;
        } finally {
            this.#creationPath.pop();
        }
    }
    #validateLifetimeResolution(name, registration, context) {
        if (registration.lifetime !== "scoped") return;

        // reject scoped capture anywhere beneath an active singleton construction
        const singleton = this.#creationPath.find(frame => frame.lifetime === "singleton");
        const chain = [...this.#creationPath.map(frame => frame.name), name].join(" -> ");
        if (singleton) {
            throw new Error(`Invalid service lifetime dependency: singleton service '${singleton.name}' cannot depend on scoped service '${name}' (dependency chain: ${chain}).`);
        }

        // require an explicit child scope for every scoped instance
        if (context === this) {
            const suffix = this.#creationPath.length ? ` (dependency chain: ${chain})` : "";
            throw new Error(`Scoped service '${name}' requires an explicit child Services scope${suffix}.`);
        }
    }
    #getScopedRecord(name) {
        // create only scope-local runtime state while definitions remain root-owned
        let record = this.#scopedInstances.get(name);
        if (!record) {
            record = { instance: null, state: "registered", initializationState: "not-initialized", initializationPromise: null };
            this.#scopedInstances.set(name, record);
        }
        return record;
    }
    #getServiceInfo(id) {
        return Object.hasOwn(this.#items, id) ? this.#projectServiceInfo(id, this.#items[id]) : undefined;
    }
    #assertActive() {
        // reject operations when this scope or any ancestor has begun disposal
        let current = this;
        while (current) {
            if (current.#lifecycleState !== "active") {
                const owner = current === this ? "Services scope" : "Ancestor Services scope";
                throw new Error(`${owner} is ${current.#lifecycleState}.`);
            }
            current = current.#parent;
        }
    }
    async #disposeScope() {
        // continue reverse-order cleanup while retaining every failure
        const errors = [];
        try {
            for (const child of [...this.#children].reverse()) {
                try {
                    await child.dispose();
                } catch (error) {
                    errors.push(error);
                }
            }

            // wait for scope-owned initialization before disposing its instances
            for (const record of this.#scopedInstances.values()) {
                if (record.initializationState === "initializing" && record.initializationPromise) {
                    try {
                        await record.initializationPromise;
                    } catch {
                        // initialization callers retain the original failure independently of cleanup
                    }
                }
            }
            for (const resource of [...this.#disposables].reverse()) {
                try {
                    await resource.dispose();
                } catch (error) {
                    errors.push(error);
                }
            }
        } finally {
            // release owned references and detach this completed scope from its parent
            this.#children.length = 0;
            this.#disposables.length = 0;
            this.#disposableSet.clear();
            this.#scopedInstances.clear();
            this.#context = null;
            this.#parent?.#removeChild(this);
            this.#lifecycleState = "disposed";
        }

        // preserve a single failure and aggregate independent cleanup failures
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, "Multiple errors occurred while disposing a Services scope.");
    }
    #removeChild(child) {
        // remove only the completed direct child while preserving sibling order
        const index = this.#children.indexOf(child);
        if (index !== -1) this.#children.splice(index, 1);
    }
    #projectServiceInfo(id, item) {
        // expose scalar metadata without retaining references to runtime objects
        const contractId = item.contractItem?.id;
        const contractUrl = item.contractItem?.url;
        const description = item.contractItem?.contract?.description;
        const label = item.contractItem?.contract?.label;
        const icon = item.contractItem?.contract?.icon;
        const tags = item.contractItem?.contract?.tags;
        const moduleId = item.implementationItem?.moduleId;
        const isSingleton = item.lifetime === "singleton";
        return Object.freeze({
            id,
            lifetime: item.lifetime,
            state: isSingleton ? item.state : "registered",
            initializationState: isSingleton ? item.initializationState : "not-initialized",
            contractId: typeof contractId === "string" ? contractId : null,
            contractUrl: typeof contractUrl === "string" ? contractUrl : null,
            label: typeof label === "string" ? label : null,
            description: typeof description === "string" ? description : null,
            icon: typeof icon === "string" ? icon : null,
            tags: Object.freeze(Array.isArray(tags) ? [...tags] : []),
            moduleId: typeof moduleId === "string" ? moduleId : null,
            implementationName: item.implementationItem?.class?.name ?? null,
            url: item.implementationItem?.url ?? null,
            size: item.implementationItem?.size ?? null,
            time: item.implementationItem?.time ?? null
        });
    }
    #validateOptions(serviceName, implementation, options) {
        let schema;
        try {
            schema = implementation?.optionsSchema;
        } catch (cause) {
            throw new Error(`Service '${serviceName}' has an invalid static optionsSchema: ${cause.message}`, { cause });
        }
        if (schema === undefined) {
            throw new Error(`Service '${serviceName}' implementation must define a static optionsSchema object.`);
        }
        if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
            throw new Error(`Service '${serviceName}' has an invalid static optionsSchema: expected a JSON Schema object.`);
        }

        let optionsResult;
        try {
            optionsResult = this.#jsonValidator.validate(options, schema);
        } catch (cause) {
            throw new Error(`Service '${serviceName}' has an invalid static optionsSchema: ${cause.message}`, { cause });
        }
        if (!optionsResult.valid) {
            throw new Error(`Invalid options for service '${serviceName}'${this.#formatValidationFailure(optionsResult.errors)}.`, {
                cause: optionsResult.errors
            });
        }
    }
    #formatValidationFailure(errors) {
        const wrappers = new Set(["$ref", "anyOf", "oneOf", "allOf", "properties", "items", "false"]);
        const detail = errors?.findLast(error => error.instanceLocation && error.error && !wrappers.has(error.keyword)) ?? errors?.at(-1);
        if (!detail) return "";
        return ` at '${detail.instanceLocation ?? "#"}': ${detail.error}`;
    }
    #validateImplementation(serviceName, instance, contractItem) {
        // validate the reliable callable surface declared by the contract
        for (const methodName of Object.keys(contractItem?.contract?.methods || {})) {
            if (typeof instance?.[methodName] !== "function") {
                throw new Error(`Service '${serviceName}' does not implement required method '${methodName}'.`);
            }
        }
        // validate declared properties without reading values or invoking accessors
        for (const propertyName of Object.keys(contractItem?.contract?.properties || {})) {
            if (!this.#findPropertyDescriptor(instance, propertyName)) {
                throw new Error(`Service '${serviceName}' does not implement required property '${propertyName}'.`);
            }
        }
    }
    #findPropertyDescriptor(instance, propertyName) {
        // walk the instance and prototype chain so getters remain unexecuted
        let current = instance;
        while (current && current !== Object.prototype) {
            const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
            if (descriptor) return descriptor;
            current = Object.getPrototypeOf(current);
        }
        return undefined;
    }

};


