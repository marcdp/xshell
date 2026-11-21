// component
export default {
    contract: {
        description: "Formats a date/time value, showing the time when it is today and the date otherwise.",
        tags: ["time", "dates", "formatting"],
        events: {},
        properties: {
            datetime: {type:"string", default:"", attribute:true, state:true, description:""},
            value:    {type:"string", default:"", attribute:true, state:true, description:""},
            format:   {type:"string", default:"", attribute:true, state:true, description:"Optional format override."}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Show a timestamp using the configured locale and date format.",
                template: `<x-datetime value="2025-04-10T14:30:00Z" format="date"></x-datetime>`
            }
        ]
    },
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
