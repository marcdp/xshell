import XElement from "x-element";

// class
export default XElement.define("x-desktop", {
    style: `
        @media (max-width: 768px) {
            :host {display:none;}
        }        
    `,
    template: `<slot></slot>`
});

