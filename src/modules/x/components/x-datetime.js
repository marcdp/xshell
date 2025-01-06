import XElement from "../ui/x-element.js";

// export
export default XElement.define("x-datetime", {
    template: `
        {{ i18n.formatDateTime(state.datetime, state.format) }}
    `,
    state: {
        datetime: "",
        format: ""
    }
});
