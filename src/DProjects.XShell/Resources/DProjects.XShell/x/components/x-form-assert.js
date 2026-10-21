// contract
export const contract = {
    description: "Asserts a form-level validation condition and reports an error when the condition is false.",
    events: {
        "assert:change": {
            description: "Raised when the field value changes for form validation.",
            detail: {
                oldValue: {type:"boolean"},
                newValue: {type:"boolean"}
            }
        }
    },
    properties: {
        test: {type: "boolean",default: true,attribute: true,state: true,description: "Condition that must evaluate to true for the assertion to pass."},
        label: {type: "string",default: "",attribute: true,state: true,description: "Optional label associated with the validation error."},
        path: {type: "string",default: "",attribute: true,state: true,description: "Optional path associated with the validation error."},
        message: {type: "string",default: "",attribute: true,state: true,description: "Optional validation message. When omitted, the component content is used."}
    },
    methods: {
        validate: {
            description: "Validates the assertion and returns any validation errors.",
            parameters: [],
            returns: {type: "array", description: "The validation errors produced by the assertion."}
        }
    },
    slots: {
        "": {
            description: "Validation message content used when message is not specified."
        }
    }
};


// implementation
export default {
    style: `
        :host {
            display: block;
        }
        :host > div.error {
            font-size: var(--x-font-size-small);
            color: var(--x-datafield-error-color);
            padding-top: 0.25em;
            align-items: flex-end;
            display: var(--x-datafield-error-display, none);
        }
    `,

    template: `
        <div class="error" x-if="state.validated && !state.test">
            <x-icon icon="x-error"></x-icon>
            <span x-text="state.message"></span>
        </div>
    `,

    state: {
        validated: false
    },

    controller({ events, state, host }) {
        const getMessage = () => {
            return state.message || host.textContent.trim();
        };

        return {
            load() {
                events.on(state, "change:test", (event) => {
                    if (event.oldValue !== event.newValue) {
                        host.dispatchEvent(new CustomEvent("assert:change", {
                            detail: {
                                oldValue: event.oldValue,
                                newValue: event.newValue
                            },
                            bubbles: true,
                            composed: false
                        }));
                    }
                });
            },

            validate(detail = false) {
                state.validated = true;

                if (state.test) {
                    return [];
                }

                return [{
                    type: "error",
                    label: state.label,
                    path: state.path,
                    message: getMessage()
                }];
            }
        };
    }
};