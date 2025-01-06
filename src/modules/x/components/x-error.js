import XElement from "../ui/x-element.js";

/*
// definition
export default await XElement.define("x-error", {
    style: `
        :host {display:block; color:red; margin-bottom:.5em;}
        PRE {margin:0; padding:0;}
    `,
    template: `
        <b>Error<span x-if="state.code != 0" x-text="' ' + state.code"></span>:</b>
        <slot></slot>        
        <pre x-show="state.stack"><slot name="stack"><slot></pre>
    `,
    state: {
        code: 0,
        message:""
    },
    //settings: {
    //    observedAttributes: ["code", "message"]
    //}
});
*/