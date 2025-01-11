import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-treeview-body", {
    style: `
        :host {
            display:block;
        }        
    `,
    template: `<slot></slot>`,    
});

