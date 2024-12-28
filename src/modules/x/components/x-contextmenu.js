import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-contextmenu", {
    style: `
        :host {
            background:var(--x-contextmenu-background);
            width:var(--x-menu-width);
            position:absolute;
            z-index:10;
            display:flex; 
            width:var(--x-contextmenu-width); 
            flex-direction:column; 
            border-radius:var(--x-contextmenu-border-radius); 
            padding: var(--x-contextmenu-padding); 
            box-shadow:var(--x-contextmenu-shadow); 
            border:var(--x-contextmenu-border); 
            
        }
    `,
    template: `
        <slot></slot>
    `
});

