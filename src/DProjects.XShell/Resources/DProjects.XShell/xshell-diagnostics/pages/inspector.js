
// page
export default {
    contract: {
        description: "Interactive Service Inspector.",
        properties: {},
        methods: {},
        events: {}
    },
    meta: {
        title: "Inspector"
    },
    style: `
        .toolbar {
            display: flex;
            align-items: end;
            gap: .75em;
            flex-wrap: wrap;
        }
        .toolbar x-datafield {
            flex: 1;
            min-width: 15em;
        }
        
        .error {
            color: #b42318;
            white-space: pre-wrap;
        }
        .parameters {
            display: grid;
            gap: 1em;
            margin: 1em 0;
        }
        pre {
            padding: .75em;
            background: var(--x-color-background-alt);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            overflow: auto;
            max-height: 20em;
        }
        .history {
            max-height: 25em;
            overflow-y: auto;
            display: grid;
            gap: .5em;
        }
    `,
    template: `
        <x-form>

            <!-- Service selection -->
            <x-datafields label="Service">
                <x-toolbar>
                    <x-datafield
                        type="select"
                        x-prop:domain="state.serviceOptions"
                        x-model="state.serviceId">
                    </x-datafield>

                    <x-button
                        label="Resolve"
                        icon="x-play"
                        x-attr:disabled="!state.serviceId || state.resolved"
                        x-on:click="resolveService">
                    </x-button>

                    <span class="muted">{{ state.status }}</span>
                </x-toolbar>

                <x-notice class="error" x-if="state.error" x-attr:label="state.error"></x-notice>

                <div x-if="state.contractId">
                    <p>
                        <b>{{ state.contractLabel }}:</b>
                        {{ state.description }}
                    </p>
                    <p class="muted">Contract: {{ state.contractId }}</p>
                </div>
            </x-datafields>

            <!-- Properties -->
            <x-datafields x-if="state.contractId" label="Properties">

                <p x-if="state.properties.length == 0">
                    No properties declared.
                </p>

                <x-accordion x-else>
                    <x-accordion-panel x-for="item in state.properties" x-key="name" 
                        class="card"
                        x-attr:label="item.name"
                        x-attr:description="item.description + ' (' + item.type + (item.readonly ? ', read-only' : '') + ')'"
                        >
                        <x-button
                            label="Read"
                            icon="x-refresh"
                            x-attr:data-name="item.name"
                            x-attr:disabled="!state.resolved"
                            x-on:click="readProperty">
                        </x-button>
                        <pre x-if="item.read">{{ item.value }}</pre>
                    </x-accordion-panel>
                </x-accordion>

            </x-datafields>

            <!-- Methods -->
            <x-datafields x-if="state.contractId" label="Methods">

                <p x-if="state.methods.length == 0">
                    No methods declared.
                </p>

                <x-accordion x-else>
                    <x-accordion-panel
                        class="card"
                        x-for="method in state.methods"
                        x-key="name"
                        x-attr:label="method.label"
                        x-attr:description="method.description"
                        >

                        <p class="muted" x-if="method.parameters.length == 0">
                            This method has no parameters.
                        </p>

                        <!-- Parameters -->
                        <div class="parameters" x-if="method.parameters.length > 0">
                            <x-datafield
                                x-for="param in method.parameters"
                                x-key="name"
                                x-attr:type="param.editor"
                                x-attr:label="param.label"
                                x-attr:description="param.description"
                                x-attr:placeholder="param.placeholder"
                                x-attr:required="param.required"
                                x-prop:domain="param.domain"
                                x-model="param.input">
                            </x-datafield>
                        </div>
                        
                        <p class="muted">Returns: {{ method.returns }}</p>

                        <!-- Invocation permission -->
                        <x-datafield
                            type="checkbox"
                            label-secondary="Enable invocation (may modify application state)"
                            x-model="method.allowInvoke">
                        </x-datafield>

                        <!-- Execute -->
                        <div class="toolbar">
                            <x-button
                                label="Execute"
                                icon="x-play"
                                x-attr:data-method="method.name"
                                x-attr:disabled="!state.resolved || !method.allowInvoke || method.running"
                                x-on:click="invokeMethod">
                            </x-button>

                            <span class="muted" x-if="method.running">
                                Executing...
                            </span>

                            <span class="muted">{{ method.duration }}</span>
                        </div>

                        <!-- Error -->
                        <x-notice class="error" x-if="state.error" x-attr:label="state.error"></x-notice>

                        <!-- Result -->
                        <div x-if="method.hasResult">
                            <strong>Result</strong>
                            <pre>{{ method.result }}</pre>
                        </div>
                    </x-accordion-panel>
                </x-accordion>
            </x-datafields>

            <!-- Events -->
            <x-datafields x-if="state.contractId" label="Events">

                <p x-if="state.serviceEvents.length == 0">
                    No events declared.
                </p>

                <x-accordion x-else>
                    <x-accordion-panel x-for="item in state.serviceEvents" x-key="name" 
                        class="card"
                        x-attr:label="item.name"
                        x-attr:description="item.description"
                        >
                            <div>Payload: {{ item.detail }}</div>
                    </x-accordion-panel>
                </x-accordion>

                <div class="toolbar" x-if="state.serviceEvents.length > 0">
                    <x-button
                        x-if="!state.monitoring"
                        label="Start monitoring"
                        icon="x-play"
                        x-on:click="startMonitoring">
                    </x-button>

                    <x-button
                        x-if="state.monitoring"
                        label="Stop monitoring"
                        icon="x-stop"
                        x-on:click="stopMonitoring">
                    </x-button>

                    <x-button
                        label="Clear"
                        icon="x-close"
                        x-on:click="clearEvents">
                    </x-button>
                </div>

                <div class="history">
                    <x-card x-for="item in state.history" x-key="id">
                        <div class="row">
                            <strong>{{ item.name }}</strong>
                            <span class="muted">{{ item.time }}</span>
                        </div>
                        <pre>{{ item.detail }}</pre>
                    </x-card>
                </div>

                <p class="muted" x-if="state.monitoring">
                    Monitoring active. Events received from this moment onward will be recorded.
                </p>
            </x-datafields>
        </x-form>
    `,
    state: {
        serviceOptions: [],
        serviceId: "",
        status: "",
        error: "",
        resolved: false,

        contractId: "",
        contractLabel: "",
        description: "",

        properties: [],
        methods: [],
        serviceEvents: [],

        monitoring: false,
        history: []
    },
    controller({ state, services, contracts, bus, events }) {
        let instance = null;
        let contract = null;
        let listeners = [];
        let sequence = 0;
        let revision = 0;
        let alive = true;

        // helpers
        function preview(value) {
            if (value === undefined) return "undefined";

            try {
                const seen = new WeakSet();
                const json = JSON.stringify(value, (key, item) => {
                    if (typeof item === "bigint") return String(item) + "n";
                    if (typeof item === "function") return "[Function]";
                    if (item && typeof item === "object") {
                        if (seen.has(item)) return "[Circular]";
                        seen.add(item);
                    }
                    return item;
                }, 2);

                return (json === undefined ? String(value) : json).slice(0, 12000);
            } catch (error) {
                return `[Cannot display value: ${error.message}]`;
            }
        }

        function stopMonitoring() {
            for (const { name, listener } of listeners) {
                bus.removeEventListener(name, listener);
            }
            listeners = [];
            state.monitoring = false;
        }

        function descriptorType(descriptor) {
            if (descriptor?.type) return descriptor.type;
            if (descriptor?.ref) return contract?.types?.[descriptor.ref]?.type || "any";
            return "any";
        }

        function createParameter(parameter) {
            const type = descriptorType(parameter);
            const required = parameter.required === true;
            const enums = parameter.enum || [];
            let editor = "text";
            let domain = null;

            if (type === "boolean") {
                editor = "select";
                domain = [
                    { value: "", label: required ? "Select a value" : "(omitted)" },
                    { value: "true", label: "true" },
                    { value: "false", label: "false" }
                ];
            } else if (enums.length) {
                editor = "select";
                domain = [
                    { value: "", label: required ? "Select a value" : "(omitted)" },
                    ...enums.map(value => ({ value, label: value }))
                ];
            } else if (type === "number" || type === "integer") {
                editor = "number";
            } else if (["object", "array", "any", "function"].includes(type)) {
                editor = "textarea";
            }

            let input = "";
            if (parameter.default !== undefined) {
                input = ["object", "array", "any"].includes(type)
                    ? preview(parameter.default)
                    : String(parameter.default);
            }

            return {
                name: parameter.name,
                label: `${parameter.name} (${type})`,
                type,
                required,
                description: parameter.description || "",
                placeholder: required ? "Required" : "Optional",
                editor,
                domain,
                enumValues: enums,
                input
            };
        }

        function parseParameter(parameter) {
            const raw = parameter.input;

            if (raw === "" || raw === null || raw === undefined) {
                if (parameter.required)
                    throw new Error(`Missing required parameter: ${parameter.name}`);
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
                        throw new Error(`Invalid ${parameter.type}: ${parameter.name}`);
                    }
                    break;

                case "boolean":
                    if (raw !== true && raw !== false && raw !== "true" && raw !== "false")
                        throw new Error(`Invalid boolean: ${parameter.name}`);
                    value = raw === true || raw === "true";
                    break;

                case "function":
                    throw new Error(`Function parameters are not supported: ${parameter.name}`);

                default:
                    try {
                        value = typeof raw === "string" ? JSON.parse(raw) : raw;
                    } catch {
                        throw new Error(`Invalid JSON for parameter: ${parameter.name}`);
                    }
            }

            if (parameter.enumValues.length && !parameter.enumValues.includes(value)) {
                throw new Error(`Invalid enum value: ${parameter.name}`);
            }

            return value;
        }

        function updateMethod(name, changes) {
            state.methods = state.methods.map(method =>
                method.name === name ? { ...method, ...changes } : method
            );
        }

        return {
            load() {
                alive = true;
                events.on(state, "change:serviceId", "loadService");
                events.on(bus, "xshell:service:created", "refreshRegistry");
                this.refreshRegistry();
            },

            refreshRegistry() {
                const items = services.registry
                    .filter(item => item.contractId)
                    .sort((a, b) => a.id.localeCompare(b.id));

                state.serviceOptions = items.map(item => ({
                    value: item.id,
                    label: item.id
                }));

                if (!items.some(item => item.id === state.serviceId)) {
                    state.serviceId = items[0]?.id || "";
                    if (!state.serviceId) this.loadService();
                } else {
                    state.status = services.getServiceInfo(state.serviceId)?.state || "";
                }
            },

            loadService() {
                revision++;
                stopMonitoring();

                instance = null;
                contract = null;

                state.error = "";
                state.resolved = false;
                state.contractId = "";
                state.contractLabel = "";
                state.description = "";
                state.properties = [];
                state.methods = [];
                state.serviceEvents = [];
                state.history = [];
                state.status = "";

                const info = services.getServiceInfo(state.serviceId);
                if (!info) return;

                state.status = info.state;

                if (!info.contractId) {
                    state.error = "This service has no registered contract.";
                    return;
                }

                contract = contracts.getContractById(info.contractId);
                if (!contract) {
                    state.error = `Contract '${info.contractId}' not found.`;
                    return;
                }

                state.contractId = info.contractId;
                state.contractLabel = contract.label || info.contractId;
                state.description = contract.description || "";

                // properties
                state.properties = Object.entries(contract.properties || {}).map(([name, item]) => ({
                    name,
                    type: descriptorType(item),
                    readonly: item.readonly === true,
                    description: item.description || "",
                    read: false,
                    value: ""
                }));

                // methods - independent state per method
                state.methods = Object.entries(contract.methods || {}).map(([name, method]) => ({
                    name,
                    label: `${name}(${(method.parameters || []).map(p => p.name).join(", ")})`,
                    description: method.description || "",
                    parameters: (method.parameters || []).map(createParameter),
                    returns: method.returns ? descriptorType(method.returns) : "void",
                    allowInvoke: false,
                    running: false,
                    hasResult: false,
                    result: "",
                    error: "",
                    duration: ""
                }));

                // events
                state.serviceEvents = Object.entries(contract.events || {}).map(([name, item]) => ({
                    name,
                    description: item.description || "",
                    detail: Object.entries(item.detail || {})
                        .map(([key, value]) => `${key}: ${descriptorType(value)}`)
                        .join(", ") || "none"
                }));
            },

            resolveService() {
                if (!state.serviceId || state.resolved) return;

                try {
                    instance = services.resolve(state.serviceId);
                    if (!instance) throw new Error("Service has no live instance.");

                    state.resolved = true;
                    state.status = services.getServiceInfo(state.serviceId)?.state || "created";
                    state.error = "";
                } catch (error) {
                    state.error = error.message || String(error);
                    state.status = services.getServiceInfo(state.serviceId)?.state || "registered";
                }
            },

            readProperty({ event }) {
                const name = event.currentTarget.dataset.name;
                if (!instance || !Object.hasOwn(contract?.properties || {}, name)) return;

                let value;
                try {
                    value = preview(instance[name]);
                } catch (error) {
                    value = `Error: ${error.message}`;
                }

                state.properties = state.properties.map(item =>
                    item.name === name ? { ...item, read: true, value } : item
                );
            },

            async invokeMethod({ event }) {
                if (!instance) return;

                const name = event.currentTarget.dataset.method;
                const method = state.methods.find(item => item.name === name);

                if (!method || !method.allowInvoke || method.running) return;
                if (!Object.hasOwn(contract?.methods || {}, name)) return;

                let args;

                try {
                    args = method.parameters.map(parseParameter);

                    while (args.length && args[args.length - 1] === undefined)
                        args.pop();

                    if (typeof instance[name] !== "function")
                        throw new Error(`Method '${name}' is not callable.`);
                } catch (error) {
                    updateMethod(name, {
                        error: error.message || String(error),
                        hasResult: false,
                        duration: ""
                    });
                    return;
                }

                const currentRevision = revision;
                const start = performance.now();

                updateMethod(name, {
                    running: true,
                    error: "",
                    hasResult: false,
                    duration: ""
                });

                try {
                    const result = await instance[name](...args);

                    if (alive && revision === currentRevision) {
                        updateMethod(name, {
                            result: preview(result),
                            hasResult: true
                        });
                    }
                } catch (error) {
                    if (alive && revision === currentRevision) {
                        updateMethod(name, {
                            error: error?.stack || error?.message || String(error)
                        });
                    }
                } finally {
                    if (alive && revision === currentRevision) {
                        updateMethod(name, {
                            running: false,
                            duration: `${(performance.now() - start).toFixed(1)} ms`
                        });
                    }
                }
            },

            startMonitoring() {
                if (state.monitoring || !contract) return;

                for (const name of Object.keys(contract.events || {})) {
                    const listener = event => {
                        if (!alive) return;

                        state.history = [{
                            id: ++sequence,
                            name: event.type,
                            time: new Date(event.ts || Date.now()).toLocaleTimeString(),
                            detail: preview(event.detail)
                        }, ...state.history].slice(0, 40);
                    };

                    bus.addEventListener(name, listener);
                    listeners.push({ name, listener });
                }

                state.monitoring = listeners.length > 0;
            },

            stopMonitoring() {
                stopMonitoring();
            },

            clearEvents() {
                state.history = [];
            },

            unmount() {
                stopMonitoring();
            },

            unload() {
                alive = false;
                revision++;
                stopMonitoring();
                instance = null;
                contract = null;
            }
        };
    }
};
