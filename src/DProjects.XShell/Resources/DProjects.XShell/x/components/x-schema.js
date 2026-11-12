
 // Renders a small, flat JSON Schema object using existing XShell data fields.
 // Unsupported schema shapes fail explicitly instead of rendering incomplete data.
 const protectedNames = new Set(["__proto__", "prototype", "constructor"]);
 function escapeAttribute(value) {
     return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&#39;");
 }
 function isObject(value) {
     return value !== null && typeof value === "object" && !Array.isArray(value);
 }
 function makeTemplate(schema) {
     if (!isObject(schema) || schema.type !== "object" || !isObject(schema.properties)) {
         throw new Error("x-schema V1 requires a JSON Schema object with type 'object' and 'properties'.");
     }

     const required = new Set(schema.required || []);
     const fields = [];

     for (const [name, definition] of Object.entries(schema.properties)) {
         if (protectedNames.has(name)) {
             throw new Error(`Unsupported property name '${name}'.`);
         }
         if (!isObject(definition)) {
             throw new Error(`Invalid schema for property '${name}'.`);
         }
         const type = definition.type;
         let inputType;
         let domain = "";

         if (definition.enum !== undefined) {
             if (type !== "string" || !Array.isArray(definition.enum) ||
                 !definition.enum.every(value => typeof value === "string" && !/[|=]/.test(value))) {
                 throw new Error(`x-schema V1 supports only string enums without '|' or '=' (${name}).`);
             }
             inputType = "select";
             domain = definition.enum.map(value => `${value}=${value}`).join("|");
         } else if (type === "string") {
             inputType = definition.format === "date" ? "date" : "text";
         } else if (type === "number" || type === "integer") {
             inputType = "number";
         } else if (type === "boolean") {
             inputType = "checkbox";
         } else {
             throw new Error(`Unsupported JSON Schema type '${type}' for property '${name}'.`);
         }

         const attributes = [
             `type="${inputType}"`,
             `label="${escapeAttribute(definition.title || name)}"`,
             `x-model="${escapeAttribute(`state[${JSON.stringify(name)}]`)}"`
         ];
         if (definition.description) attributes.push(`description="${escapeAttribute(definition.description)}"`);
         if (domain) attributes.push(`domain="${escapeAttribute(domain)}"`);
         // x-datafield currently considers 0 and false empty, so those types
         // are checked in x-schema.validate() instead of using its required flag.
         if (required.has(name) && type === "string") attributes.push("required");
         if (type === "string") {
             if (definition.minLength !== undefined) attributes.push(`minlength="${escapeAttribute(definition.minLength)}"`);
             if (definition.maxLength !== undefined) attributes.push(`maxlength="${escapeAttribute(definition.maxLength)}"`);
             if (definition.pattern !== undefined) attributes.push(`pattern="${escapeAttribute(definition.pattern)}"`);
         }
         if (inputType === "number") {
             if (definition.minimum !== undefined) attributes.push(`min="${escapeAttribute(definition.minimum)}"`);
             if (definition.maximum !== undefined) attributes.push(`max="${escapeAttribute(definition.maximum)}"`);
             if (type === "integer") attributes.push('step="1"');
         }
         fields.push(`    <x-datafield ${attributes.join(" ")}></x-datafield>`);
     }

     return `<x-datafields columns="1">\n${fields.join("\n")}\n</x-datafields>`;
 }

 function applyDefaults(schema, value) {
     const updated = { ...value };
     let changed = false;
     for (const [name, definition] of Object.entries(schema.properties)) {
         if (!Object.hasOwn(updated, name) && Object.hasOwn(definition, "default")) {
             updated[name] = structuredClone(definition.default);
             changed = true;
         }
     }
     return changed ? updated : value;
 }


 // component
 export default {
     contract: {
         description: "Edits a flat object from an inline JSON Schema or a schema URL.",
         properties: {
             schema: { type: "object", default: null, attribute: true, attributeParser: "json", state: true, description: "Inline JSON Schema; takes precedence over src." },
             src: { type: "string", default: "", attribute: true, state: true, description: "URL to a JSON Schema, used when schema is null." },
             value: { type: "object", default: {}, attribute: true, attributeParser: "json", state: true, description: "Data object being edited." }
         },
         events: {
             change: { description: "Raised when the edited value changes.", detail: {
                 oldValue: { type: "object" },
                 newValue: { type: "object" }
             }}
         },
         methods: {
             validate: { description: "Returns errors for the supported fields.",
                 parameters: [{ name: "detail", type: "boolean" }],
                 returns: { type: "array" } 
            }
         },
         slots: {}
     },
     template: `
         <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>
         <x-template x-if="state.generated" x-prop:template="state.generated"
             x-prop:value="state.value" x-on:change="changed"></x-template>
     `,
     state: {
         generated: "",
         error: ""
     },
     controller({ state, events, host, loader }) {
         let activeSchema = null;
         let revision = 0;
         let abortController = null;

         return {
             load() {
                // load
                 events.on(state, ["change:schema", "change:src"], "refresh");
                 this.refresh();
             },
             unload() {
                // unload
                 revision++;
                 abortController?.abort();
             },

             
            async refresh() {
                // Prefer the supplied object. Fetch src only when no schema is provided.
                const current = ++revision;
                abortController?.abort();
                abortController = null;
                activeSchema = null;
                state.generated = "";
                state.error = "";

                try {
                    let schema = state.schema;

                    if (schema === null || schema === undefined) {
                        const src = state.src;
                        if (!src) return;

                        if (src.startsWith("schema:")) {
                            // The Loader handles logical XShell schema references.
                            schema = await loader.load(src);
                        } else {
                            // Regular URLs are browser resources, not Loader locators.
                            abortController = new AbortController();
                            const response = await fetch(src, {
                                signal: abortController.signal
                            });

                            if (!response.ok) {
                                throw new Error(
                                    `Cannot load schema '${src}' (${response.status} ${response.statusText}).`
                                );
                            }

                            schema = await response.json();
                        }
                    }

                    if (current !== revision) return;

                    const generated = makeTemplate(schema);

                    if (!isObject(state.value)) {
                        throw new Error("x-schema value must be an object.");
                    }

                    activeSchema = schema;
                    state.value = applyDefaults(schema, state.value);
                    state.generated = generated;

                } catch (error) {
                    if (current !== revision || error.name === "AbortError") return;
                    state.error = error.message || String(error);
                }
            },


             changed({ event }) {
                // changed
                 if (state.value !== event.detail.newValue) state.value = event.detail.newValue;
                 host.dispatchEvent(new CustomEvent("change", {
                     detail: event.detail,
                     bubbles: true,
                     composed: false
                 }));
             },

             validate(detail = false) {
                // validate
                 if (state.error) return [{ type: "error", label: "Schema", message: state.error }];
                 if (!activeSchema || !state.generated) return [{ type: "error", label: "Schema", message: "Schema not ready." }];

                 const template = host.shadowRoot.querySelector("x-template");
                 const errors = template ? template.validate(detail) : [{ type: "error", label: "Schema", message: "Editor not ready." }];
                 const value = state.value;
                 for (const name of activeSchema.required || []) {
                     if (!Object.hasOwn(value, name) || value[name] === null || value[name] === undefined || value[name] === "") {
                         if (!errors.some(error => error.label === name)) {
                             errors.push({ type: "error", label: name, message: "Required" });
                         }
                     }
                 }
                 for (const [name, definition] of Object.entries(activeSchema.properties)) {
                     const item = value[name];
                     if (item === undefined || item === null || item === "") continue;
                     if (definition.type === "integer" && !Number.isInteger(item)) {
                         errors.push({ type: "error", label: name, message: "Must be an integer" });
                     } else if (definition.type === "number" && (typeof item !== "number" || !Number.isFinite(item))) {
                         errors.push({ type: "error", label: name, message: "Must be a number" });
                     } else if (definition.type === "boolean" && typeof item !== "boolean") {
                         errors.push({ type: "error", label: name, message: "Must be a boolean" });
                     }
                 }
                 return errors;
             }
         };
     }
 };
