// Converts a method contract into the JSON Schema consumed by x-schema.
function methodToJsonSchema(method, types = {}) {
    // Initialize generated schema collections and supported keywords.
    const properties = {};
    const required = [];
    const supported = new Set([
        "type", "title", "description", "default", "enum", "format", "writeOnly",
        "minLength", "maxLength", "pattern", "minimum", "maximum",
        "properties", "required", "additionalProperties"
    ]);

    // Convert every method parameter into a JSON Schema property.
    for (const parameter of method.parameters || []) {
        // Reject unsafe or duplicate parameter names.
        if (["__proto__", "prototype", "constructor"].includes(parameter.name)) throw new Error(`Unsupported parameter name '${parameter.name}'.`);
        if (Object.hasOwn(properties, parameter.name)) throw new Error(`Duplicate parameter '${parameter.name}'.`);

        // Resolve an optional reusable named contract type.
        const namedType = parameter.ref && Object.hasOwn(types, parameter.ref) ? types[parameter.ref] : null;
        if (parameter.ref && !namedType) throw new Error(`Unknown parameter type '${parameter.ref}' for '${parameter.name}'.`);

        // Resolve and validate the effective parameter type.
        const type = parameter.type || namedType?.type;
        if (["array", "any", "function"].includes(type)) throw new Error(`Parameter '${parameter.name}' has unsupported type '${type}' for x-schema.`);
        if (!["string", "number", "integer", "boolean", "date", "object"].includes(type)) throw new Error(`Parameter '${parameter.name}' has unknown type '${type}'.`);

        // Resolve and validate the optional parameter schema constraints.
        const constraints = parameter.schema ?? namedType?.schema ?? {};
        if (constraints === false) throw new Error(`Parameter '${parameter.name}' has an unsatisfiable schema.`);
        if (constraints !== true && (constraints === null || typeof constraints !== "object" || Array.isArray(constraints))) {
            throw new Error(`Parameter '${parameter.name}' has an invalid schema.`);
        }

        // Copy the schema definition and reject unsupported schema keywords.
        const definition = constraints === true ? {} : { ...constraints };
        const unsupported = Object.keys(definition).find(key => !supported.has(key));
        if (unsupported) throw new Error(`Parameter '${parameter.name}' uses unsupported schema keyword '${unsupported}'.`);

        // Normalize date parameters to JSON Schema strings and validate explicit type/format constraints.
        const schemaType = type === "date" ? "string" : type;
        if (definition.type !== undefined && definition.type !== schemaType) {
            throw new Error(`Parameter '${parameter.name}' schema type '${definition.type}' is incompatible with '${type}'.`);
        }
        if (definition.format !== undefined && (type !== "date" || definition.format !== "date")) {
            throw new Error(`Parameter '${parameter.name}' uses unsupported format '${definition.format}'.`);
        }

        // Validate descriptive schema annotations.
        for (const key of ["title", "description"]) {
            if (definition[key] !== undefined && typeof definition[key] !== "string") {
                throw new Error(`Parameter '${parameter.name}' has an invalid '${key}' annotation.`);
            }
        }

        // Validate the write-only annotation.
        if (definition.writeOnly !== undefined && typeof definition.writeOnly !== "boolean") {
            throw new Error(`Parameter '${parameter.name}' has an invalid 'writeOnly' annotation.`);
        }

        // Validate string length constraints.
        for (const key of ["minLength", "maxLength"]) {
            if (definition[key] !== undefined && (!Number.isInteger(definition[key]) || definition[key] < 0)) {
                throw new Error(`Parameter '${parameter.name}' has an invalid '${key}' constraint.`);
            }
        }

        // Validate numeric range constraints.
        for (const key of ["minimum", "maximum"]) {
            if (definition[key] !== undefined && (typeof definition[key] !== "number" || !Number.isFinite(definition[key]))) {
                throw new Error(`Parameter '${parameter.name}' has an invalid '${key}' constraint.`);
            }
        }

        // Validate regular-expression constraints.
        if (definition.pattern !== undefined) {
            if (typeof definition.pattern !== "string") throw new Error(`Parameter '${parameter.name}' has an invalid 'pattern' constraint.`);
            try { new RegExp(definition.pattern); }
            catch { throw new Error(`Parameter '${parameter.name}' has an invalid 'pattern' constraint.`); }
        }

        // Reject schema keywords that are incompatible with the parameter type.
        const stringKeywords = ["format", "writeOnly", "minLength", "maxLength", "pattern"];
        const numberKeywords = ["minimum", "maximum"];
        const objectKeywords = ["properties", "required", "additionalProperties"];
        const allowed = schemaType === "string" ? stringKeywords : schemaType === "object" ? objectKeywords : ["number", "integer"].includes(schemaType) ? numberKeywords : [];
        const incompatible = [...stringKeywords, ...numberKeywords, ...objectKeywords].find(key => Object.hasOwn(definition, key) && !allowed.includes(key));
        if (incompatible) throw new Error(`Parameter '${parameter.name}' uses schema keyword '${incompatible}' with incompatible type '${type}'.`);

        // Validate object-specific schema constraints.
        if (schemaType === "object") {
            if (definition.properties !== undefined && (definition.properties === null || typeof definition.properties !== "object" || Array.isArray(definition.properties))) {
                throw new Error(`Parameter '${parameter.name}' has invalid object properties.`);
            }
            if (definition.required !== undefined && (!Array.isArray(definition.required) || !definition.required.every(name => typeof name === "string"))) {
                throw new Error(`Parameter '${parameter.name}' has an invalid required list.`);
            }
            if (definition.additionalProperties !== undefined && typeof definition.additionalProperties !== "boolean" &&
                (definition.additionalProperties === null || typeof definition.additionalProperties !== "object" || Array.isArray(definition.additionalProperties))) {
                throw new Error(`Parameter '${parameter.name}' has invalid additionalProperties.`);
            }
        }

        // Reject conflicting enum declarations.
        if (parameter.enum !== undefined && definition.enum !== undefined && JSON.stringify(parameter.enum) !== JSON.stringify(definition.enum)) {
            throw new Error(`Parameter '${parameter.name}' declares incompatible enum constraints.`);
        }

        // Apply contract metadata and normalized type information to the generated schema.
        definition.type = schemaType;
        if (type === "date") definition.format = "date";
        if (parameter.label !== undefined) definition.title = parameter.label;
        if (parameter.description !== undefined) definition.description = parameter.description;
        else if (namedType?.description !== undefined && definition.description === undefined) definition.description = namedType.description;
        if (Object.hasOwn(parameter, "default")) definition.default = parameter.default;
        if (parameter.enum !== undefined) definition.enum = parameter.enum;

        // Validate enum values supported by the generated x-schema editor.
        if (definition.enum !== undefined && (schemaType !== "string" || !Array.isArray(definition.enum) || definition.enum.length === 0 ||
            new Set(definition.enum).size !== definition.enum.length || !definition.enum.every(value => typeof value === "string" && !/[|=]/.test(value)))) {
            throw new Error(`Parameter '${parameter.name}' has an enum unsupported by x-schema.`);
        }

        // Automatically mark password-like string parameters as write-only.
        if (schemaType === "string" && /password|passphrase/i.test(parameter.name)) definition.writeOnly = true;

        // Add the completed property and required metadata to the generated schema.
        properties[parameter.name] = definition;
        if (parameter.required === true) required.push(parameter.name);
    }

    // Return the complete object schema used to edit invocation arguments.
    return { type: "object", properties, required };
}


// Resolves invocation metadata without creating per-invocation Command instances.
async function resolveInvocation({ type, id, method }, loader, services, contracts) {
    // Require a target identifier for every invocation.
    if (!id) throw new Error("Missing 'id' query parameter.");

    // Resolve a Command class and expose an invocation factory around its static contract.
    if (type === "command") {
        // Commands currently expose only execute().
        if (method !== "execute") throw new Error("Commands only expose the 'execute' method.");

        // Load the Command class and inspect its static public contract.
        const Command = await loader.load(`command:${id}`);
        const contract = Command.contract;
        if (!contract?.execute) throw new Error(`Command '${id}' has no execute contract.`);

        // Return metadata plus a factory that creates a fresh Command for each execution.
        return {
            label: contract.label || id,
            description: contract.description || contract.execute.description || "",
            parameters: contract.execute.parameters || [],
            types: contract.types || {},
            invoke(args, context = {}) {
                const instance = new Command(context);
                return instance.execute(...args);
            }
        };
    }

    // Resolve a registered Service method while preserving shared Service instance semantics.
    if (type === "service") {
        // Resolve Service registration and contract metadata.
        const info = services.getServiceInfo(id);
        if (!info) throw new Error(`Service '${id}' not found.`);
        if (!info.contractId) throw new Error(`Service '${id}' has no registered contract.`);

        // Resolve the Service contract and selected public method.
        const contract = contracts.getContractById(info.contractId);
        if (!contract) throw new Error(`Contract '${info.contractId}' not found.`);
        const definition = Object.hasOwn(contract.methods || {}, method) ? contract.methods[method] : null;
        if (!definition) throw new Error(`Method '${method}' is not declared by Service '${id}'.`);

        // Resolve the shared Service implementation and verify the method exists.
        const instance = services.resolve(id);
        if (typeof instance[method] !== "function") throw new Error(`Service '${id}' does not implement method '${method}'.`);

        // Return Service invocation metadata and execution adapter.
        return {
            label: `${contract.label || id} - ${definition.label || method}`,
            description: definition.description || contract.description || "",
            parameters: definition.parameters || [],
            types: contract.types || {},
            invoke: args => instance[method](...args)
        };
    }

    // Reject invocation target types not yet supported by this Page.
    throw new Error(`Unsupported invocation type '${type}'.`);
}


// Defines the generic invocation Page.
export default {
    // Declares query-backed public properties identifying the target and arguments.
    contract: {
        properties: {
            type:   { type: "string", default: "command", state: true, query: true },
            id:     { type: "string", default: "", state: true, query: true },
            method: { type: "string", default: "execute", state: true, query: true },
            args:   { type: "object", default: {}, state: true, query: true, queryParser: "json" }
        }
    },

    // Defines Page presentation metadata.
    meta: {
        title: "Invoke",
        description: "Lorem ipsum dolor sit amet."
    },

    // Styles invocation errors and result presentation.
    style: `
        .description { margin-bottom:1.25em; }
        .error { color:var(--x-datafield-error-color); white-space:pre-wrap; }
        .result { margin-top:1.25em; }
        .result pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    `,

    // Renders loading/error state, generated arguments form, execution controls and result.
    template: `
        <p x-if="state.loading">Loading operation...</p>
        <p x-if="state.error" class="error" x-text="state.error"></p>

        <x-form x-if="state.ready" command="submit">
            <x-schema ref="arguments" x-prop:schema="state.schema" x-prop:value="state.args" x-on:change="argumentsChanged"></x-schema>

            <x-button slot="footer" label="Execute" command="submit" class="submit" x-attr:disabled="state.running"></x-button>
            <x-button slot="footer" x-if="state.isDialog" label="Cancel" command="cancel" class="cancel" x-attr:disabled="state.running"></x-button>
        </x-form>

        <x-button x-if="state.isDialog && !state.ready" label="Close" command="cancel"></x-button>
        <p x-if="state.running">Executing...</p>

        <div x-if="state.completed && !state.isDialog" class="result">
            <strong>Completed</strong>
            <x-object x-if="state.hasResult" x-prop:value="state.result" expanded></x-object>
        </div>
    `,

    // Stores Page presentation and invocation execution state.
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
        result: undefined,
        error: ""
    },

    // Coordinates invocation resolution, argument editing, validation and execution.
    controller({ state, loader, services, contracts, page }) {
        // Store the resolved invocation adapter and Page lifetime state privately.
        let invocation = null;
        let alive = true;

        return {
            // Resolves invocation metadata and prepares the generated arguments editor.
            async load() {
                try {
                    // Validate the initial query-supplied arguments object.
                    const initialArgs = state.args;
                    if (!initialArgs || typeof initialArgs !== "object" || Array.isArray(initialArgs)) {
                        throw new Error("Invocation arguments must be a JSON object.");
                    }

                    // Resolve target metadata without instantiating a Command.
                    invocation = await resolveInvocation({
                        type: state.type,
                        id: state.id,
                        method: state.method
                    }, loader, services, contracts);

                    // Publish invocation label and description to Page state.
                    state.title = invocation.label;
                    state.description = invocation.description;

                    // Generate the argument-editing JSON Schema from the method contract.
                    state.schema = methodToJsonSchema({ parameters: invocation.parameters }, invocation.types);

                    // Collect parameter defaults declared by the method contract.
                    const defaults = Object.entries(state.schema.properties)
                        .filter(([, definition]) => Object.hasOwn(definition, "default"))
                        .map(([name, definition]) => [name, structuredClone(definition.default)]);

                    // Merge defaults with explicitly supplied invocation arguments.
                    state.args = { ...Object.fromEntries(defaults), ...initialArgs };

                    // Apply invocation metadata to the hosting Page.
                    page.label = invocation.label;
                    page.description = invocation.description;

                    // Mark the arguments editor as ready.
                    state.ready = true;
                } catch (error) {
                    // Surface invocation-resolution or schema-generation failures.
                    state.error = error?.message || String(error);
                    state.ready = false;
                } finally {
                    // Finish the initial loading state.
                    state.loading = false;
                }
            },

            // Detects whether the invocation Page is running as a dialog.
            mount() {
                state.isDialog = page.host?.layout === "dialog";
            },

            // Marks the controller inactive and releases the invocation adapter.
            unload() {
                alive = false;
                invocation = null;
            },

            // Synchronizes generated x-schema edits back into Page argument state.
            argumentsChanged({ event }) {
                if (state.args !== event.detail.newValue) state.args = event.detail.newValue;
                state.preview = structuredClone(event.detail.newValue);
            },

            // Validates arguments, creates the Command instance and executes the invocation.
            async submit() {
                // Ignore invalid or concurrent submission attempts.
                if (!invocation || !state.ready || state.running) return;

                // Reset previous execution result and error state.
                state.error = "";
                state.completed = false;
                state.hasResult = false;
                state.result = undefined;

                // Validate the generated argument editor before execution.
                const editor = page.host?.querySelector('x-schema[ref="arguments"]');
                const errors = editor?.validate(true) || [{ label: "Editor", message: "Schema editor is not available." }];

                // Stop execution and present validation failures.
                if (errors.length) {
                    state.error = errors.map(error => `${error.label || error.path || "Field"}: ${error.message}`).join("; ");
                    return;
                }

                // Mark the invocation as actively executing.
                state.running = true;

                try {
                    // Convert named argument state into the positional method argument list.
                    const args = invocation.parameters.map(parameter => state.args[parameter.name]);

                    // Execute the invocation; Commands create a fresh instance at this point.
                    const result = await invocation.invoke(args);

                    // Ignore results arriving after the Page has been unloaded.
                    if (!alive) return;

                    // Close dialogs with the returned value.
                    if (state.isDialog) {
                        await page.close(result);
                    } else {
                        // Store successful non-dialog results for presentation.
                        state.completed = true;
                        state.hasResult = result !== undefined;
                        state.result = result;
                    }
                } catch (error) {
                    // Surface execution failures while the Page remains active.
                    if (alive) state.error = error?.message || String(error);
                } finally {
                    // Clear the running state after completion or failure.
                    if (alive) state.running = false;
                }
            },

            // Closes dialog invocations when no execution is currently running.
            cancel() {
                if (state.isDialog && !state.running) page.close(null);
            }
        };
    }
};
