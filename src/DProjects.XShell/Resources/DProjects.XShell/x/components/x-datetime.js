// contract
export const contract = {
    description: "Formats a date/time value, showing the time when it is today and the date otherwise.",
    events: {},
    properties: {
        datetime: {type:"string", default:"", attribute:true, state:true, description:""},
        value:    {type:"string", default:"", attribute:true, state:true, description:""},
        format:   {type:"string", default:"", attribute:true, state:true, description:"Optional format override."}
    },
    methods: {}
};


// implementation
export default {
    template: `
        <span x-attr:title="state.formattedValueFull">
            {{ state.formattedValue }}
        </span>
    `,
    state: {
        formattedValue: "",
        formattedValueFull: ""
    },
    controller({ state, events, i18n }) {
        return {
            load() {
                events.on(
                    state,
                    ["change:value", "change:datetime", "change:format"],
                    "refresh"
                );
                this.refresh();
            },

            refresh() {
                const value = state.value || state.datetime;
                if (!value) {
                    state.formattedValue = "";
                    state.formattedValueFull = "";
                    return;
                }
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) {
                    state.formattedValue = "";
                    state.formattedValueFull = "";
                    return;
                }
                const now = new Date();
                const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
                const format = state.format || (isToday ? "time" : "date");
                // format to use for the main display value 
                state.formattedValue = i18n.formatDateTime(date, format);
                state.formattedValueFull = i18n.formatDateTime(date, "datetime");
            }
        };
    }
};