import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-layout-app-main", {
    style: `
        :host {display:block;}
        nav {
            height:3em;
            color:var(--font-color-inverse); 
            background:var(--color-main); 
            display:flex;
            align-items:center;
            position:fixed;
            top:0; left:0; right:0;
        }
        nav x-icon {width:2.5em; text-align:center;}
        div {margin-top:3em;}
    `,
    template: `
        <nav>
            <x-icon icon="x-settings"></x-icon>
            <label>This is header</label>
            &nbsp;
            <slot name="toolbar"></slot>
        </nav>
        <div>
            <slot></slot>
        </div>
    `
});
