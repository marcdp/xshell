import XElement from "../ui/x-element.js";

// export
export default XElement.define("x-i18n", {
    template: `
        {{ i18n.translate(state.text) }}
    `,
    state: {
        text: ""
    }
});
