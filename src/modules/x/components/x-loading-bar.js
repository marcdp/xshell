import XElement from "../ui/x-element.js";

// definition
export default await XElement.define("x-loading-bar", {
    style: `
        :host {
            display:block;
            position:relative;
            width:100%;
        }
        :host div {
            content:"";
            border-top:var(--x-loading-bar-height) var(--x-loading-bar-color) solid;
            border-radius:.1em;
            animation: progressBar var(--x-loading-bar-duration) ease-in-out; 
            animation-delay: var(--x-loading-bar-delay);   
            animation-fill-mode: both; 
            animation-iteration-count: infinite;
            position:absolute;
        }

        @keyframes progressBar {
            0% { left:0; width: 0; }
            50% { left:0; width: 100%;}
            100% {left:100%; width: 0;}
        }  

    `,
    template: `
        <div></div>
    `
});
