// component


// docs
export const docs = {
    examples: [
        {   name: "Basic",
            template: `
                <x-details label="Advanced options">
                    <p>Additional content.</p>
                </x-details>
            `
        },
        {   name: "Custom summary",
            template: `
                <x-details>
                    <strong slot="summary">More information</strong>
                    <p>Additional content.</p>
                </x-details>
            `
        }
    ]
};


// implementation
export default {
    contract: {
        description: "Displays a single expandable disclosure section.",
        events: {
            toggle: {
                description: "Raised when the open state changes."
            }
        },
        properties: {
            label: {type: "string", default: "", attribute: true, state: true, description: "Text displayed in the disclosure header."},
            description: {type: "string", default: "", attribute: true, state: true, description: "Description displayed below the label."},
            open: {type: "boolean",default: false,attribute: true,state: true,description: "Whether the disclosure content is expanded."},
            disabled: {type: "boolean",default: false,attribute: true,state: true,description: "Whether the disclosure can be toggled by the user."}
        },
        methods: {
            toggle: {description: "Toggles the disclosure state."},
            expand: {description: "Expands the disclosure."},
            collapse: {description: "Collapses the disclosure."}
        },
        slots: {
            "": {description: "Disclosure body content."},
            summary: {description: "Optional custom summary content. Replaces the label when provided."}
        }    
    },

    // style
    style: `
        :host {
            display: block;
        }
 
        .header {
            display: flex;
            align-items: center;
            color:var(--x-color-text)
            gap: .5em;
            min-height: 2.5em;
            padding: 0 .75em;
            padding-left:0;
            cursor: pointer;
            user-select: none;
        }

        :host([disabled]) .header { cursor: default; opacity: .6; }

        .header:hover {cursor:pointer;}
        .header:hover span {color:var(--x-color-primary)!important; }
        .header > .label { flex: 1; display:flex; align-items: baseline; }

        .chevron {flex: none; transition: transform var(--x-transition-duration); }

        .header[open] .chevron {transform: rotate(-90deg);}

        .body {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows var(--x-transition-duration) ease;
        }

        .body[open] {
            grid-template-rows: 1fr;
        }

        .body > div {
            overflow: hidden;
        }

        .content {
        }

        /* .card */
        :host(.card) {
            padding-left:1em;
            border:var(--x-card-border); 
            border-radius:var(--x-card-border-radius); 
            box-shadow:var(--x-card-shadow); 
            position:relative;
        }
        :host(.card) .label span.label {font-weight: 600;}
        :host(.card) .label span.description {color: var(--x-color-text-x-gray); }
        :host(.card) .label span.description:before {content:": "}
        :host(.card) .label:hover {}
        :host(.card) x-icon { right:.5em; position:absolute;}
        :host(.card) .body .content { padding: .5em 1em 1.5em; }
        :host(.card) ::slotted(p:first-child) {}
 
    `,
    // template
    template: `
        <div class="header" x-attr:open="state.open" x-on:mousedown="toggle">
            <div class="label">
                <slot name="summary">
                    <span class="label" x-text="state.label"></span>                    
                </slot>
                <x-icon class="chevron" icon="x-arrow-down-fill"></x-icon>
                <span class="description" x-if="state.description" x-text="state.description"></span>
            </div>            
        </div>
        <div class="body" x-attr:open="state.open">
            <div>
                <div class="content">
                    <slot></slot>
                </div>
            </div>
        </div>
    `,
    // controller
    controller({ state, host }) {
        const setOpen = (value) => {
            if (state.open === value) return;
            state.open = value;
            host.dispatchEvent(new CustomEvent("toggle", {bubbles: true, composed: false, detail: { open: state.open }}));
        };
        return {
            toggle(args) {
                const event = args.event;
                if (state.disabled) return;
                setOpen(!state.open);
                event.preventDefault();
            },

            expand() {
                if (state.disabled) return;
                setOpen(true);
            },

            collapse() {
                if (state.disabled) return;
                setOpen(false);
            }
        };
    }
};
