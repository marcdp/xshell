import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-contextmenu", {
    style: `
        :host {
            background:var(--x-menu-background);
            position:absolute;
            z-index:10;
            display:flex; 
            width:var(--x-menu-width); 
            flex-direction:column; 
            border-radius:var(--x-menu-border-radius); 
            padding:.25em; 
            box-shadow:var(--x-menu-shadow); 
            border:var(--x-menu-border); 
        }
    `,
    template: `
        <slot></slot>
    `
});

