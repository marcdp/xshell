import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-button", {
    style: `
        :host {border: 1px var(--x-background-x-gray) solid; display:inline-block; padding:.5em .8em .5em .8em; border-radius:var(--x-input-border-radius); user-select: none; display:inline-flex; align-items:center;}
        :host(:hover) {background:var(--x-background-gray); cursor:pointer; border-color: var(--x-background-x-gray); }
        :host(:active) {background:var(--x-background-x-gray);}
        :host x-icon {font-size:.9em; }
        :host x-icon[icon] {margin-right:.45em;}

        :host([appearance='accent']) {background:var(--x-color-main); color:var(--x-font-color-inverse); border:none;}
        :host([appearance='accent']) x-icon {fill:red; color:var(--x-font-color-inverse);}
        :host([appearance='accent']:hover) {background:var(--x-color-main-light);}
        :host([appearance='accent']:active) {background:var(--x-color-main-x-light);}

        :host([appearance='lightweight']) {border:none;}
        :host([appearance='lightweight']:hover) {}
        :host([appearance='lightweight']:active) {}

        :host([appearance='outline']) {border-color: var(--x-background-xx-gray); }
        :host([appearance='outline']:hover) {background:var(--x-background); border-color:var(--x-background-xxx-gray);}
        :host([appearance='outline']:active) {border-color: var(--x-background-xx-gray);}
    `,
    template: `
        <x-icon x-show="state.icon" x-attr:icon="state.icon"></x-icon>
        <span><slot></slot></span>
    `,
    state: {
        icon: "",
        command: "",
    },
    settings: {
        observedAttributes: ["icon", "command"]
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                this.addEventListener("click", (event) => {
                    //raise page:command event
                    this.dispatchEvent(new CustomEvent("page:command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: false}));
                    //cancel event
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }, true);

            }
        }
    }
});

