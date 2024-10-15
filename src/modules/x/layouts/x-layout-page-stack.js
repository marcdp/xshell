import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-page-stack", {
    style: `
        :host {display:block;}
    `,
    template: `
        <x-page-header>
            <slot name="header"></slot>    
        </x-page-header>
        <x-page-body>
            <slot></slot>
        </x-page-body>
    `
});
