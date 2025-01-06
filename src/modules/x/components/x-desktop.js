import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-desktop", {
    style: `
        @media (max-width: 768px) {
            :host {display:none;}
        }        
    `,
    template: `<slot></slot>`
});

