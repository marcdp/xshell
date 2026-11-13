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

        // Clone contract schema constraints because loaded contracts may be deeply frozen.
        const definition = constraints === true ? {} : structuredClone(constraints);
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
        if (Object.hasOwn(parameter, "default")) definition.default = structuredClone(parameter.default);
        if (parameter.enum !== undefined) definition.enum = structuredClone(parameter.enum);

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

        // Return presentation metadata; execution belongs to the Commands service.
        return {
            type: "command",
            label: contract.label || id,
            description: contract.description || contract.execute.description || "",
            parameters: contract.execute.parameters || [],
            types: contract.types || {},
            returns: contract.execute.returns || null
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
            type: "service",
            label: `${contract.label || id} - ${definition.label || method}`,
            description: definition.description || contract.description || "",
            parameters: definition.parameters || [],
            types: contract.types || {},
            returns: definition.returns || null,
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

    // Styles invocation errors, task output and result presentation.
    style: `
        .description { margin-bottom:1.25em; }
        .error { color:var(--x-datafield-error-color); white-space:pre-wrap; }
        
        .task { margin-top:1.25em; }
        .task x-progress { margin-top:.75em; }
        .output { margin-top:1em; }
        .output-entry { display:grid; grid-template-columns:4.5em minmax(0, 1fr); gap:.75em; align-items:start; }
        .output-entry strong { font-family:monospace; font-size:.85em; text-transform:uppercase; }
        .output-entry.warn strong, .output-entry.warn pre { color:var(--x-notice-color-warning); }
        .output-entry.error strong, .output-entry.error pre { color:var(--x-datafield-error-color); }
        .output-entry pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
        .result { margin-top:1.25em; }
        .result pre { white-space:pre-wrap; overflow-wrap:anywhere; }
        .result-value { white-space:pre-wrap; overflow-wrap:anywhere; }
    `,

    // Renders loading/error state, generated arguments form, execution controls and result.
    template: `
        <p x-if="state.loading">Loading operation...</p>
        <p x-if="state.error" class="error" x-text="state.error"></p>

        <x-form x-if="state.ready" command="submit">
            <!--<x-schema ref="arguments" x-prop:schema="state.schema" x-prop:value="state.args" x-on:change="argumentsChanged"></x-schema>-->
            <x-schema ref="arguments" x-prop:schema="state.schema" x-model="state.args"></x-schema>

            <x-details label="Advanced">
                <x-datafield type="checkbox" label="Execution" label-secondary="Run the command in background" x-model="state.background"></x-datafield>
            </x-details>

            <x-button slot="footer" label="Execute" command="submit" class="submit" x-attr:disabled="state.running"></x-button>
            <x-button slot="footer" x-if="state.isDialog || state.running" label="Cancel" command="cancel" class="cancel"></x-button>
        </x-form>

        <x-button x-if="state.isDialog && !state.ready" label="Close" command="cancel"></x-button>

        <section x-if="state.taskStatus" class="task">
            <x-notice
                x-attr:type="state.taskNoticeType"
                x-attr:label="state.taskNoticeLabel"
                x-attr:message="state.taskError ? state.taskError.message : state.taskDescription">
            </x-notice>

            <x-progress
                x-if="state.running"
                x-attr:unknown="state.taskProgress ? false : true"
                x-attr:value="state.taskProgress.value"
                x-attr:max="state.taskProgress.max">
            </x-progress>

            <div x-if="state.taskOutput.length > 0" class="output">
                <div x-for="entry in state.taskOutput" x-attr:class="'output-entry ' + entry.level">
                    <strong x-text="entry.level"></strong>
                    <pre x-text="entry.text"></pre>
                </div>
            </div>
        </section>

        <div x-if="state.completed && !state.isDialog" class="result">
            <x-object x-if="state.hasResult && !state.resultFormat && (!state.resultType || state.resultType == 'object' || state.resultType == 'array' || state.resultType == 'any' || state.resultType == 'function' || state.resultType == 'date')"
                x-prop:value="state.result" expanded></x-object>
            <x-code x-if="state.hasResult && state.resultFormat == 'text'" x-prop:value="state.result" wrap></x-code>
            <x-anchor x-if="state.hasResult && (state.resultFormat == 'url' || state.resultFormat == 'blob-url')"
                x-prop:href="state.result" target="_blank" rel="noopener noreferrer"><span x-text="state.result"></span></x-anchor>
            <span x-if="state.hasResult && !state.resultFormat && state.resultType && state.resultType != 'object' && state.resultType != 'array' && state.resultType != 'any' && state.resultType != 'function' && state.resultType != 'date' && state.resultType != 'void'"
                class="result-value" x-text="state.result"></span>
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
        background: false,
        isDialog: false,
        completed: false,
        hasResult: false,
        result: undefined,
        resultType: "",
        resultFormat: "",
        error: "",
        taskStatus: "",
        taskDescription: "",
        taskProgress: null,
        taskOutput: [],
        taskError: null,
        taskNoticeType: "",
        taskNoticeLabel: ""
    },

    // Coordinates invocation resolution, argument editing, validation and execution.
    controller({ state, loader, services, contracts, page, commands }) {
        // Store the resolved invocation adapter and Page lifetime state privately.
        let invocation = null;
        let currentTask = null;
        let taskListener = null;
        let outputRevision = 0;
        let alive = true;
        let submitting = false;

        // Stop observing the previous invocation Task.
        const detachTask = () => {
            if (currentTask && taskListener) currentTask.removeEventListener("change", taskListener);
            taskListener = null;
        };

        // Project a Task handle into plain Page state and retrieve its ordered output.
        const refreshTask = async task => {
            if (!alive || task !== currentTask) return;

            const revision = ++outputRevision;
            state.taskStatus = task.status;
            state.taskDescription = task.description;
            state.taskProgress = task.progress ? { ...task.progress } : null;
            state.taskError = task.error ? { ...task.error } : null;
            state.running = task.status === "pending" || task.status === "running";
            state.completed = task.status === "finished";
            state.taskNoticeType = task.status === "finished" ? "success" :
                task.status === "error" ? "error" : task.status === "canceled" ? "warning" : "working";
            state.taskNoticeLabel = task.status === "finished" ? "Completed" :
                task.status === "error" ? "Failed" : task.status === "canceled" ? "Canceled" : "Executing";

            const output = [];
            let cursor;
            while (true) {
                const outputPage = await task.getOutput({ cursor, limit: 1000 });
                output.push(...outputPage.entries.map(entry => ({ ...entry })));
                cursor = outputPage.nextCursor;
                if (outputPage.entries.length < 1000) break;
            }

            if (!alive || task !== currentTask || revision !== outputRevision) return;
            state.taskOutput = output;
            page.invalidate?.();
        };

        // Observe one Task until it reaches a terminal state or is replaced.
        const attachTask = task => {
            detachTask();
            currentTask = task;
            taskListener = () => { void refreshTask(task); };
            task.addEventListener("change", taskListener);
            void refreshTask(task);
        };

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

                    // Publish invocation and return presentation metadata to Page state.
                    state.title = invocation.label;
                    state.description = invocation.description;
                    state.resultType = invocation.returns?.type || invocation.types[invocation.returns?.ref]?.type || "";
                    state.resultFormat = invocation.returns?.format || "";

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
                const task = currentTask;
                detachTask();
                currentTask = null;
                invocation = null;

                // Page-owned foreground Tasks do not outlive their invocation Page.
                if (task && !task.background && (task.status === "pending" || task.status === "running")) void task.cancel();
            },

            // Synchronizes generated x-schema edits back into Page argument state.
            argumentsChanged({ event }) {
                if (state.args !== event.detail.newValue) state.args = event.detail.newValue;
                state.preview = structuredClone(event.detail.newValue);
            },

            // Validates arguments and delegates Command execution to the Commands service.
            async submit() {
                // Ignore invalid or concurrent submission attempts.
                if (!invocation || !state.ready || state.running || submitting) return;

                // Reset previous execution result and error state.
                state.error = "";
                state.completed = false;
                state.hasResult = false;
                state.result = undefined;
                state.taskStatus = "";
                state.taskDescription = "";
                state.taskProgress = null;
                state.taskOutput = [];
                state.taskError = null;
                state.taskNoticeType = "";
                state.taskNoticeLabel = "";

                // Validate the generated argument editor before execution.
                const editor = page.host?.querySelector('x-schema[ref="arguments"]');
                const errors = editor?.validate(true) || [{ label: "Editor", message: "Schema editor is not available." }];

                // Stop execution and present validation failures.
                if (errors.length) {
                    state.error = errors.map(error => `${error.label || error.path || "Field"}: ${error.message}`).join("; ");
                    return;
                }

                // Preserve direct shared-instance invocation for ordinary Service methods.
                if (invocation.type === "service") {
                    submitting = true;
                    try {
                        const args = invocation.parameters.map(parameter => state.args[parameter.name]);
                        const result = await invocation.invoke(args);
                        if (!alive) return;
                        state.completed = true;
                        state.hasResult = result !== undefined;
                        state.result = result;
                        if (state.isDialog) await page.close(result);
                    } catch (error) {
                        state.error = error?.message || String(error);
                    } finally {
                        submitting = false;
                    }
                    return;
                }

                // The Commands service owns argument preparation, validation and Task creation.
                let task;
                submitting = true;
                try {
                    task = await commands.run({
                        id: state.id,
                        args: state.args,
                        background: state.background
                    });
                } catch (error) {
                    state.error = error?.message || String(error);
                    return;
                } finally {
                    submitting = false;
                }
                attachTask(task);
                await task.wait();
                await refreshTask(task);

                // Stop observing terminal Tasks after their final projection.
                if (task === currentTask) detachTask();
                if (!alive || task !== currentTask || task.status !== "finished") return;

                const result = await task.getResult();
                if (!alive || task !== currentTask) return;
                state.hasResult = result !== undefined;
                state.result = result;

                // Close successful dialog invocations with the Command result.
                if (state.isDialog) await page.close(result);
            },

            // Cancels an active Task, or closes an idle dialog invocation.
            async cancel() {
                if (currentTask && state.running) {
                    await currentTask.cancel();
                    await currentTask.wait();
                    await refreshTask(currentTask);
                } else if (state.isDialog) {
                    await page.close(null);
                }
            }
        };
    }
};
