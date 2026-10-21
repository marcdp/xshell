// contract
export const contract = {
    description: "Asserts a form-level validation condition and reports an error when the condition is false.",
    events: {
        "assert:change": {
            description: "Raised when the field value changes for form validation.",
            detail: {
                oldValue: {type:"any"},
                newValue: {type:"any"}
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

        .error {
            color: var(--x-datafield-error-color);
            font-size: var(--x-font-size-small);
            margin-top: .5em;
        }
    `,

    template: `
        <x-notice x-if="state.validated && !state.test" type="error">
            <span x-if="state.message" x-text="state.message"></span>
            <span x-else>
                <slot></slot>
            </span>
        </x-notice> 
    `,

    state: {
        validated: false
    },

    controller({ events, state, host }) {
        const getMessage = () => {
            if (state.message) {
                return state.message;
            }

            return host.textContent.trim();
        };

        return {
            load() {
                // load
                events.on(state, "change:test", (event)=>{
                    let oldValue = (event.oldValue === true || event.oldValue == "true" || event.oldValue == "1" || (typeof(event.oldValue) == "number" && event.oldValue != 0) || (typeof(event.oldValue) == "string" && event.oldValue != 0)) ? true : false;
                    let newValue = (event.newValue === true || event.newValue == "true" || event.newValue == "1" || (typeof(event.newValue) == "number" && event.newValue != 0) || (typeof(event.newValue) == "string" && event.newValue != 0)) ? true : false;
                    if (oldValue != newValue) {
                        host.dispatchEvent(new CustomEvent("assert:change", {detail: {oldValue, newValue}, bubbles: true, composed: false}));
                    }
                });
            },
            validate(detail = false) {
                // validate
                state.validated = true;
                if (state.test) {
                    return [];
                }
                return [{label: state.label, path: state.path, message: getMessage() }];
            }
        };
    }
};