import XElement from "../ui/x-element.js";

// definition
export default await XElement.define("x-page-loading", {
    style: `
        :host {}

        :host div {
            content:"";
            border-top:var(--x-page-loading-height) var(--x-page-loading-color) solid;
            position:fixed; 
            top:0; 
            letf:0;
            z-index:20;
            animation: progressBar 3s ease-in-out; 
            animation-delay: 0ms; 
            animation-fill-mode: both; 
        }
        :host([type='']) div {
            position:absolute;
        }
        :host([type='dialog']) div {
            position:absolute;
        }

        @keyframes progressBar {
            0% { width: 0; }
            100% { width: 100%; }
        }  

    `,
    template: `
        <div></div>
    `
});
