
 // component
const protectedNames = new Set(["__proto__", "prototype", "constructor"]);
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const escapeAttribute = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");
const schemaType = schema => Array.isArray(schema.type) && schema.type.length === 2 && schema.type.includes("null") ? schema.type.find(type => type !== "null") : schema.type;

function initialItem(schema) {
    const type = schemaType(schema);
    let value = Object.hasOwn(schema, "default") ? structuredClone(schema.default) :
        type === "object" ? {} : type === "array" ? [] : type === "boolean" ? false :
        type === "number" || type === "integer" ? 0 : schema.enum?.[0] ?? "";

    if (type === "object" && isObject(value)) {
        for (const [name, definition] of Object.entries(schema.properties || {})) {
            if (protectedNames.has(name)) throw new Error(`Unsupported property name '${name}'.`);
            if (!Object.hasOwn(value, name)) value[name] = initialItem(definition);
        }
    }
    return value;
}

function makeTemplate(schema) {
    if (!isObject(schema) || schema.type !== "object" || !isObject(schema.properties)) {
        throw new Error("x-schema requires an object schema with properties.");
    }

    function field(definition, path, name, required = false, depth = 0) {
        if (!isObject(definition)) throw new Error(`Invalid schema for '${name}'.`);

        const type = schemaType(definition);
        const inputType = type === "object" ? "object" : type === "array" ? "list" : type === "boolean" ? "checkbox" :
            type === "number" || type === "integer" ? "number" : type === "string" ?
            definition.enum ? "select" : definition.writeOnly ? "password" : definition.format === "date" ? "date" : "text" : null;

        if (!inputType) throw new Error(`Unsupported JSON Schema type '${type}' for property '${name}'.`);

        const attributes = [
            `type="${inputType}"`,
            `label="${escapeAttribute(definition.title || name)}"`,
            `x-model="${escapeAttribute(path)}"`
        ];

        if (definition.description) attributes.push(`description="${escapeAttribute(definition.description)}"`);
        if (required && (type === "string" || type === "array" || type === "object")) attributes.push("required");

        if (definition.enum) {
            if (type !== "string" || !Array.isArray(definition.enum) ||
                !definition.enum.every(value => typeof value === "string" && !/[|=]/.test(value))) {
                throw new Error(`Unsupported enum for '${name}'.`);
            }
            attributes.push(`domain="${escapeAttribute(definition.enum.map(value => `${value}=${value}`).join("|"))}"`);
        }

        if (type === "string") {
            if (definition.minLength !== undefined) attributes.push(`minlength="${escapeAttribute(definition.minLength)}"`);
            if (definition.maxLength !== undefined) attributes.push(`maxlength="${escapeAttribute(definition.maxLength)}"`);
            if (definition.pattern !== undefined) attributes.push(`pattern="${escapeAttribute(definition.pattern)}"`);
        }

        if (type === "number" || type === "integer") {
            if (definition.minimum !== undefined) attributes.push(`min="${escapeAttribute(definition.minimum)}"`);
            if (definition.maximum !== undefined) attributes.push(`max="${escapeAttribute(definition.maximum)}"`);
            if (type === "integer") attributes.push('step="1"');
        }

        if (type === "object") {
            attributes.push(`default="${escapeAttribute(JSON.stringify(initialItem(definition)))}"`);
            const children = isObject(definition.properties) ? fields(definition, path, depth) : "";
            return `<x-datafield ${attributes.join(" ")}>${children}</x-datafield>`;
        }

        if (type === "array") {
            if (!isObject(definition.items)) throw new Error(`Array '${name}' requires a supported items schema.`);
            const index = `index${depth}`;
            attributes.push("add", `item-default="${escapeAttribute(JSON.stringify(initialItem(definition.items)))}"`);
            if (definition.minItems !== undefined) attributes.push(`minlength="${escapeAttribute(definition.minItems)}"`);
            if (definition.maxItems !== undefined) attributes.push(`maxlength="${escapeAttribute(definition.maxItems)}"`);

            return `<x-datafield ${attributes.join(" ")}>
                <x-datafields class="grid" columns="1" move remove
                    x-for="${escapeAttribute(`(item${depth},${index}) in ${path}`)}">
                    ${field(definition.items, `${path}[${index}]`, definition.items.title || "Item", false, depth + 1)}
                </x-datafields>
            </x-datafield>`;
        }

        return `<x-datafield ${attributes.join(" ")}></x-datafield>`;
    }

    function fields(schema, path, depth) {
        const required = new Set(schema.required || []);
        return `<x-datafields columns="1">${Object.entries(schema.properties || {}).map(([name, definition]) => {
            if (protectedNames.has(name)) throw new Error(`Unsupported property name '${name}'.`);
            return field(definition, `${path}[${JSON.stringify(name)}]`, name, required.has(name), depth);
        }).join("\n")}</x-datafields>`;
    }

    return fields(schema, "state", 0);
}

function applyDefaults(schema, value) {
    if (!isObject(value)) return value;
    let result = value;

    for (const [name, definition] of Object.entries(schema.properties || {})) {
        if (protectedNames.has(name)) throw new Error(`Unsupported property name '${name}'.`);

        if (!Object.hasOwn(result, name)) {
            if (result === value) result = { ...value };
            result[name] = Object.hasOwn(definition, "default") ? structuredClone(definition.default) : undefined;
        }

        const type = schemaType(definition);
        const current = result[name];
        let updated = current;

        if (type === "object" && isObject(current)) updated = applyDefaults(definition, current);
        if (type === "array" && Array.isArray(current) && isObject(definition.items)) {
            const items = current.map(item => schemaType(definition.items) === "object" ? applyDefaults(definition.items, item) : item);
            if (items.some((item, index) => item !== current[index])) updated = items;
        }

        if (updated !== current) {
            if (result === value) result = { ...value };
            result[name] = updated;
        }
    }

    return result;
}

export default {
    contract: {
        description: "Edits an object using JSON Schema, x-datafield and x-datafields.",
        properties: {
            schema: { type: "object", default: null, attribute: true, attributeParser: "json", state: true, description: "Inline JSON Schema; takes precedence over src." },
            src: { type: "string", default: "", attribute: true, state: true, description: "JSON Schema URL or schema: reference." },
            value: { type: "object", default: {}, attribute: true, attributeParser: "json", state: true, description: "Object being edited." }
        },
        events: {
            change: {
                description: "Raised when edited values change.",
                detail: { oldValue: { type: "object" }, newValue: { type: "object" } }
            }
        },
        methods: {
            validate: {
                description: "Validates the edited object against its schema.",
                parameters: [{ name: "detail", type: "boolean" }],
                returns: { type: "array" }
            }
        },
        slots: {}
    },

    template: `
        <x-notice x-if="state.error" type="error" x-prop:message="state.error"></x-notice>
        <x-template x-if="state.generated" x-prop:template="state.generated" x-prop:value="state.value" x-on:change="changed"></x-template>
        <x-json x-prop:value="state.value"></x-json>
    `,

    state: { 
        generated: "", 
        error: "" 
    },

    controller({ state, events, host, loader, jsonValidator }) {
        let activeSchema = null, revision = 0, abortController = null;

        return {
            load() {
                events.on(state, ["change:schema", "change:src"], "refresh");
                events.on(state, "change:value", ({ newValue }) => {
                    if (!activeSchema || !isObject(newValue)) return;
                    const updated = applyDefaults(activeSchema, newValue);
                    if (updated !== newValue) state.value = updated;
                });
                this.refresh();
            },

            unload() {
                revision++;
                abortController?.abort();
            },

            async refresh() {
                
                const current = ++revision;
                abortController?.abort();
                abortController = null;
                activeSchema = null;
                state.generated = "";
                state.error = "";

                try {
                    let schema = state.schema;

                    if (schema === null || schema === undefined) {
                        if (!state.src) return;
                        if (state.src.startsWith("schema:")) schema = await loader.load(state.src);
                        else {
                            abortController = new AbortController();
                            const response = await fetch(state.src, { signal: abortController.signal });
                            if (!response.ok) throw new Error(`Cannot load schema '${state.src}' (${response.status}).`);
                            schema = await response.json();
                        }
                    }

                    if (current !== revision) return;

                    const generated = makeTemplate(schema);
                    if (!isObject(state.value)) throw new Error("x-schema value must be an object.");

                    activeSchema = schema;
                    const updated = applyDefaults(schema, state.value);
                    if (updated !== state.value) state.value = updated;
                    state.generated = generated;
                } catch (error) {
                    if (current !== revision || error.name === "AbortError") return;
                    state.error = error.message || String(error);
                }
            },

            changed({ event }) {
                const { oldValue, newValue } = event.detail;
                state.value = newValue;
                host.dispatchEvent(new CustomEvent("change", {
                    detail: { oldValue, newValue },
                    bubbles: true,
                    composed: false
                }));
            },

            validate(detail = false) {
                if (state.error) return [{ type: "error", label: "Schema", message: state.error }];
                if (!activeSchema || !state.generated) return [{ type: "error", label: "Schema", message: "Schema not ready." }];

                const template = host.shadowRoot.querySelector("x-template");
                if (!template) return [{ type: "error", label: "Schema", message: "Editor not ready." }];

                try {
                    const data = JSON.parse(JSON.stringify(state.value));
                    const result = jsonValidator.validate(data, activeSchema);
                    return result.valid ? [] : (result.errors || []).map(error => ({
                        type: "error",
                        label: "Schema",
                        path: error.instanceLocation || error.path || "",
                        message: error.message || error.error || JSON.stringify(error)
                    }));
                } catch (error) {
                    return [{ type: "error", label: "Schema", message: error.message || String(error) }];
                }
            }
        };
    }
};
