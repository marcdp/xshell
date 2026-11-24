
// component
export default {
    contract: {
        description: "Displays a collapsible accordion section.",
        tags: ["content", "accordions", "disclosure"],
        events: {
            toggle: {
                description: "Raised when the panel expansion state changes."
            }
        },
        properties: {
            label:    {type:"string",  default:"",    attribute:true, state:true, description:"Label for the accordion panel"},
            description: {type:"string",  default:"", attribute:true, state:true, description:"Description for the accordion panel"},
            icon:     {type:"string",  default:"",    attribute:true, state:true, description:"Icon for the accordion panel"},
            expanded: {type:"boolean", default:false, attribute:true, state:true, description:"Whether the accordion panel is expanded by default"}
        },
        methods: {},
        slots: {
            "": {
                description: "Content for the accordion panel body"
            },
            toolbar: {
                description: "Content for the accordion panel toolbar"
            }
        },
        examples: [
            {
                name: "with-toolbar",
                description: "Place a status badge in the panel header and show the body initially.",
                template: `
                    <x-accordion>
                        <x-accordion-panel label="Details" icon="x-info" expanded>
                            <x-badge slot="toolbar" value="New"></x-badge>
                            <p>Project details</p>
                        </x-accordion-panel>
                    </x-accordion>
                `
            }
        ]
    },
    style: `
        :host {display:block;}
        .header {display:flex; min-height:2.5em; align-items:center; cursor:pointer; user-select: none; line-height:var(--x-datafield-line-height); padding-left:1em; padding-right:.5em; padding-top:.5em; padding-bottom:.5em; box-sizing:border-box;}
        .header > x-icon {margin-right:.75em; transition: transform var(--x-transition-duration); }
        .header > x-icon:first-child {align-self:start;}
        .header > label {flex:1; cursor:pointer; display:inline; }
        .header > label .label {font-weight:500;}
        .header > label .description {color: var(--x-color-text-x-gray); display:block; font-size:var(--x-font-size-small); margin-top:-.15em;}
        .header > .toolbar {margin-right:1em; }
        .header:hover {background: var(--x-color-background-x-gray); }
        .header[expanded] x-icon:last-child {transform:rotate(-180deg); }
        
        .body {
            display: grid; 
            grid-template-rows: 0fr;
            transition: var(--x-transition-duration) grid-template-rows ease;
            border-bottom:var(--x-accordion-border); 
            border-bottom-width:1px;
        }
        .body > div {overflow: hidden;}
        .body > div > div {padding:1em;}
        .body[expanded] {grid-template-rows: 1fr;}

        :host(:first-child) .header {border-radius: var(--x-accordion-border-radius) var(--x-accordion-border-radius) 0 0;}
        :host(:last-child) .body {border-bottom:none;}
        :host(:last-child) .header {border-radius: 0 0 var(--x-accordion-border-radius) var(--x-accordion-border-radius);}
        :host(:last-child) .header[expanded] {border-radius: 0;}
        :host(:first-child:last-child) .header {border-radius: var(--x-accordion-border-radius);}
        :host(:first-child:last-child) .header[expanded] {border-radius: var(--x-accordion-border-radius) var(--x-accordion-border-radius) 0 0;}

        ::slotted(*:first-child) {margin-top:0!important;}
    `,
    template: `
        <div class="header" x-on:click="toggle" x-attr:expanded="state.expanded">
            <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
            <label>
                <span class="label" x-text="state.label"></span>
                <span class="description" x-if="state.description">{{state.description}}</span>
            </label>
            <div class="toolbar">
                <slot name="toolbar"></slot>
            </div>
            <x-icon icon="x-keyboard-arrow-down"></x-icon>
        </div>
        <div class="body" x-attr:expanded="state.expanded">
            <div>
                <div>
                    <slot></slot>
                </div>
            </div>
        </div>
    `,
    state: {
    },
    controller({ state, host }) {
        return {
            collapse() {
                //collapse
                if (state.expanded) {
                    this.toggle();
                }
            },
            toggle() {
                //toggle
                state.expanded = !state.expanded;
                host.dispatchEvent(new CustomEvent("toggle", {bubbles: true, composed: false}));
            }
        }
    }
};

