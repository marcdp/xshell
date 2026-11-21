
export default {
    contract: {
        description: "Read-only reference for an XShell public contract.",
        properties: {
            kind: {type:"string", default:"", state:true, query:true, description:"Contract kind: component, page, service, command, or contract."},
            id: {type:"string", default:"", state:true, query:true, description:"Identifier of the resource or registered contract."}
        }
    },
    meta: {
        title: "Contract detail",
        classes: ["stack-size-medium", "stack-layout-fill", "main-size-full"]
    },
    style: `
        x-tabs {
            flex:1;
            height:100%;
        }

        .example-template-header, .playground-toolbar, .playground-actions {
            display:flex;
            align-items:center;
            gap:.5em;
        }

        .example-template-header, .playground-toolbar {
            justify-content:space-between;
        }

        .example-template-header h4, .playground-toolbar h4, .playground-panel h5 {
            margin:0;
        }

        .playground {
            border:var(--x-card-border);
            border-radius:var(--x-card-border-radius);
            box-shadow:var(--x-card-shadow);
            margin-top:1em;
            overflow:hidden;
        }

        .playground-toolbar, .playground-panel {
            padding:var(--x-card-padding);
        }

        .playground-toolbar {
            border-bottom:var(--x-card-border);
        }

        .playground-grid {
            display:grid;
            grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);
        }

        .playground-panel {
            display:flex;
            flex-direction:column;
            gap:.75em;
            min-width:0;
        }

        .playground-panel + .playground-panel {
            border-left:var(--x-card-border);
        }

        .playground-source x-code-editor, .playground-preview {
            min-height:20em;
            overflow:auto;
        }

        @media (max-width:52em) {
            .playground-grid {grid-template-columns:minmax(0, 1fr);}
            .playground-panel + .playground-panel {border-left:0; border-top:var(--x-card-border);}
        }
    `,
    template: `
        <x-notice x-if="state.error" type="error" role="alert" x-prop:message="state.error"></x-notice>

        <div slot="header-actions" x-if="state.detail && state.detail.tags.length">
            <x-chip x-for="tag in state.detail.tags" x-key="tag" x-attr:label="tag"></x-chip>
        </div>

        <x-tabs class="sidebar" x-if="state.detail">

            <x-tab x-for="section in state.detail.sections" x-key="title" x-attr:label="section.title">
                <x-accordion cmultiple>
                    <x-accordion-panel x-for="entry in section.entries" x-key="name"
                        x-attr:icon="section.icon"
                        x-attr:label="entry.name"
                        x-attr:description="entry.label + entry.description">

                        <div slot="toolbar"class="metadata" x-if="entry.typeLabel || (entry.badges && entry.badges.length)">
                            <x-chip x-if="entry.typeLabel" x-attr:label="entry.typeLabel"></x-chip>
                            <x-chip x-for="badge in entry.badges" x-attr:label="badge"></x-chip>
                        </div>

                        <p x-if="entry.description" x-text="entry.description"></p>
                        <p x-if="entry.hasDefault">Default <code x-text="entry.defaultText"></code></p>
                        <p x-if="entry.enumText">Allowed values <code x-text="entry.enumText"></code></p>

                        <x-details x-if="entry.hasSchema" label="JSON Schema">
                            <x-object x-prop:value="entry.schema" expanded></x-object>
                        </x-details>

                        <div x-for="group in entry.groups" x-key="title">
                            <h4 x-text="group.title"></h4>
                            <ul>
                                <li x-for="field in group.fields" x-key="name">
                                    <div class="metadata" x-if="field.name || field.typeLabel || field.label || field.badges.length">
                                        <code x-if="field.name" x-text="field.name"></code>
                                        <span x-if="field.label" x-text="field.label"></span>
                                        <x-chip x-if="field.typeLabel" x-attr:label="field.typeLabel"></x-chip>
                                        <x-chip x-for="badge in field.badges" x-attr:label="badge"></x-chip>
                                    </div>

                                    <p x-if="field.description" x-text="field.description"></p>
                                    <p x-if="field.hasDefault">Default <code x-text="field.defaultText"></code></p>
                                    <p x-if="field.enumText">Allowed values <code x-text="field.enumText"></code></p>

                                    <x-details x-if="field.hasSchema" label="JSON Schema">
                                        <x-object x-prop:value="field.schema" expanded></x-object>
                                    </x-details>
                                </li>
                            </ul>
                        </div>
                    </x-accordion-panel>
                </x-accordion>
            </x-tab>

            <x-tab x-if="state.detail.examples.length" label="Examples">
                <x-accordion multiple>
                    <x-accordion-panel x-for="example in state.detail.examples" x-key="playgroundId" icon="x-example" x-attr:label="example.title" x-attr:description="example.description">

                        <p x-if="example.description" x-text="example.description"></p>

                        <div x-if="example.template">
                            <div class="example-template-header">
                                <h4>Template</h4>
                                <x-button x-if="example.hasPlayground && !example.playgroundOpen" label="Try it" icon="x-play"
                                    x-attr:data-example="example.playgroundId" x-on:click="openPlayground"></x-button>
                            </div>
                            <x-code language="html" x-prop:value="example.template" wrap></x-code>
                        </div>

                        <section class="playground" x-if="example.playgroundOpen">
                            <div class="playground-toolbar">
                                <h4>{{ example.title }} example</h4>
                                <div class="playground-actions">
                                    <x-button label="Reset" icon="x-refresh" x-attr:data-example="example.playgroundId" x-on:click="resetPlayground"></x-button>
                                    <x-button label="Close" icon="x-close" x-attr:data-example="example.playgroundId" x-on:click="closePlayground"></x-button>
                                </div>
                            </div>
                            <div class="playground-grid">
                                <section class="playground-panel playground-source">
                                    <h5>XTemplate</h5>
                                    <x-code-editor mode="html" x-prop:value="example.editedTemplate" x-attr:data-example="example.playgroundId"
                                        x-on:change="editPlaygroundTemplate"></x-code-editor>
                                </section>
                                <section class="playground-panel">
                                    <h5>Live preview</h5>
                                    <div class="playground-preview">
                                        <x-template x-prop:template="example.previewTemplate" x-prop:value="example.previewState"
                                            x-attr:data-example="example.playgroundId" x-on:change="updatePlaygroundState"
                                            x-on:command="blockPlaygroundCommand"></x-template>
                                    </div>
                                </section>
                            </div>
                        </section>

                        <div x-if="example.code">
                            <h4>Code <span x-if="example.language" x-text="example.language"></span></h4>
                            <x-code x-prop:language="example.language" x-prop:value="example.code" wrap></x-code>
                        </div>

                        <x-details x-if="example.hasState" label="Initial state">
                            <x-object x-prop:value="example.state" expanded></x-object>
                        </x-details>
                    </x-accordion-panel>
                </x-accordion>
            </x-tab>
        </x-tabs>
    `,
    state: {
        detail: null,
        error: ""
    },
    controller({ state, page, loader, resolver, services, contracts, config }) {
        let revision = 0;
        const previewUpdates = new Map();
        const kinds = {
            component: { label: "Component", icon: "x-component" },
            page: { label: "Page", icon: "x-page" },
            service: { label: "Service", icon: "x-service" },
            command: { label: "Command", icon: "x-play" },
            contract: { label: "Registered contract", icon: "x-contract" }
        };

        return {
            async load() {
                // Load the selected public contract without constructing the target resource.
                const request = ++revision;
                this.cancelPreviewUpdates();
                const { kind, id } = state;
                state.detail = null;
                state.error = "";

                try {
                    if (!kind?.trim()) throw new Error("Missing 'kind' query parameter.");
                    if (!Object.hasOwn(kinds, kind)) throw new Error(`Unsupported contract kind '${kind}'.`);
                    if (!id?.trim()) throw new Error("Missing 'id' query parameter.");

                    const resource = await this.resolveContract(kind, id);
                    if (request !== revision) return;

                    if (resource.contract == null) throw new Error(`${kinds[kind].label} '${id}' has no declared contract.`);
                    if (typeof resource.contract !== "object" || Array.isArray(resource.contract)) {
                        throw new Error(`${kinds[kind].label} '${id}' has invalid contract metadata.`);
                    }

                    state.detail = this.describeContract(kind, id, resource);
                    page.label = state.detail.label;
                    page.description = state.detail.kindLabel + ": " + state.detail.description;
                } catch (error) {
                    if (request === revision) state.error = error?.message || String(error);
                }
            },

            unload() {
                // Invalidate pending contract and preview work.
                ++revision;
                this.cancelPreviewUpdates();
            },

            unmount() {
                // Prevent delayed preview work after the Page leaves the rendered layout.
                this.cancelPreviewUpdates();
            },

            cancelPreviewUpdates(name) {
                // Cancel one example update or every outstanding preview update.
                if (name !== undefined) {
                    const pending = previewUpdates.get(name);
                    if (pending) clearTimeout(pending.timeoutId);
                    previewUpdates.delete(name);
                    return;
                }
                for (const pending of previewUpdates.values()) clearTimeout(pending.timeoutId);
                previewUpdates.clear();
            },

            findExample(identifier) {
                // Resolve an event's authored example against the current contract projection.
                return state.detail?.examples.find(example => example.playgroundId === identifier)
                    ?? state.detail?.examples.find(example => example.name === identifier) ?? null;
            },

            updateExample(identifier, update) {
                // Replace only the selected projection so keyed editors and panels retain their DOM instances.
                if (!state.detail) return null;
                const selected = this.findExample(identifier);
                if (!selected) return null;
                let updated = null;
                const examples = state.detail.examples.map(example => {
                    if (example.playgroundId !== selected.playgroundId) return example;
                    updated = { ...example, ...update };
                    return updated;
                });
                if (updated) state.detail = { ...state.detail, examples };
                return updated;
            },

            openPlayground({ event }) {
                // Start from fresh clones without modifying the authored contract example.
                const name = event.currentTarget.dataset.example;
                const example = this.findExample(name);
                if (!example?.hasPlayground) return;
                this.cancelPreviewUpdates(name);
                this.updateExample(name, {
                    editedTemplate: example.originalTemplate,
                    previewTemplate: example.originalTemplate,
                    previewState: structuredClone(example.originalState),
                    playgroundOpen: true
                });
            },

            closePlayground({ event }) {
                // Remove the editor and renderer while invalidating their delayed work.
                const name = event.currentTarget.dataset.example;
                this.cancelPreviewUpdates(name);
                this.updateExample(name, { editedTemplate: "", previewTemplate: "", previewState: null, playgroundOpen: false });
            },

            editPlaygroundTemplate({ event }) {
                // Preserve editor text immediately and publish only the latest debounced preview source.
                const name = event.currentTarget.dataset.example;
                const example = this.findExample(name);
                if (!example?.playgroundOpen) return;
                const editedTemplate = event.detail.newValue ?? "";
                this.updateExample(name, { editedTemplate });
                this.cancelPreviewUpdates(name);

                const token = { revision, timeoutId: null };
                token.timeoutId = setTimeout(() => {
                    if (previewUpdates.get(name) !== token || token.revision !== revision) return;
                    previewUpdates.delete(name);
                    const current = this.findExample(name);
                    if (current?.playgroundOpen && current.editedTemplate === editedTemplate) {
                        this.updateExample(name, { previewTemplate: editedTemplate });
                    }
                }, 250);
                previewUpdates.set(name, token);
            },

            updatePlaygroundState({ event }) {
                // Retain a replacement value emitted by x-template while same-reference mutations need no projection update.
                const name = event.currentTarget.dataset.example;
                const example = this.findExample(name);
                if (example?.playgroundOpen && event.detail.newValue !== example.previewState) {
                    this.updateExample(name, { previewState: event.detail.newValue });
                }
            },

            resetPlayground({ event }) {
                // Restore both source and local state from the authored example snapshots.
                const name = event.currentTarget.dataset.example;
                const example = this.findExample(name);
                if (!example?.playgroundOpen) return;
                this.cancelPreviewUpdates(name);
                this.updateExample(name, {
                    editedTemplate: example.originalTemplate,
                    previewTemplate: example.originalTemplate,
                    previewState: structuredClone(example.originalState)
                });
            },

            blockPlaygroundCommand({ event }) {
                // Keep dynamic-template commands inside the preview boundary.
                event.preventDefault();
                event.stopPropagation();
            },

            async resolveContract(kind, id) {
                // Read Service registrations without constructing Service instances.
                if (kind === "service") {
                    const info = services.getServiceInfo(id);
                    if (!info) throw new Error(`Service '${id}' was not found.`);
                    if (!info.contractId) throw new Error(`Service '${id}' has no registered contract.`);

                    const contract = contracts.getContractById(info.contractId);
                    if (!contract) throw new Error(`Contract '${info.contractId}' for service '${id}' was not found.`);

                    return { contract, contractId: info.contractId, moduleId: info.moduleId };
                }

                if (kind === "contract") {
                    const contract = contracts.getContractById(id);
                    if (!contract) throw new Error(`Registered contract '${id}' was not found.`);
                    return { contract, moduleId: contracts.getContractItemById(id)?.moduleId };
                }

                // Resolve resource definitions and inspect static contracts without instantiation.
                let resource = `${kind}:${id}`;
                if (kind === "page") {
                    const assetPrefix = config.xshell.assets.basePath + "/";
                    if (id.startsWith(assetPrefix) && !resolver.has(resource)) {
                        const [moduleId, ...path] = id.slice(assetPrefix.length).split("/");
                        if (path.length && Object.hasOwn(config.modules, moduleId)) {
                            resource = `page:${moduleId}:/${path.join("/")}`;
                        }
                    }
                }

                let Resource;
                try {
                    Resource = await loader.load(resource);
                } catch (error) {
                    if (error?.code === "RESOURCE_NOT_FOUND" || error?.code === 404) {
                        throw new Error(`${kinds[kind].label} '${id}' was not found.`, { cause: error });
                    }
                    throw new Error(`Could not load ${kind} '${id}'. ${error?.message || error}`, { cause: error });
                }

                if (!Resource) throw new Error(`${kinds[kind].label} '${id}' was not found.`);

                return {
                    contract: kind === "page" ? Resource.definition?.contract : Resource.contract,
                    moduleId: resolver.resolve(resource)?.definition?.moduleId
                };
            },

            describeContract(kind, id, { contract, contractId, moduleId }) {
                // Project contract members into sections suitable for accordion panels.
                const types = contract.types ?? {};
                const describe = (name, descriptor, options) => this.describeValue(name, descriptor, types, options);

                const properties = Object.entries(contract.properties ?? {}).map(([name, descriptor]) =>
                    describe(name, descriptor, { required: true, propertyKind: kind }));

                const methods = Object.entries(kind === "command" && contract.execute ? { execute: contract.execute } : contract.methods ?? {})
                    .map(([name, method]) => {
                        const parameters = (method.parameters ?? []).map(parameter =>
                            describe(parameter.name, parameter, { required: true }));

                        const groups = [];
                        if (parameters.length) groups.push({ title: "Parameters", fields: parameters });
                        if (method.returns) groups.push({ title: "Returns", fields: [describe("", method.returns)] });

                        return {
                            name: `${name}(${parameters.map(parameter => parameter.name).join(", ")})`,
                            label: method.label,
                            description: method.description,
                            groups
                        };
                    });

                const events = Object.entries(contract.events ?? {}).map(([name, event]) => {
                    const fields = Object.entries(event.detail ?? {}).map(([field, descriptor]) =>
                        describe(field, descriptor, { required: true }));

                    return {
                        name,
                        label: event.label,
                        description: event.description,
                        groups: fields.length ? [{ title: "Detail payload", fields }] : []
                    };
                });

                const slots = kind === "component" || kind === "page"
                    ? Object.entries(contract.slots ?? {}).map(([name, slot]) =>
                        describe(name || "Default slot", slot, { required: true }))
                    : [];

                const sections = [
                    { title: "Properties", entries: properties, icon: "x-property" },
                    { title: "Methods", entries: methods, icon: "x-method" },
                    { title: "Events", entries: events, icon: "x-event" },
                    { title: "Slots", entries: slots, icon: "x-slot" },
                    { title: "Types", entries: Object.entries(types).map(([name, type]) => describe(name, type)), icon: "x-type" }
                ].filter(section => section.entries.length);

                // Preserve authored examples and add isolated, inactive playground projections.
                const examples = (contract.examples ?? []).map((example, index) => ({
                    ...example,
                    playgroundId: `${index}:${example.name}`,
                    title: example.name.replace(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase()),
                    language: example.language ?? "",
                    hasState: Object.hasOwn(example, "state"),
                    hasPlayground: typeof example.template === "string" && example.template.trim().length > 0,
                    originalTemplate: example.template ?? "",
                    editedTemplate: "",
                    previewTemplate: "",
                    originalState: structuredClone(example.state ?? {}),
                    previewState: null,
                    playgroundOpen: false
                }));

                return {
                    kind, id, contractId, moduleId, sections, examples,
                    kindLabel: kinds[kind].label,
                    label: contract.label || id,
                    icon: contract.icon || kinds[kind].icon,
                    description: contract.description,
                    tags: [...(contract.tags || [])],
                    empty: sections.length === 0 && examples.length === 0
                };
            },

            describeValue(name, descriptor, types, { required, propertyKind } = {}) {
                // Preserve contract-local type references, effective schemas and explicit defaults.
                const referenced = descriptor.ref && Object.hasOwn(types, descriptor.ref) ? types[descriptor.ref] : null;
                const type = referenced?.type ?? descriptor.type;
                const schema = referenced?.schema ?? descriptor.schema;
                const badges = [];

                if (required && descriptor.required) badges.push("required");
                if (Object.hasOwn(descriptor, "readonly")) badges.push(descriptor.readonly ? "Read-only" : "Writable");
                if (descriptor.format) badges.push(`Format: ${descriptor.format}`);

                const flags = propertyKind === "component"
                    ? ["attribute", "attributeParser", "reflect", "state", "changeDetection"]
                    : propertyKind === "page"
                        ? ["query", "queryParser", "reflect", "state", "context"]
                        : [];

                for (const flag of flags) {
                    if (Object.hasOwn(descriptor, flag)) {
                        const value = descriptor[flag];
                        if (value === true)
                            badges.push(`${flag}`);
                        else
                            badges.push(`${flag}: ${value}`);
                    }
                }

                return {
                    ...descriptor,
                    name,
                    type,
                    schema,
                    badges,
                    typeLabel: descriptor.ref ? `${descriptor.ref} (${type ?? "unresolved"})` : type,
                    hasSchema: schema !== undefined,
                    hasDefault: Object.hasOwn(descriptor, "default"),
                    defaultText: JSON.stringify(descriptor.default) ?? String(descriptor.default),
                    enumText: descriptor.enum?.map(value => JSON.stringify(value)).join(", ")
                };
            }
        };
    }
};
