
import JsonValidator from "../services/json-validator.js";
import { deepFreeze } from "../utils/object.js";

function disposeFailedScope(scope, commandName) {
    // dispose constructor-owned resources without replacing the original synchronous failure
    scope.dispose().catch(error => console.error(`Failed to dispose Services scope for Command '${commandName}' after construction failed.`, error));
}

export default class LoaderCommandJs {

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

        // resolve the exported definition (which may be a promise)
        const definition = await module.default;
        if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
            throw new Error(`Invalid command '${src}': expected a definition object.`);
        }

        // validate the declarative definition using the shared XShell schema
        const schema = await context.services.loader.load("schema:command");
        const definitionObject = Object.fromEntries(
            Object.entries(definition).map(([key, value]) => [key, typeof value === "function" ? {} : value])
        );
        const result = new JsonValidator().validate(definitionObject, schema);
        if (!result.valid) {
            console.error(`Invalid command: ${src}`, result.errors);
            throw new Error(`Invalid command: ${src}`, { cause: result.errors });
        }
        if (typeof definition.controller !== "function") {
            throw new Error(`Invalid command '${src}': controller must be a function.`);
        }

        // Command contracts and definitions are immutable after loading
        deepFreeze(definition);
        const moduleId = context.resourceDefinition.moduleId;

        // Return a class, like the Component/Page loaders, with instance-owned context, controller, and Services scope
        return class Command {
            _controller = null;
            _servicesScope = null;

            static get contract() {
                return definition.contract;
            }
            get contract() {
                return definition.contract;
            }
            get controller() {
                return this._controller;
            }

            constructor(invocationContext = {}) {
                // create this Command's independent direct child of the application root scope
                const rootServices = context.services.services;
                this._servicesScope = rootServices.beginScope();
                try {
                    // resolve controller dependencies through the Command-owned scope
                    const servicesProvider = new Proxy({}, {
                        get: (target, prop) => {
                            if (prop === "definition") {
                                return definition;
                            } else if (prop === "context") {
                                return invocationContext;
                            } else if (prop === "task") {
                                return invocationContext.task;
                            } else if (prop === "moduleConfig") {
                                return context.services.config.modules[moduleId];
                            } else if (prop === "module") {
                                return context.services.modules.getModuleById(moduleId);
                            } else if (prop === "services") {
                                return this._servicesScope;
                            } else if (typeof prop === "symbol") {
                                return undefined;
                            } else {
                                return this._servicesScope.resolve(prop);
                            }
                        }
                    });

                    // construct and validate the Command controller
                    const controller = definition.controller(servicesProvider);
                    if (!controller || typeof controller.execute !== "function") {
                        throw new Error(`Invalid command '${src}': controller must return an object implementing execute().`);
                    }
                    this._controller = controller;
                } catch (error) {
                    // initiate asynchronous cleanup while preserving synchronous constructor behavior
                    const scope = this._servicesScope;
                    this._controller = null;
                    this._servicesScope = null;
                    disposeFailedScope(scope, definition.contract?.label ?? src);
                    throw error;
                }
            }

            execute(...args) {
                return this._controller.execute(...args);
            }
            async dispose() {
                // dispose the owner scope and clear Command-owned references even when cleanup fails
                const servicesScope = this._servicesScope;
                try {
                    if (servicesScope) await servicesScope.dispose();
                } finally {
                    this._controller = null;
                    this._servicesScope = null;
                }
            }
        };
    }
};
