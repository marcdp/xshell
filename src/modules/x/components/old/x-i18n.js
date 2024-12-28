import i18n from "./../../../i18n.js";
import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-i18n", {
    template: `
        {{ state.value }}
    `,
    settings: {
        observedAttributes: ["label"]
    },
    state: {
        label: "",
        value: "",
    },
    methods: {
        onStateChanged(name, oldValue, newValue) {
            if (name == "label") {
                this.state.value = i18n(newValue);
            }
        },
    }
});
