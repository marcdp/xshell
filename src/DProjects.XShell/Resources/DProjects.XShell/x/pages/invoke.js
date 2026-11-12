
 // Generic invocation page. V1 supports Commands only.

function getParameterType(parameter, types) {
    if (parameter.type) return { type: parameter.type, schema: parameter.schema };
    const namedType = Object.hasOwn(types, parameter.ref) ? types[parameter.ref] : null;
    if (!namedType) throw new Error(`Unknown parameter type '${parameter.ref}' for '${parameter.name}'.`);
    return { type: namedType.type, schema: namedType.schema };
}

function createParameter(parameter, types, initialArgs) {
    const { type, schema } = getParameterType(parameter, types);

    if (type === "function") {
        throw new Error(`Function parameter '${parameter.name}' cannot be entered in a form.`);
    }

    const enums = parameter.enum || [];
    const required = parameter.required === true;
    let editor = "text";
    let domain = null;

    if (enums.length) {
        editor = "select";
        domain = enums.map(value => ({ value, label: value }));
    } else if (type === "boolean") {
        editor = "select";
        domain = [
            { value: "true", label: "True" },
            { value: "false", label: "False" }
        ];
    } else if (type === "number" || type === "integer") {
        editor = "number";
    } else if (type === "object" || type === "array" || type === "any") {
        editor = "textarea";
    } else if (type === "string" && /password|passphrase/i.test(parameter.name)) {
        editor = "password";
    }

    // Initial arguments override contract defaults.
    const value = Object.hasOwn(initialArgs, parameter.name)
        ? initialArgs[parameter.name]
        : parameter.default;

    let input = "";
    if (value !== undefined && value !== null) {
        input = ["object", "array", "any"].includes(type)
            ? JSON.stringify(value)
            : String(value);
    } else if (type === "any" && value === null) {
        input = "null";
    }

    if (type === "boolean" && (input === "1" || input === "0")) {
        input = input === "1" ? "true" : "false";
    }

    return {
        name: parameter.name,
        label: parameter.label || parameter.name,
        description: parameter.description || "",
        type,
        schema,
        required,
        enumValues: enums,
        editor,
        domain,
        input
    };
}


function parseParameter(parameter) {
    const raw = parameter.input;
    if (raw === "" || raw === null || raw === undefined) {
        if (parameter.required) throw new Error(`'${parameter.name}' is required.`);
        return undefined;
    }

    let value;
    switch (parameter.type) {
        case "string":
        case "date":
            value = String(raw);
            break;
        case "number":
        case "integer":
            value = Number(raw);
            if (!Number.isFinite(value) ||
                (parameter.type === "integer" && !Number.isInteger(value))) {
                throw new Error(`'${parameter.name}' must be a valid ${parameter.type}.`);
            }
            break;
        case "boolean":
            if (![true, false, "true", "false"].includes(raw)) {
                throw new Error(`'${parameter.name}' must be true or false.`);
            }
            value = raw === true || raw === "true";
            break;
        case "array":
        case "object":
        case "any":
            try {
                value = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch {
                throw new Error(`'${parameter.name}' must contain valid JSON.`);
            }
            if (parameter.type === "array" && !Array.isArray(value)) {
                throw new Error(`'${parameter.name}' must be a JSON array.`);
            }
            if (parameter.type === "object" &&
                (value === null || typeof value !== "object" || Array.isArray(value))) {
                throw new Error(`'${parameter.name}' must be a JSON object.`);
            }
            break;
        default:
            throw new Error(`Unsupported parameter type '${parameter.type}'.`);
    }

    if (parameter.enumValues.length && !parameter.enumValues.includes(value)) {
        throw new Error(`'${parameter.name}' must be one of: ${parameter.enumValues.join(", ")}.`);
    }
    return value;
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
async function resolveInvocation({ type, id, method }, loader) {
    if (type !== "command") throw new Error(`Unsupported invocation type '${type}'.`);
    if (!id) throw new Error("Missing 'id' query parameter.");
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

// page
export default {
    contract: {
        properties: {
            type:   { type: "string", default: "command", state: true, query: true },
            id:     { type: "string", default: "", state: true, query: true },
            method: { type: "string", default: "execute", state: true, query: true },
            args:   { type: "string", default: "{}", state: true, query: true }
        }
    },
    meta: {
        title: "Invoke"
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
                <x-datafields x-if="state.parameters.length > 0">
                    <x-datafield
                        x-for="param in state.parameters"
                        x-key="name"
                        x-attr:type="param.editor"
                        x-attr:label="param.label"
                        x-attr:description="param.description"
                        x-attr:required="param.required"
                        x-attr:disabled="state.running"
                        x-prop:domain="param.domain"
                        x-model="param.input">
                    </x-datafield>
                </x-datafields>
                <p x-if="state.parameters.length == 0">This operation takes no arguments.</p>

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
        parameters: [],
        loading: true,
        ready: false,
        running: false,
        isDialog: false,
        completed: false,
        hasResult: false,
        resultText: "",
        error: ""
    },
    controller({ state, loader, config, page }) {
        let invocation = null;
        let alive = true;
        let JsonValidator = null;

        return {
            
            async load() {
                // load
                try {
                    const initialArgs = JSON.parse(state.args);

                    if (!initialArgs || typeof initialArgs !== "object" ||
                        Array.isArray(initialArgs)) {
                        throw new Error("Invocation arguments must be a JSON object.");
                    }

                    invocation = await resolveInvocation({
                        type: state.type,
                        id: state.id,
                        method: state.method
                    }, loader);

                    state.title = invocation.label;
                    state.description = invocation.description;

                    state.parameters = invocation.parameters.map(parameter =>
                        createParameter(parameter, invocation.types, initialArgs)
                    );

                    page.label = invocation.label;
                    page.description = invocation.description;

                    state.ready = true;
                } catch (error) {
                    state.error = error?.message || String(error);
                    state.ready = false;
                } finally {
                    state.loading = false;
                }
            }
,

            mount() {
                // mount
                state.isDialog = page.host?.layout === "dialog";
            },

            unload() {
                // unload
                alive = false;
                invocation = null;
            },

            async submit() {
                if (!invocation || !state.ready || state.running) return;
                state.running = true;
                state.error = "";
                state.completed = false;
                state.hasResult = false;

                try {
                    const args = state.parameters.map(parseParameter);
                    while (args.length && args[args.length - 1] === undefined) args.pop();

                    // Enforce optional JSON Schema constraints from the command contract.
                    const withSchema = state.parameters.filter(p => p.schema !== undefined);
                    if (withSchema.length && !JsonValidator) {
                        JsonValidator = await loader.load(
                            `esm:${config.xshell.assets.path}/services/json-validator.js`);
                    }
                    const validator = JsonValidator ? new JsonValidator() : null;
                    for (let index = 0; index < state.parameters.length; index++) {
                        const parameter = state.parameters[index];
                        const value = args[index];
                        if (value === undefined || parameter.schema === undefined || parameter.schema === true) continue;
                        if (parameter.schema === false || !validator.validate(value, parameter.schema).valid) {
                            throw new Error(`'${parameter.name}' does not satisfy its schema.`);
                        }
                    }

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
