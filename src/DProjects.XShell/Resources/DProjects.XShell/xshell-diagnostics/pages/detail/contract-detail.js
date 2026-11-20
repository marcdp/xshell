const kinds = {
    component: { label: "Component", icon: "x-component" },
    page: { label: "Page", icon: "x-page" },
    service: { label: "Service", icon: "x-service" },
    command: { label: "Command", icon: "x-play" },
    contract: { label: "Registered contract", icon: "x-contract" }
};

export default {
    contract: { description: "Read-only reference for an XShell public contract." },
    meta: { title: "Contract detail" },
    style: `
        .contract-reference {
            box-sizing: border-box;
            display: grid;
            gap: 1.75rem;
            max-width: 70rem;
            min-width: 0;
            margin-inline: auto;
            padding-block: .5rem 2rem;
            overflow-wrap: anywhere;
        }
        .contract-reference section, .entry, .fields, x-code { min-width: 0; }
        .contract-reference h2, .contract-reference h3, .contract-reference h4, .contract-reference p { margin: 0; }
        .contract-reference p { color: var(--x-color-text); line-height: 1.5; }
        .contract-reference h2 { font-size: var(--x-font-size-subtitle); }
        .contract-reference h3, .contract-reference h4 { font-size: 1em; }
        .overview, .entry {
            border: var(--x-card-border);
            border-radius: var(--x-card-border-radius);
            padding: clamp(.75rem, 2vw, 1.25rem);
        }
        .overview { display: grid; gap: .75rem; background: var(--x-color-background-alt); }
        .overview-heading, .entry-heading, .badges {
            display: flex;
            align-items: baseline;
            flex-wrap: wrap;
            gap: .35rem .65rem;
        }
        .overview-heading { align-items: center; }
        .identity { display: flex; flex-wrap: wrap; gap: .4rem 1.25rem; margin: 0; }
        .identity > div { display: flex; flex-wrap: wrap; gap: .25rem .5rem; min-width: 0; }
        .identity dd { margin: 0; min-width: 0; }
        .identity dt, .contract-reference .muted { color: var(--x-color-text-gray); }
        .entries, .entry, .fields, .field { display: grid; gap: .6rem; }
        .entries { margin-top: .75rem; }
        .fields {
            margin-top: .2rem;
            padding-inline-start: .75rem;
            border-inline-start: var(--x-card-border);
        }
        .field + .field { margin-top: .25rem; }
        .badges { font-size: .875em; }
        .badge {
            border-radius: .35rem;
            padding: .12em .45em;
            background: var(--x-color-background-alt);
        }
        .schema { overflow: auto; }
    `,
    template: `
        <x-notice x-if="state.error" type="error" role="alert" x-prop:message="state.error"></x-notice>
        <div class="contract-reference" x-if="state.detail">
            <section class="overview">
                <div class="overview-heading">
                    <x-icon x-attr:icon="state.detail.icon" aria-hidden="true"></x-icon>
                    <h2>Overview</h2>
                </div>
                <dl class="identity">
                    <div><dt>Resource</dt><dd><code x-text="state.detail.id"></code></dd></div>
                    <div><dt>Kind</dt><dd x-text="state.detail.kindLabel"></dd></div>
                    <div x-if="state.detail.moduleId"><dt>Module</dt><dd x-text="state.detail.moduleId"></dd></div>
                    <div x-if="state.detail.contractId"><dt>Contract</dt><dd x-text="state.detail.contractId"></dd></div>
                </dl>
                <p x-if="state.detail.description" x-text="state.detail.description"></p>
            </section>
            <p class="muted" x-if="state.detail.empty">No public contract members or examples are documented for this resource.</p>

            <section x-for="section in state.detail.sections">
                <h2 x-text="section.title"></h2>
                <div class="entries">
                    <article class="entry" x-for="entry in section.entries">
                        <div class="entry-heading">
                            <h3><code x-text="entry.name"></code></h3>
                            <span class="badge" x-if="entry.typeLabel" x-text="entry.typeLabel"></span>
                            <span class="muted" x-if="entry.label" x-text="entry.label"></span>
                        </div>
                        <p x-if="entry.description" x-text="entry.description"></p>
                        <div class="badges" x-if="entry.badges && entry.badges.length">
                            <span class="badge" x-for="badge in entry.badges" x-text="badge"></span>
                        </div>
                        <p x-if="entry.hasDefault"><span class="muted">Default</span> <code x-text="entry.defaultText"></code></p>
                        <p x-if="entry.enumText"><span class="muted">Allowed values</span> <code x-text="entry.enumText"></code></p>
                        <x-details x-if="entry.hasSchema" label="JSON Schema">
                            <x-object class="schema" x-prop:value="entry.schema" expanded></x-object>
                        </x-details>
                        <div class="fields" x-for="group in entry.groups">
                            <h4 x-text="group.title"></h4>
                            <div class="field" x-for="field in group.fields">
                                <div class="entry-heading">
                                    <code x-if="field.name" x-text="field.name"></code>
                                    <span class="badge" x-if="field.typeLabel" x-text="field.typeLabel"></span>
                                    <span class="muted" x-if="field.label" x-text="field.label"></span>
                                </div>
                                <p x-if="field.description" x-text="field.description"></p>
                                <div class="badges" x-if="field.badges.length">
                                    <span class="badge" x-for="badge in field.badges" x-text="badge"></span>
                                </div>
                                <p x-if="field.hasDefault"><span class="muted">Default</span> <code x-text="field.defaultText"></code></p>
                                <p x-if="field.enumText"><span class="muted">Allowed values</span> <code x-text="field.enumText"></code></p>
                                <x-details x-if="field.hasSchema" label="JSON Schema">
                                    <x-object class="schema" x-prop:value="field.schema" expanded></x-object>
                                </x-details>
                            </div>
                        </div>
                    </article>
                </div>
            </section>

            <section x-if="state.detail.examples.length">
                <h2>Examples</h2>
                <div class="entries">
                    <article class="entry" x-for="example in state.detail.examples">
                        <h3 x-text="example.title"></h3>
                        <p x-if="example.description" x-text="example.description"></p>
                        <div class="field" x-if="example.template">
                            <h4>Template</h4>
                            <x-code language="html" x-prop:value="example.template" wrap></x-code>
                        </div>
                        <div class="field" x-if="example.code">
                            <h4>Code <span class="muted" x-if="example.language" x-text="example.language"></span></h4>
                            <x-code x-prop:language="example.language" x-prop:value="example.code" wrap></x-code>
                        </div>
                        <x-details x-if="example.hasState" label="Initial state">
                            <x-object class="schema" x-prop:value="example.state" expanded></x-object>
                        </x-details>
                    </article>
                </div>
            </section>
        </div>
    `,
    state: { detail: null, error: "" },
    controller({ state, page, loader, resolver, services, contracts, config }) {
        let revision = 0;
        return {
            async load() {
                // Await resolution so the host layout shows its loading indicator.
                const request = ++revision;
                const { kind, id } = page.query;
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
                } catch (error) {
                    if (request === revision) state.error = error?.message || String(error);
                }
            },

            unload() {
                ++revision;
            },

            async resolveContract(kind, id) {
                // Service lookup reads only registration metadata.
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

                // Inspect static metadata on the loaded class without constructing an instance.
                let resource = `${kind}:${id}`;
                if (kind === "page") {
                    // Resolve a version-independent asset ID through the standard module-qualified Page alias.
                    const assetPrefix = config.xshell.assets.basePath + "/";
                    if (id.startsWith(assetPrefix) && !resolver.has(resource)) {
                        const [moduleId, ...path] = id.slice(assetPrefix.length).split("/");
                        if (path.length && Object.hasOwn(config.modules, moduleId)) resource = `page:${moduleId}:/${path.join("/")}`;
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
                // Project declared descriptors and keep their contract-local type information.
                const types = contract.types ?? {};
                const describe = (name, descriptor, options) => this.describeValue(name, descriptor, types, options);
                const properties = Object.entries(contract.properties ?? {}).map(([name, descriptor]) =>
                    describe(name, descriptor, { required: true, propertyKind: kind }));
                const methods = Object.entries(kind === "command" && contract.execute ? { execute: contract.execute } : contract.methods ?? {})
                    .map(([name, method]) => {
                        const parameters = (method.parameters ?? []).map(parameter => describe(parameter.name, parameter, { required: true }));
                        const groups = [];
                        if (parameters.length) groups.push({ title: "Parameters", fields: parameters });
                        if (method.returns) groups.push({ title: "Returns", fields: [describe("", method.returns)] });
                        return { name: `${name}(${parameters.map(parameter => parameter.name).join(", ")})`, label: method.label,
                            description: method.description, groups };
                    });
                const events = Object.entries(contract.events ?? {}).map(([name, event]) => {
                    const fields = Object.entries(event.detail ?? {}).map(([field, descriptor]) => describe(field, descriptor, { required: true }));
                    return { name, label: event.label, description: event.description,
                        groups: fields.length ? [{ title: "Detail payload", fields }] : [] };
                });
                const slots = kind === "component" || kind === "page" ? Object.entries(contract.slots ?? {}).map(([name, slot]) =>
                    describe(name || "Default slot", slot, { required: true })) : [];
                const sections = [
                    { title: "Properties", entries: properties },
                    { title: "Methods", entries: methods },
                    { title: "Events", entries: events },
                    { title: "Slots", entries: slots },
                    { title: "Types", entries: Object.entries(types).map(([name, type]) => describe(name, type)) }
                ].filter(section => section.entries.length);

                // Keep authored source and state as data for the read-only Components.
                const examples = (contract.examples ?? []).map(example => ({
                    ...example,
                    title: example.name.replace(/[-_]+/g, " ").replace(/^./, letter => letter.toUpperCase()),
                    language: example.language ?? "",
                    hasState: Object.hasOwn(example, "state")
                }));
                return {
                    kind, id, contractId, moduleId, sections, examples,
                    kindLabel: kinds[kind].label,
                    label: contract.label || id,
                    icon: contract.icon || kinds[kind].icon,
                    description: contract.description,
                    empty: sections.length === 0 && examples.length === 0
                };
            },

            describeValue(name, descriptor, types, { required, propertyKind } = {}) {
                // Preserve effective schemas and distinguish explicit defaults from missing defaults.
                const referenced = descriptor.ref && Object.hasOwn(types, descriptor.ref) ? types[descriptor.ref] : null;
                const type = referenced?.type ?? descriptor.type;
                const schema = referenced?.schema ?? descriptor.schema;
                const badges = [];
                if (required) badges.push(descriptor.required ? "Required" : "Optional");
                if (Object.hasOwn(descriptor, "readonly")) badges.push(descriptor.readonly ? "Read-only" : "Writable");
                if (descriptor.format) badges.push(`Format · ${descriptor.format}`);
                const flags = propertyKind === "component"
                    ? ["attribute", "attributeParser", "reflect", "state", "changeDetection"]
                    : propertyKind === "page" ? ["query", "queryParser", "reflect", "state", "context"] : [];
                for (const flag of flags) {
                    if (Object.hasOwn(descriptor, flag)) badges.push(`${flag} · ${descriptor[flag]}`);
                }
                return {
                    ...descriptor, name, type, schema, badges,
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
