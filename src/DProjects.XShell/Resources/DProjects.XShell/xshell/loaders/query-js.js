import JsonValidator from "../services/json-validator.js";
import { deepFreeze } from "../utils/object.js";

export default class LoaderQueryJs {

    async load(src, context) {
        // Import the module and preserve HTTP diagnostics on failed imports.
        let imported;
        try {
            imported = await import(src);
        } catch (error) {
            try {
                const response = await fetch(src, {cache: "no-store"});
                if (!response.ok) {
                    error.code = response.status;
                    error.message = `Failed to fetch ${src}:`;
                    error.details = await response.text();
                }
            } catch {
                // Network or CORS error.
            }
            throw error;
        }

        // Validate the definition and its factory before exposing the immutable contract.
        const definition = await imported.default;
        if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
            throw new Error(`Invalid query '${src}': expected a definition object.`);
        }
        if (typeof definition.controller !== "function") throw new Error(`Invalid query '${src}': controller must be a function.`);
        const schema = await context.services.loader.load("schema:query");
        const validation = new JsonValidator().validate({...definition, controller: {}}, schema);
        if (!validation.valid) throw new Error(`Invalid query '${src}'.`, {cause: validation.errors});

        deepFreeze(definition);
        const moduleId = context.resourceDefinition.moduleId;

        // Cache the class while keeping the scope and controller local to an invocation.
        return class Query {
            #scope;
            #invocationContext;

            static get contract() {
                return definition.contract;
            }

            constructor(invocationContext = {}) {
                this.#invocationContext = invocationContext;
                this.#scope = context.services.services.beginScope();
            }

            async query(...args) {
                // Construct the controller after the caller can take responsibility for scope disposal.
                const provider = new Proxy({}, {
                    get: (target, prop) => {
                        if (prop === "definition") return definition;
                        if (prop === "context") return this.#invocationContext;
                        if (prop === "moduleConfig") return context.services.config.modules[moduleId];
                        if (prop === "module") return context.services.modules.getModuleById(moduleId);
                        if (prop === "services") return this.#scope;
                        if (typeof prop === "string") return this.#scope.resolve(prop);
                    }
                });
                const controller = await definition.controller(provider);
                if (!controller || typeof controller !== "object" || Array.isArray(controller) || typeof controller.query !== "function") {
                    throw new Error(`Invalid query '${src}': controller must return an object implementing query().`);
                }
                return controller.query(...args);
            }

            dispose() {
                return this.#scope.dispose();
            }
        };
    }
}
