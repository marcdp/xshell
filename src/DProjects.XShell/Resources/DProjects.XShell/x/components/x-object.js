
 // component
export default {
    contract: {
        description: "Displays a JavaScript value as an expandable object tree.",
        events: {},
        properties: {
            value: { type: "any", default: null, state: true, description: "Value to display." },
            name: { type: "string", default: "", attribute: true, state: true, description: "Optional property name." },
            expanded: { type: "boolean", default: false, attribute: true, state: true, description: "Whether the node is expanded." },            
        },
        methods: {
            refresh: { description: "Rebuilds the displayed tree after an in-place value mutation." },
            expand: { description: "Expands the current node." },
            collapse: { description: "Collapses the current node." },
            toggle: { description: "Toggles the current node." }
        },
        slots: {}
    },
    style: `
        :host { display:block; min-width:0; }
        .row { display:flex; align-items:flex-start; min-width:0; line-height:1.5em; padding:.05em .25em; border-radius:.25em; }
        .row:hover { background:var(--x-object-row-background-hover); }
        .node { display:flex; align-items:flex-start; min-width:0; }
        .node.expandable { cursor:pointer; user-select:none; appearance:none; border:0; background:none; padding:0; font:inherit; color:inherit; text-align:left; }
        .node.expandable:hover .toggle, .node.expandable:hover .name { color:var(--x-color-primary); }
        .node.expandable:focus-visible { outline:2px solid var(--x-color-primary); outline-offset:2px; }
        .toggle { flex:none; width:1.1em; user-select:none; margin-right:.25em; }
        .toggle.empty { visibility:hidden; }
        .toggle:not(.expanded) { transform:rotate(-90deg); }
        .name { flex:none; margin-right:.35em; color:var(--x-object-key-color); }
        .name:not(:empty)::after { content:":"; }
        .value { min-width:0; overflow-wrap:anywhere; }
        .children { margin-left:1.1em; padding-left:.35em; border-left:1px solid var(--x-object-guide-color); }
        .string { color:var(--x-object-string); }
        .number { color:var(--x-object-number); }
        .boolean { color:var(--x-object-boolean); }
        .null { color:var(--x-object-null); }
        .undefined { color:var(--x-object-undefined); }
        .date { color:var(--x-object-date); }
        .summary { color:var(--x-object-summary-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .object, .array, .accessor, .circular { color:var(--x-object-summary-color); }
    `,
    template: `
        <div class="row">
            <button x-if="state.expandable" type="button" class="node expandable"
                x-attr:aria-expanded="state.expanded ? 'true' : 'false'" x-on:click="toggle">
                <span class="toggle" x-class:expanded="state.expanded"><x-icon icon="x-arrow-down-fill"></x-icon></span>
                <span x-if="state.name" class="name" x-text="state.name"></span>
                <span class="value summary" x-text="state.expanded ? state.openText : state.summary"></span>
            </button>
            <div x-else class="node">
                <span class="toggle empty">▶</span>
                <span x-if="state.name" class="name" x-text="state.name"></span>
                <span class="value" x-attr:class="'value ' + state.type" x-text="state.text"></span>
            </div>
        </div>
        <div x-if="state.expandable && state.expanded" class="children">
            <x-object x-for="entry in state.entries" x-attr:name="entry.name"
                x-prop:_inspection="entry.inspection" x-prop:value="entry.renderValue"></x-object>
            <div class="row"><span class="summary" x-text="state.closeText"></span></div>
        </div>
    `,
    state: { type: "undefined", text: "", expandable: false, summary: "", openText: "", closeText: "", entries: [] },
    controller({ state, events }) {
        const typeOf = value => value === null ? "null" : value instanceof Date ? "date" : Array.isArray(value) ? "array" : typeof value;
        const nameOf = value => {
            const ctor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value) || {}, "constructor")?.value;
            const name = typeof ctor === "function" ? Object.getOwnPropertyDescriptor(ctor, "name")?.value : "";
            return typeof name === "string" && name !== "Object" ? name : "";
        };
        const print = (value, ancestors = []) => {
            const type = typeOf(value);
            if ((type === "array" || type === "object") && ancestors.includes(value)) return "[Circular]";
            if (type === "array") return `Array(${value.length})`;
            if (type === "object") return `${nameOf(value) ? nameOf(value) + " " : ""}${Object.keys(value).length ? "{…}" : "{}"}`;
            if (type === "string") return JSON.stringify(value);
            if (type === "null" || type === "undefined") return type;
            if (type === "date") return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
            if (type === "function") {
                const name = Object.getOwnPropertyDescriptor(value, "name")?.value;
                return `ƒ ${typeof name === "string" && name ? name : ""}()`;
            }
            return String(value);
        };

        return {
            load() {
                events.on(state, ["change:value", "change:_inspection"], "refresh");
                this.refresh();
            },
            refresh() {
                const value = state.value, type = typeOf(value), context = state._inspection;
                const ancestors = context?.ancestors || [];
                state.type = type;
                state.entries = [];
                state.expandable = false;
                state.summary = state.openText = state.closeText = state.text = "";

                if (context?.accessor) {
                    state.type = "accessor";
                    state.text = context.accessor;
                    return;
                }
                if (type !== "object" && type !== "array") {
                    state.text = print(value);
                    return;
                }
                if (ancestors.includes(value)) {
                    state.type = "circular";
                    state.text = "[Circular]";
                    return;
                }

                const branch = [...ancestors, value];
                const entries = Object.keys(value).map(name => {
                    const descriptor = Object.getOwnPropertyDescriptor(value, name);
                    const accessor = descriptor && !Object.hasOwn(descriptor, "value")
                        ? descriptor.get && descriptor.set ? "[Getter/Setter]" : descriptor.get ? "[Getter]" : "[Setter]" : null;
                    const item = accessor ? undefined : descriptor?.value;
                    return { name, value: item, renderValue: typeof item === "function" ? () => item : item,
                        inspection: { ancestors: branch, accessor } };
                });
                const name = type === "object" ? nameOf(value) : "";
                const content = entries.map(entry => {
                    const text = entry.inspection.accessor || print(entry.value, branch);
                    return type === "array" ? text : `${entry.name}: ${text}`;
                }).join(", ");
                const summary = type === "array" ? `[${content}]` : `${name ? name + " " : ""}{${content}}`;

                state.entries = entries;
                state.expandable = entries.length > 0;
                state.summary = summary.length > 100 ? summary.slice(0, 99) + "…" : summary;
                state.openText = type === "array" ? "[" : `${name ? name + " " : ""}{`;
                state.closeText = type === "array" ? "]" : "}";
                if (!state.expandable) state.text = state.summary;
            },
            toggle() { if (state.expandable) state.expanded = !state.expanded; },
            expand() { if (state.expandable) state.expanded = true; },
            collapse() { state.expanded = false; }
        };
    }
};
