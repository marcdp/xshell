import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-mobile", {
    style: `
        @media (min-width: 769px) {
            :host {display:none;}
        }        
    `,
    template: `<slot></slot>`
});

