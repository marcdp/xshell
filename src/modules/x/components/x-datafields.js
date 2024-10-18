import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-datafields", {
    style: `
        :host {
            display:block;
        }
        :host div {display: grid; grid-gap: 1.5em;}
        :host([columns='2']) div { grid-template-columns: repeat(2, 1fr); }
        :host([columns='3']) div { grid-template-columns: repeat(3, 1fr); }
        :host([columns='4']) div { grid-template-columns: repeat(4, 1fr); }
        :host([columns='5']) div { grid-template-columns: repeat(5, 1fr); }
        :host([columns='6']) div { grid-template-columns: repeat(6, 1fr); }

        ::slotted([columns='2']) {grid-column: span 2 / span 1;}
        ::slotted([columns='3']) {grid-column: span 3 / span 1;}
        ::slotted([columns='4']) {grid-column: span 4 / span 1;}
        ::slotted([columns='5']) {grid-column: span 5 / span 1;}
        ::slotted([columns='6']) {grid-column: span 6 / span 1;}
    `,
    template: `
        <label x-if="state.label" x-text="state.label"></label>
        <p x-if="state.message" x-text="state.message"></p>
        <div>
            <slot></slot>
        </div>
    `,
    state: {
        label: "",
        message: "",
        columns: 2
    },
    settings:{
        observedAttributes:["label","message","columns"]
    }
});

