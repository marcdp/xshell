import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-app-main", {
    style: `
        :host {display:block;}
    `,
    template: `
        <x-app-bar></x-app-bar>
        <slot></slot>
    `
});
