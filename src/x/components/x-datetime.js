import XElement from "x-element";

// export
export default XElement.define("x-datetime", {
    template: `
        {{ i18n.formatDateTime(state.value || state.datetime, state.format) }}
    `,
    state: {
        datetime: "",
        value: "",
        format: ""
    }
});
