
 // Generic invocation page. V1 supports Commands only.


function methodToJsonSchema(method, types = {}) {
    const properties = {};
    const required = [];
    const supported = new Set([
        "type", "title", "description", "default", "enum", "format", "writeOnly",
        "minLength", "maxLength", "pattern", "minimum", "maximum",
        "properties", "required", "additionalProperties"
    ]);

    for (const parameter of method.parameters || []) {
        if (["__proto__", "prototype", "constructor"].includes(parameter.name)) {
            throw new Error(`Unsupported parameter name '${parameter.name}'.`);
        }
        if (Object.hasOwn(properties, parameter.name)) throw new Error(`Duplicate parameter '${parameter.name}'.`);

        const namedType = parameter.ref && Object.hasOwn(types, parameter.ref) ? types[parameter.ref] : null;
        if (parameter.ref && !namedType) throw new Error(`Unknown parameter type '${parameter.ref}' for '${parameter.name}'.`);

        const type = parameter.type || namedType?.type;
        if (["array", "any", "function"].includes(type)) {
            throw new Error(`Parameter '${parameter.name}' has unsupported type '${type}' for x-schema.`);
        }
        if (!["string", "number", "integer", "boolean", "date", "object"].includes(type)) {
            throw new Error(`Parameter '${parameter.name}' has unknown type '${type}'.`);
        }

        const constraints = parameter.schema ?? namedType?.schema ?? {};
        if (constraints === false) throw new Error(`Parameter '${parameter.name}' has an unsatisfiable schema.`);
        if (constraints !== true && (constraints === null || typeof constraints !== "object" || Array.isArray(constraints))) {
            throw new Error(`Parameter '${parameter.name}' has an invalid schema.`);
        }

        const definition = constraints === true ? {} : { ...constraints };
        const unsupported = Object.keys(definition).find(key => !supported.has(key));
        if (unsupported) throw new Error(`Parameter '${parameter.name}' uses unsupported schema keyword '${unsupported}'.`);

        const schemaType = type === "date" ? "string" : type;
        if (definition.type !== undefined && definition.type !== schemaType) {
            throw new Error(`Parameter '${parameter.name}' schema type '${definition.type}' is incompatible with '${type}'.`);
        }
        if (definition.format !== undefined && (type !== "date" || definition.format !== "date")) {
            throw new Error(`Parameter '${parameter.name}' uses unsupported format '${definition.format}'.`);
        }
        for (const key of ["title", "description"]) {
            if (definition[key] !== undefined && typeof definition[key] !== "string") {
                throw new Error(`Parameter '${parameter.name}' has an invalid '${key}' annotation.`);
            }
        }
        if (definition.writeOnly !== undefined && typeof definition.writeOnly !== "boolean") {
            throw new Error(`Parameter '${parameter.name}' has an invalid 'writeOnly' annotation.`);
        }
        for (const key of ["minLength", "maxLength"]) {
            if (definition[key] !== undefined && (!Number.isInteger(definition[key]) || definition[key] < 0)) {
                throw new Error(`Parameter '${parameter.name}' has an invalid '${key}' constraint.`);
            }
        }
        for (const key of ["minimum", "maximum"]) {
            if (definition[key] !== undefined && (typeof definition[key] !== "number" || !Number.isFinite(definition[key]))) {
                throw new Error(`Parameter '${parameter.name}' has an invalid '${key}' constraint.`);
            }
        }
        if (definition.pattern !== undefined) {
            if (typeof definition.pattern !== "string") throw new Error(`Parameter '${parameter.name}' has an invalid 'pattern' constraint.`);
            try { new RegExp(definition.pattern); }
            catch { throw new Error(`Parameter '${parameter.name}' has an invalid 'pattern' constraint.`); }
        }

        const stringKeywords = ["format", "writeOnly", "minLength", "maxLength", "pattern"];
        const numberKeywords = ["minimum", "maximum"];
        const objectKeywords = ["properties", "required", "additionalProperties"];
        const allowed = schemaType === "string" ? stringKeywords : schemaType === "object" ? objectKeywords :
            ["number", "integer"].includes(schemaType) ? numberKeywords : [];
        const incompatible = [...stringKeywords, ...numberKeywords, ...objectKeywords]
            .find(key => Object.hasOwn(definition, key) && !allowed.includes(key));
        if (incompatible) {
            throw new Error(`Parameter '${parameter.name}' uses schema keyword '${incompatible}' with incompatible type '${type}'.`);
        }

        if (schemaType === "object") {
            if (definition.properties !== undefined && (definition.properties === null ||
                typeof definition.properties !== "object" || Array.isArray(definition.properties))) {
                throw new Error(`Parameter '${parameter.name}' has invalid object properties.`);
            }
            if (definition.required !== undefined && (!Array.isArray(definition.required) ||
                !definition.required.every(name => typeof name === "string"))) {
                throw new Error(`Parameter '${parameter.name}' has an invalid required list.`);
            }
            if (definition.additionalProperties !== undefined && typeof definition.additionalProperties !== "boolean" &&
                (definition.additionalProperties === null || typeof definition.additionalProperties !== "object" ||
                Array.isArray(definition.additionalProperties))) {
                throw new Error(`Parameter '${parameter.name}' has invalid additionalProperties.`);
            }
        }

        if (parameter.enum !== undefined && definition.enum !== undefined &&
            JSON.stringify(parameter.enum) !== JSON.stringify(definition.enum)) {
            throw new Error(`Parameter '${parameter.name}' declares incompatible enum constraints.`);
        }

        definition.type = schemaType;
        if (type === "date") definition.format = "date";
        if (parameter.label !== undefined) definition.title = parameter.label;
        if (parameter.description !== undefined) definition.description = parameter.description;
        else if (namedType?.description !== undefined && definition.description === undefined) definition.description = namedType.description;
        if (Object.hasOwn(parameter, "default")) definition.default = parameter.default;
        if (parameter.enum !== undefined) definition.enum = parameter.enum;

        if (definition.enum !== undefined && (schemaType !== "string" ||
            !Array.isArray(definition.enum) || definition.enum.length === 0 ||
            new Set(definition.enum).size !== definition.enum.length ||
            !definition.enum.every(value => typeof value === "string" && !/[|=]/.test(value)))) {
            throw new Error(`Parameter '${parameter.name}' has an enum unsupported by x-schema.`);
        }

        if (schemaType === "string" && /password|passphrase/i.test(parameter.name)) definition.writeOnly = true;

        properties[parameter.name] = definition;
        if (parameter.required === true) required.push(parameter.name);
    }

    return { type: "object", properties, required };
}


function formatResult(value) {
    if (value === undefined) return "";
    try {
        const seen = new WeakSet();
        const text = JSON.stringify(value, (key, item) => {
            if (typeof item === "bigint") return String(item);
            if (typeof item === "function") return "[Function]";
            if (item && typeof item === "object") {
                if (seen.has(item)) return "[Circular]";
                seen.add(item);
            }
            return item;
        }, 2);
        return (text === undefined ? String(value) : text).slice(0, 12000);
    } catch {
        return String(value).slice(0, 12000);
    }
}

// Extend this resolver with Service/Component/Page adapters later.

async function resolveInvocation({ type, id, method }, loader, services, contracts) {
    if (!id) throw new Error("Missing 'id' query parameter.");

    if (type === "command") {
        if (method !== "execute") throw new Error("Commands only expose the 'execute' method.");

        const Command = await loader.load(`command:${id}`);
        const contract = Command.contract;
        if (!contract?.execute) throw new Error(`Command '${id}' has no execute contract.`);

        const instance = new Command({});
        return {
            label: contract.label || id,
            description: contract.description || contract.execute.description || "",
            parameters: contract.execute.parameters || [],
            types: contract.types || {},
            invoke: args => instance.execute(...args)
        };
    }

    if (type === "service") {
        const info = services.getServiceInfo(id);
        if (!info) throw new Error(`Service '${id}' not found.`);
        if (!info.contractId) throw new Error(`Service '${id}' has no registered contract.`);

        const contract = contracts.getContractById(info.contractId);
        if (!contract) throw new Error(`Contract '${info.contractId}' not found.`);

        const definition = Object.hasOwn(contract.methods || {}, method) ? contract.methods[method] : null;
        if (!definition) throw new Error(`Method '${method}' is not declared by Service '${id}'.`);

        const instance = services.resolve(id);
        if (typeof instance[method] !== "function") {
            throw new Error(`Service '${id}' does not implement method '${method}'.`);
        }

        return {
            label: `${contract.label || id} - ${definition.label || method}`,
            description: definition.description || contract.description || "",
            parameters: definition.parameters || [],
            types: contract.types || {},
            invoke: args => instance[method](...args)
        };
    }

    throw new Error(`Unsupported invocation type '${type}'.`);
}


// page
export default {
    contract: {
        properties: {
            type:   { type: "string", default: "command", state: true, query: true },
            id:     { type: "string", default: "", state: true, query: true },
            method: { type: "string", default: "execute", state: true, query: true },
            args:   { type: "object", default: {}, state: true, query: true, queryParser: "json" }
        }
    },
    meta: {
        title: "Invoke",
        description: "Lorem ipsum dolor sit amet."
    },
    style: `
        .invocation { max-width: 46rem; }
        .description { margin-bottom: 1.25em; }
        .error { color: var(--x-datafield-error-color); white-space: pre-wrap; }
        .result { margin-top: 1.25em; }
        .result pre { white-space: pre-wrap; overflow-wrap: anywhere; }
    `,
    template: `
        <div class="invocation">
            <p x-if="state.loading">Loading operation...</p>
            <p x-if="state.error" class="error" x-text="state.error"></p>

            <x-form x-if="state.ready" command="submit">
                <x-schema ref="arguments" x-prop:schema="state.schema" x-prop:value="state.args"
                          x-on:change="argumentsChanged"></x-schema>

                <x-button slot="footer" label="Execute" command="submit" class="submit"
                          x-attr:disabled="state.running"></x-button>
                <x-button slot="footer" x-if="state.isDialog" label="Cancel" command="cancel"
                          class="cancel" x-attr:disabled="state.running"></x-button>
            </x-form>

            <x-button x-if="state.isDialog && !state.ready" label="Close" command="cancel"></x-button>
            <p x-if="state.running">Executing...</p>
            <div x-if="state.completed && !state.isDialog" class="result">
                <strong>Completed</strong>
                <pre x-if="state.hasResult" x-text="state.resultText"></pre>
            </div>
        </div>
    `,
    state: {
        title: "Invoke",
        description: "",
        schema: null,
        loading: true,
        ready: false,
        running: false,
        isDialog: false,
        completed: false,
        hasResult: false,
        resultText: "",
        error: ""
    },
    controller({ state, loader, services, contracts, page }) {
        let invocation = null;
        let alive = true;

        return {
            
            async load() {
                try {
                    const initialArgs = state.args;

                    if (!initialArgs || typeof initialArgs !== "object" ||
                        Array.isArray(initialArgs)) {
                        throw new Error("Invocation arguments must be a JSON object.");
                    }

                    invocation = await resolveInvocation({
                        type: state.type,
                        id: state.id,
                        method: state.method
                    }, loader, services, contracts);

                    state.title = invocation.label;
                    state.description = invocation.description;

                    state.schema = methodToJsonSchema({ parameters: invocation.parameters }, invocation.types);
                    const defaults = Object.entries(state.schema.properties)
                        .filter(([, definition]) => Object.hasOwn(definition, "default"))
                        .map(([name, definition]) => [name, structuredClone(definition.default)]);
                    state.args = { ...Object.fromEntries(defaults), ...initialArgs };

                    page.label = invocation.label;
                    page.description = invocation.description;

                    state.ready = true;
                } catch (error) {
                    state.error = error?.message || String(error);
                    state.ready = false;
                } finally {
                    state.loading = false;
                }
            },

            mount() {
                // mount
                state.isDialog = page.host?.layout === "dialog";
            },

            unload() {
                // unload
                alive = false;
                invocation = null;
            },

            argumentsChanged({ event }) {
                state.args = event.detail.newValue;
            },

            async submit() {
                if (!invocation || !state.ready || state.running) return;
                state.error = "";
                state.completed = false;
                state.hasResult = false;

                const editor = page.host?.querySelector('x-schema[ref="arguments"]');
                const errors = editor?.validate(true) || [
                    { label: "Editor", message: "Schema editor is not available." }
                ];
                if (errors.length) {
                    state.error = errors.map(error => `${error.label || error.path || "Field"}: ${error.message}`).join("; ");
                    return;
                }

                state.running = true;
                try {
                    const args = invocation.parameters.map(parameter => state.args[parameter.name]);
                    const result = await invocation.invoke(args);
                    if (!alive) return;
                    if (state.isDialog) {
                        await page.close(result);
                    } else {
                        state.completed = true;
                        state.hasResult = result !== undefined;
                        state.resultText = formatResult(result);
                    }
                } catch (error) {
                    if (alive) state.error = error?.message || String(error);
                } finally {
                    if (alive) state.running = false;
                }
            },

            cancel() {
                if (state.isDialog && !state.running) page.close(null);
            }
        };
    }
};
