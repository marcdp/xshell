
import xshell from "../xshell.js";
import JsonValidator from "../services/json-validator.js";
import { deepFreeze } from "../utils/object.js";

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
        const schema = await xshell.loader.load("schema:command");
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

        // Return a class, like the Component/Page loaders. Each instance has
        // its own invocation context and controller.
        return class Command {
            _controller = null;

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
                const servicesProvider = new Proxy({}, {
                    get(target, prop) {
                        debugger
                        if (prop === "context") {
                            return invocationContext;
                        } else if (prop === "definition") {
                            return definition;
                        } else if (prop === "moduleConfig") {
                            return xshell.config.modules[moduleId];
                        } else if (prop === "module") {
                            return xshell.modules.getModuleById(moduleId);
                        } else if (typeof prop === "symbol") {
                            return undefined;
                        }
                        return xshell.services.resolve(prop);
                    }
                });

                const controller = definition.controller(servicesProvider);
                if (!controller || typeof controller.execute !== "function") {
                    throw new Error(`Invalid command '${src}': controller must return an object implementing execute().`);
                }
                this._controller = controller;
            }

            execute(...args) {
                return this._controller.execute(...args);
            }
        };
    }
};
