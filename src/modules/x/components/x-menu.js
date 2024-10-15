import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-menu", {
    style: `
        _:host {display:flex; width:var(--x-menu-width); flex-direction:column; border-radius:var(--x-menu-border-radius); padding:.25em; box-shadow:var(--x-menu-shadow); border:var(--x-menu-border); }
        
        :host(.menu-plain) {
            display:flex; 
            width:var(--x-menu-width); 
            flex-direction:column; 
            border-radius:var(--x-menu-border-radius); 
            padding:.25em; 
            box-shadow:var(--x-menu-shadow); 
            border:var(--x-menu-border); 
        }

        :host(.menu-bar) {
            display:flex;
            border:1px red solid;
            flex-direction:row;
        }

        :host(.tabs) {
            display:flex;
            flex-direction:row;
        }

        __:host(.horizontal) ::slotted(x-menuitem) {}   
    `,
    styleGlobal: `
        x-menu.menu-bar > x-menuitem::part(label-with-icon) {width:unset; }
        x-menu.menu-bar > x-menuitem::part(label) {padding-left:1em; width:unset;}
        x-menu.menu-bar > x-menuitem::part(div) {left:0; top:100%;}
        x-menu.menu-bar > x-menuitem::part(has-childs) {display:none;}
    `,
    state: {
    },
    template: `
        <slot></slot>
    `
});

