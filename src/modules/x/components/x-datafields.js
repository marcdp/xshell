import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-datafields", {
    style: `
        :host {
            display:block;
        }
        :host div.body {display: grid; grid-gap: .5em 1.5em; flex:1;}
        :host([columns='2']) div.body { grid-template-columns: repeat(2, 1fr); }
        :host([columns='3']) div.body { grid-template-columns: repeat(3, 1fr); }
        :host([columns='4']) div.body { grid-template-columns: repeat(4, 1fr); }
        :host([columns='5']) div.body { grid-template-columns: repeat(5, 1fr); }
        :host([columns='6']) div.body { grid-template-columns: repeat(6, 1fr); }

        ::slotted([columns='2']) {grid-column: span 2 / span 1;}
        ::slotted([columns='3']) {grid-column: span 3 / span 1;}
        ::slotted([columns='4']) {grid-column: span 4 / span 1;}
        ::slotted([columns='5']) {grid-column: span 5 / span 1;}
        ::slotted([columns='6']) {grid-column: span 6 / span 1;}

        :host label {font-weight:600; display:inline-block; position:relative; line-height:2em; padding-bottom:.25em;  margin-bottom:1.5em;}
        :host label::after {content:""; border-radius:.1em; position:absolute; width:100%; bottom:0; left:0; border:.125em var(--x-text-color) solid;}
        :host p {margin:0; margin-bottom:1.5em;}

        :host .row {display:flex;}
        :host .row .buttons {padding-left:.5em; }

        :host(.grid) {
            --x-input-label-display: none; 
            __--x-input-border: none;
            __--x-input-border-radius: 0;
            __--x-input-border-focus: none;
            __--x-input-background:none;
            --x-input-border-bottom: var(--x-input-border);
            padding:0;       
        }
        :host(.grid:first-child) {
            --x-input-label-display: block; 
        }
        :host(.grid) {margin-bottom:.15em;}

        ___:host(.grid) {--x-input-background: var(--x-background-alt); margin-bottom:.15em;}
        ___:host(.grid:nth-child(odd)) {--x-input-background: var(--x-background-alt);}
        ___:host(.grid:nth-child(odd)) .row .buttons {_background: var(--x-background-alt);}
        
        :host(.grid:nth-child(even)) {}

        :host(.grid) div.body {display:flex; grid-gap:.15em;}
        
        :host(.grid) .row .icon {align-self:start; margin-top:.35em; width:1.5em;}
        :host(.grid:first-child) .row .icon {margin-top:2em;}

        :host(.grid) .row .buttons {padding:0; margin-left:.2em; display:flex; gap:.15em; align-items:start; }
        :host(.grid:first-child) .row .buttons {margin-top:1.65em; }

        :host(.grid) ::slotted(x-datafield) {}
        :host(.grid:first-child) .row .buttons x-button[data-direction='up'] { display:none;}
        :host(.grid:last-child) .row .buttons x-button[data-direction='down'] {display:none;}
        
    `,
    template: `
        <label x-if="state.label" x-text="state.label"></label>
        <p x-if="state.message" x-text="state.message"></p>
        <div class="row">
            <div class="icon" x-if="state.edit || state.remove">
                <x-icon icon="x-menu"></x-icon>
            </div>
            <div class="body">
                <slot></slot>
            </div>
            <div x-if="state.edit || state.remove || state.move" class="buttons">
                <x-button x-if="state.move"     icon="x-keyboard-arrow-down" data-direction="down" x-on:click="move"></x-button>
                <x-button x-if="state.move"     icon="x-keyboard-arrow-up"   data-direction="up"   x-on:click="move"></x-button>
                <x-button x-if="state.edit"     icon="x-edit" x-on:click="edit"></x-button>
                <x-button x-if="state.remove"   icon="x-close" x-on:click="remove"></x-button>
            </div>
        </div>
    `,
    state: {
        label: "",
        message: "",
        columns: 2,
        remove:false,
        move:false,
        edit: false,
    },
    settings:{
        observedAttributes:["label","message","columns","remove", "move", "edit"]
    },
    methods:{
        onCommand(command, args){
            if (command == "load") {
                //load

            } else if (command == "move") {
                //move
                let event = args.event;
                let direction = event.target.dataset.direction;
                this.dispatchEvent(new CustomEvent("move", {detail: {direction: direction}, bubbles: true, composed: false}));

            } else if (command == "edit") {
                //edit
                this.dispatchEvent(new CustomEvent("edit", {bubbles: true, composed: false}));

            } else if (command == "remove") {
                //remove
                this.dispatchEvent(new CustomEvent("remove", {bubbles: true, composed: false}));

            }
        }
    }
});

