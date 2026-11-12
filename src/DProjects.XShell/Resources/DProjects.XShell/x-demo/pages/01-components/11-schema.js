
 // page
export default {
    meta: {
        title: "Schema",
        description: "Generate editable fields from a JSON Schema."
    },

    template: `
        <p>The <code>x-schema</code> Component generates editable fields from a JSON Schema.
        Pass the schema as an object with <code>schema</code>, or load a JSON Schema file using <code>src</code>.
        The <code>value</code> property contains the edited object.</p>

        <h2>Inline schema</h2>
        <p>The schema below describes strings, a number, a checkbox, and a selection.</p>
        <x-schema
            ref="inline"
            x-prop:schema="state.inlineSchema"
            x-prop:value="state.inlineValue"
            x-on:change="onInlineChange">
        </x-schema>
        <p>
            <x-button label="Validate" command="validateInline"></x-button>
            <x-button label="Reset" command="resetInline"></x-button>
        </p>
        <x-notice x-if="state.inlineStatus"
            x-attr:type="state.inlineInvalid ? 'error' : 'success'"
            x-attr:message="state.inlineStatus"></x-notice>
        <p>Current value:</p>
        <x-json x-prop:value="state.inlinePreview"></x-json>
        <pre x-pre><code>&lt;x-schema
    x-prop:schema="state.inlineSchema"
    x-prop:value="state.inlineValue"
    x-on:change="onInlineChange"&gt;
&lt;/x-schema&gt;</code></pre>

        <hr/>

        <h2>Schema loaded from src</h2>
        <p>This example fetches a JSON Schema from the <code>x-demo</code> Module's
        <code>schemas/schema-example.schema.json</code> file.</p>
        <p>Schema URL: <code>{{ state.sourceUrl }}</code></p>
        <x-schema
            ref="source"
            x-prop:src="state.sourceUrl"
            x-prop:value="state.sourceValue"
            x-on:change="onSourceChange">
        </x-schema>
        <p>
            <x-button label="Validate" command="validateSource"></x-button>
            <x-button label="Reset" command="resetSource"></x-button>
        </p>
        <x-notice x-if="state.sourceStatus"
            x-attr:type="state.sourceInvalid ? 'error' : 'success'"
            x-attr:message="state.sourceStatus"></x-notice>
        <p>Current value:</p>
        <x-json x-prop:value="state.sourcePreview"></x-json>
        <pre x-pre><code>&lt;x-schema
    x-prop:src="state.sourceUrl"
    x-prop:value="state.sourceValue"
    x-on:change="onSourceChange"&gt;
&lt;/x-schema&gt;</code></pre>

        <h2>Validation</h2>
        <p>Use <code>validate()</code> to obtain the field errors. The first version supports
        flat object schemas with strings, numbers, integers, booleans, and string enums.</p>
    `,

    state: {
        inlineSchema: {
            type: "object",
            properties: {
                name: { type: "string", title: "Name", minLength: 2 },
                age: { type: "integer", title: "Age", minimum: 0 },
                active: { type: "boolean", title: "Active" },
                role: { type: "string", title: "Role", enum: ["developer", "designer", "tester"] }
            },
            required: ["name", "role"]
        },
        inlineValue: { name: "Ada", age: 36, active: true, role: "developer" },
        inlinePreview: { name: "Ada", age: 36, active: true, role: "developer" },
        inlineStatus: "",
        inlineInvalid: false,

        sourceUrl: "",
        sourceValue: { title: "Example task", priority: "normal", estimate: 3, done: false },
        sourcePreview: { title: "Example task", priority: "normal", estimate: 3, done: false },
        sourceStatus: "",
        sourceInvalid: false
    },

    controller({ state, page, config }) {
        const validate = (ref, statusProperty, invalidProperty) => {
            const editor = page.host?.querySelector(`x-schema[ref="${ref}"]`);
            const errors = editor?.validate(true) || [
                { label: "Editor", message: "Schema editor is not available." }
            ];
            state[invalidProperty] = errors.length > 0;
            state[statusProperty] = errors.length
                ? errors.map(error => `${error.label || error.path || "Field"}: ${error.message}`).join("; ")
                : "Valid";
        };

        return {
            load() {
                state.sourceUrl = "schema:x-demo:/schemas/schema-example.schema.json";
            },
            onInlineChange({ event }) {
                state.inlinePreview = structuredClone(event.detail.newValue);
                state.inlineStatus = "";
            },
            onSourceChange({ event }) {
                state.sourcePreview = structuredClone(event.detail.newValue);
                state.sourceStatus = "";
            },
            validateInline() {
                validate("inline", "inlineStatus", "inlineInvalid");
            },
            validateSource() {
                validate("source", "sourceStatus", "sourceInvalid");
            },
            resetInline() {
                state.inlineValue = { name: "Ada", age: 36, active: true, role: "developer" };
                state.inlinePreview = structuredClone(state.inlineValue);
                state.inlineStatus = "";
            },
            resetSource() {
                state.sourceValue = { title: "Example task", priority: "normal", estimate: 3, done: false };
                state.sourcePreview = structuredClone(state.sourceValue);
                state.sourceStatus = "";
            }
        };
    }
};
