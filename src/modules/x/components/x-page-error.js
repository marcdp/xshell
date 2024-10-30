import XElement from "../ui/x-element.js";

// definition
export default await XElement.define("x-page-error", {
    style: `
        :host {color:red;}
        PRE {margin:0; padding:0;}
    `,
    template: `
        Error {{ state.code }}: {{ state.message }}
        <pre x-show="state.stacktrace">
            {{ state.stacktrace }}
        </pre>
    `,
    state: {
        code: 0,
        message:"",
        stacktrace: ""
    },
    settings: {
        observedAttributes: ["code", "message", "stacktrace"]
    }
});
