
function methodToJsonSchema(method, types = {}) {
    const properties = {};
    const required = [];
    const supported = new Set([
        "type", "title", "description", "default", "enum", "format", "writeOnly",
        "minLength", "maxLength", "pattern", "minimum", "maximum",
        "properties", "required", "additionalProperties"
    ]);

    for (const parameter of method.parameters || []) {
        if (["__proto__", "prototype", "constructor"].includes(parameter.name)) throw new Error(`Unsupported parameter name '${parameter.name}'.`);
        if (Object.hasOwn(properties, parameter.name)) throw new Error(`Duplicate parameter '${parameter.name}'.`);

        const namedType = parameter.ref && Object.hasOwn(types, parameter.ref) ? types[parameter.ref] : null;
        if (parameter.ref && !namedType) throw new Error(`Unknown parameter type '${parameter.ref}' for '${parameter.name}'.`);

        const type = parameter.type || namedType?.type;
        if (["array", "any", "function"].includes(type)) throw new Error(`Parameter '${parameter.name}' has unsupported type '${type}' for x-schema.`);
        if (!["string", "number", "integer", "boolean", "date", "object"].includes(type)) throw new Error(`Parameter '${parameter.name}' has unknown type '${type}'.`);

        const constraints = parameter.schema ?? namedType?.schema ?? {};
        if (constraints === false) throw new Error(`Parameter '${parameter.name}' has an unsatisfiable schema.`);
        if (constraints !== true && (constraints === null || typeof constraints !== "object" || Array.isArray(constraints))) {
            throw new Error(`Parameter '${parameter.name}' has an invalid schema.`);
        }

        const definition = constraints === true ? {} : structuredClone(constraints);
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
        const allowed = schemaType === "string" ? stringKeywords : schemaType === "object" ? objectKeywords : ["number", "integer"].includes(schemaType) ? numberKeywords : [];
        const incompatible = [...stringKeywords, ...numberKeywords, ...objectKeywords].find(key => Object.hasOwn(definition, key) && !allowed.includes(key));
        if (incompatible) throw new Error(`Parameter '${parameter.name}' uses schema keyword '${incompatible}' with incompatible type '${type}'.`);

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

        if (parameter.enum !== undefined && definition.enum !== undefined && JSON.stringify(parameter.enum) !== JSON.stringify(definition.enum)) {
            throw new Error(`Parameter '${parameter.name}' declares incompatible enum constraints.`);
        }

        definition.type = schemaType;
        if (type === "date") definition.format = "date";
        if (parameter.label !== undefined) definition.title = parameter.label;
        if (parameter.description !== undefined) definition.description = parameter.description;
        else if (namedType?.description !== undefined && definition.description === undefined) definition.description = namedType.description;
        if (Object.hasOwn(parameter, "default")) definition.default = structuredClone(parameter.default);
        if (parameter.enum !== undefined) definition.enum = structuredClone(parameter.enum);

        if (definition.enum !== undefined && (schemaType !== "string" || !Array.isArray(definition.enum) || definition.enum.length === 0 ||
            new Set(definition.enum).size !== definition.enum.length || !definition.enum.every(value => typeof value === "string" && !/[|=]/.test(value)))) {
            throw new Error(`Parameter '${parameter.name}' has an enum unsupported by x-schema.`);
        }

        if (schemaType === "string" && /password|passphrase/i.test(parameter.name)) definition.writeOnly = true;

        properties[parameter.name] = definition;
        if (parameter.required === true) required.push(parameter.name);
    }

    return {type:"object", properties, required};
}

async function resolveInvocation({type, id, method}, loader, services, contracts) {
    if (!id) throw new Error("Missing 'id' query parameter.");

    if (type === "command") {
        if (method !== "execute") throw new Error("Commands only expose the 'execute' method.");

        const Command = await loader.load(`command:${id}`);
        const contract = Command.contract;
        if (!contract?.execute) throw new Error(`Command '${id}' has no execute contract.`);

        return {
            type: "command",
            label: contract.label || id,
            description: contract.description || contract.execute.description || "",
            parameters: contract.execute.parameters || [],
            types: contract.types || {},
            returns: contract.execute.returns || null,
            invoke: (args, context) => new Command(context).execute(...args)
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
        if (typeof instance[method] !== "function") throw new Error(`Service '${id}' does not implement method '${method}'.`);

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

    throw new Error(`Unsupported invocation type '${type}'.`);
}

export default {
    contract: {
        properties: {
            type: {type:"string", default:"command", state:true, query:true},
            id: {type:"string", default:"", state:true, query:true},
            method: {type:"string", default:"execute", state:true, query:true},
            args: {type:"object", default:{}, state:true, query:true, queryParser:"json"}
        }
    },

    meta: {
        title: "Invoke",
        description: "Lorem ipsum dolor sit amet."
    },

    style: `
        h2 {margin-top:0;}
        .description {margin-bottom:1.25em;}
        .task x-progress {margin-top:.9em; width:33%}
        .duration {color:var(--x-color-text-gray); }

        .output-controls {display:flex; ajustify-content:flex-end; margin-bottom:.25em; margin-top:.75em;}
        .output-entries {margin-top:1em; background:rgba(0,0,0,0.25); padding:.5em 1em; max-height:50vh; overflow:auto; border-radius:.5em;}
        .output-entry {font-family:monospace; display:grid; grid-template-columns:13.5em 3.5em minmax(0, 1fr); gap:.25em; align-items:start;}
        .output-entry strong {}
        .output-entry.warn strong, .output-entry.warn pre {color:var(--x-notice-color-warning);}
        .output-entry.error strong, .output-entry.error pre {color:var(--x-datafield-error-color);}
        .output-entry pre {margin:0; white-space:pre-wrap; overflow-wrap:anywhere;}

        .result {margin-top:1.25em;}
        .result pre {white-space:pre-wrap; overflow-wrap:anywhere;}
        .result-value {white-space:pre-wrap; overflow-wrap:anywhere;}
    `,

    template: `

        <x-form command="submit" x-prop:errors="state.errors">

            <section x-if="state.ready && state.phase == 'arguments'" class="arguments" >
                <x-datafields label="Arguments">
                    <x-schema ref="arguments" x-prop:schema="state.schema" x-model="state.args"></x-schema>
                    <x-datafield type="checkbox" label="Advanced" label-secondary="Run in background" x-model="state.background" collapsible collapsed></x-datafield>
                </x-datafields>
            </section>

        
            <section x-if="state.phase == 'execution'" class="execution task" >
                <x-datafields label="Execution">
                    <x-notice x-attr:type="state.taskNoticeType" x-attr:label="state.taskNoticeLabel" x-attr:message="state.taskError ? state.taskError.message : state.taskDescription">
                        <x-progress x-if="state.running" x-attr:unknown="state.taskProgress ? false : true" x-attr:value="state.taskProgress.value" x-attr:max="state.taskProgress.max"></x-progress>
                        <span x-else class="duration">Process finished in <span x-text="state.taskDurationText"></span></span>
                        <div x-if="state.hasHiddenOutput" class="output-controls">
                            <x-button class="anchor" command="toggleOutput" x-attr:label="state.showAllOutput ? 'Show warnings and errors -' : 'Show all output +'"></x-button>
                        </div>
                        <div x-if="state.visibleTaskOutput.length > 0" class="output-entries">
                            <div x-for="entry in state.visibleTaskOutput" x-attr:class="'output-entry ' + entry.level">
                                <span x-text="entry.timestamp"></span>
                                <strong x-text="entry.level"></strong>
                                <pre x-text="entry.text"></pre>
                            </div>
                        </div>
                    </x-notice>
                </x-datafields>

                <x-datafields label="Result" x-if="state.completed && !state.isDialog" class="result">
                    <x-object x-if="state.hasResult && !state.resultFormat && (!state.resultType || state.resultType == 'object' || state.resultType == 'array' || state.resultType == 'any' || state.resultType == 'function' || state.resultType == 'date')" x-prop:value="state.result" expanded></x-object>
                    <x-code x-if="state.hasResult && state.resultFormat == 'text'" x-prop:value="state.result" wrap></x-code>
                    <x-anchor class="plain" x-if="state.hasResult && (state.resultFormat == 'url' || state.resultFormat == 'blob-url')" x-prop:href="state.result" target="_blank" rel="noopener noreferrer">                   
                        <x-icon icon="x-open-in-new"></x-icon>
                        <span x-text="state.result"></span>
                    </x-anchor>
                    <span x-if="state.hasResult && !state.resultFormat && state.resultType && state.resultType != 'object' && state.resultType != 'array' && state.resultType != 'any' && state.resultType != 'function' && state.resultType != 'date' && state.resultType != 'void'" class="result-value" x-text="state.result"></span>
                </x-datafields>

            </section>

            <x-button slot="footer" x-if="state.ready && state.phase == 'arguments'" label="Execute" command="submit" class="submit"></x-button>
            <!--<x-button slot="footer" x-if="!state.running" label="Edit arguments" command="editArguments"></x-button>-->
            <x-button slot="footer" x-if="state.isDialog && !state.ready" label="Close" command="cancel"></x-button>
            <x-button slot="footer" x-if="state.running" label="Cancel" command="cancel" class="cancel"></x-button>
            <x-button slot="footer" x-if="state.isDialog && !state.running" label="Close" command="cancel" class="cancel"></x-button>
        </x-form>
    `,

    state: {
        title: "Invoke",
        errors: [],
        phase: "arguments",
        description: "",
        schema: null,
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
        taskDuration: null,
        taskDurationText: "",
        taskOutput: [],
        visibleTaskOutput: [],
        showAllOutput: false,
        hasHiddenOutput: false,
        taskError: null,
        taskNoticeType: "",
        taskNoticeLabel: ""
    },

    controller({state, loader, services, contracts, page, tasks}) {
        let invocation = null;
        let currentTask = null;
        let taskListener = null;
        let durationInterval = null;
        let outputRevision = 0;
        let alive = true;
        let submitting = false;

        const updateOutputVisibility = () => {
            state.hasHiddenOutput = state.taskOutput.some(entry => entry.level !== "warn" && entry.level !== "error");
            state.visibleTaskOutput = state.showAllOutput ? state.taskOutput : state.taskOutput.filter(entry => entry.level === "warn" || entry.level === "error");
        };

        const stopDurationRefresh = () => {
            if (durationInterval !== null) clearInterval(durationInterval);
            durationInterval = null;
        };

        const refreshDuration = task => {
            if (!alive || task !== currentTask) return;
            const duration = task.duration;
            state.taskDuration = duration;
            state.taskDurationText = duration === null ? "" : `${duration.toFixed(2)} ms`;
            page.invalidate?.();
            if (task.status !== "pending" && task.status !== "running") stopDurationRefresh();
        };

        const detachTask = () => {
            stopDurationRefresh();
            if (currentTask && taskListener) currentTask.removeEventListener("change", taskListener);
            taskListener = null;
        };

        const resetExecutionState = () => {
            state.errors = [];
            state.completed = false;
            state.hasResult = false;
            state.result = undefined;
            state.taskStatus = "";
            state.taskDescription = "";
            state.taskProgress = null;
            state.taskDuration = null;
            state.taskDurationText = "";
            state.taskOutput = [];
            state.visibleTaskOutput = [];
            state.showAllOutput = false;
            state.hasHiddenOutput = false;
            state.taskError = null;
            state.taskNoticeType = "";
            state.taskNoticeLabel = "";
        };

        const refreshTask = async task => {
            if (!alive || task !== currentTask) return;

            const revision = ++outputRevision;
            state.taskStatus = task.status;
            state.taskDescription = task.description;
            state.taskProgress = task.progress ? {...task.progress} : null;
            refreshDuration(task);
            state.taskError = task.error ? {...task.error} : null;
            state.running = task.status === "pending" || task.status === "running";
            state.completed = task.status === "finished";
            state.taskNoticeType = task.status === "finished" ? "success" : task.status === "error" ? "error" : task.status === "canceled" ? "warning" : "working";
            state.taskNoticeLabel = task.status === "finished" ? "Completed" : task.status === "error" ? "Failed" : task.status === "canceled" ? "Canceled" : "Executing";

            const output = [];
            let cursor;
            while (true) {
                const outputPage = await task.getOutput({cursor, limit:1000});
                output.push(...outputPage.entries.map(entry => ({...entry})));
                cursor = outputPage.nextCursor;
                if (outputPage.entries.length < 1000) break;
            }

            if (!alive || task !== currentTask || revision !== outputRevision) return;
            state.taskOutput = output;
            updateOutputVisibility();
            page.invalidate?.();
        };

        const attachTask = task => {
            detachTask();
            currentTask = task;
            taskListener = () => { void refreshTask(task); };
            task.addEventListener("change", taskListener);
            durationInterval = setInterval(() => refreshDuration(task), 100);
            void refreshTask(task);
        };

        return {
            async load() {
                try {
                    const initialArgs = state.args;
                    if (!initialArgs || typeof initialArgs !== "object" || Array.isArray(initialArgs)) {
                        throw new Error("Invocation arguments must be a JSON object.");
                    }

                    invocation = await resolveInvocation({
                        type: state.type,
                        id: state.id,
                        method: state.method
                    }, loader, services, contracts);

                    state.title = invocation.label;
                    state.description = invocation.description;
                    state.resultType = invocation.returns?.type || invocation.types[invocation.returns?.ref]?.type || "";
                    state.resultFormat = invocation.returns?.format || "";
                    state.schema = methodToJsonSchema({parameters:invocation.parameters}, invocation.types);

                    const defaults = Object.entries(state.schema.properties)
                        .filter(([, definition]) => Object.hasOwn(definition, "default"))
                        .map(([name, definition]) => [name, structuredClone(definition.default)]);

                    state.args = {...Object.fromEntries(defaults), ...initialArgs};
                    page.label = invocation.label;
                    page.description = invocation.description;
                    state.ready = true;
                } catch (error) {
                    state.errors = [{ label: "Error", message: error?.message || String(error) }];
                    state.ready = false;
                }
            },

            mount() {
                state.isDialog = page.host?.layout === "dialog";
            },

            unload() {
                alive = false;
                const task = currentTask;
                detachTask();
                currentTask = null;
                invocation = null;

                if (task && !task.background && (task.status === "pending" || task.status === "running")) void task.cancel();
            },

            argumentsChanged({event}) {
                if (state.args !== event.detail.newValue) state.args = event.detail.newValue;
                state.preview = structuredClone(event.detail.newValue);
            },

            async submit() {
                if (!invocation || !state.ready || state.phase !== "arguments" || state.running || submitting) return;

                const args = invocation.parameters.map(parameter => state.args[parameter.name]);
                resetExecutionState();

                let task;
                submitting = true;
                try {
                    task = tasks.run({
                        title: invocation.label,
                        description: invocation.description,
                        background: state.background,
                        handler: taskContext => invocation.invoke(args, {task:taskContext})
                    });
                } catch (error) {
                    state.errors = [{ label: "Error", message: error?.message || String(error) }];
                    return;
                } finally {
                    submitting = false;
                }

                state.phase = "execution";
                attachTask(task);
                await task.wait();
                await refreshTask(task);

                if (task === currentTask) detachTask();
                if (!alive || task !== currentTask || task.status !== "finished") return;

                const result = await task.getResult();
                if (!alive || task !== currentTask) return;
                state.hasResult = result !== undefined;
                state.result = result;

                if (state.isDialog) await page.close(result);
            },

            toggleOutput() {
                state.showAllOutput = !state.showAllOutput;
                updateOutputVisibility();
                page.invalidate?.();
            },

            editArguments() {
                if (!state.running) {
                    stopDurationRefresh();
                    state.phase = "arguments";
                }
            },

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
