import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-menugroup", {
    style: `
        :host {}
        :host div {line-height:2em; padding-left:.5em; padding-right:.5em;}
        :host div x-icon {}
        :host div label {
            font-size:var(--x-font-size-small); 
            font-weight:600;             
        }
        
    `,
    state: {
        icon: "",
        label: "",
    },
    settings: {
        observedAttributes: ["icon", "label"],
    },
    template: `
        <div>
            <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
            <label>{{ state.label }}</label>
        </div>
        <slot></slot>
    `

});

