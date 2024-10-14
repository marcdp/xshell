import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-page-dialog", {
    style: `
        :host {
            display:block; 
            max-width:75vw; 
        }
        x-page-body {
            max-height:calc(100vh - 15em); 
            overflow-y:auto;
        }
    `,
    template: `
        <x-page-header>
            <slot name="header"></slot>    
        </x-page-header>
        <x-page-body>
            <slot></slot>
        </x-page-body>    
        <x-page-footer>
            <slot name="footer"></slot>
        </x-page-footer>
    `
});
