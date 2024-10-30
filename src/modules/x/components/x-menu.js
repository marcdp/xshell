import XElement from "../ui/x-element.js";
import ui from "../../../ui.js";

// class
export default XElement.define("x-menu", {
    style: `
        :host {
            display:flex; 
            width:var(--x-menu-width); 
            flex-direction:column; 
            border-radius:var(--x-menu-border-radius); 
            padding:.25em; 
            box-shadow:var(--x-menu-shadow); 
            border:var(--x-menu-border); 
        }        
        :host(.plain) {
            width:unset;
            padding:0;
            box-shadow:none;
            border:none;
            margin-left:-.4em;
            margin-right:-.4em;
            
        }
    `,
    template: `
        <slot></slot>        
    `,
    state: {
    }
});

