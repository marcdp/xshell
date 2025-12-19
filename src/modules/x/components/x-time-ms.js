import XElement from "x-element";

// utils
function formatMilliseconds(ms) {
    if (ms === -1) return '';
    if (ms === 0) return '0 ms';
    return `${ms} ms`;
}

// export
export default XElement.define("x-time-ms", {
    template: `
        {{ state.valueFormatted || ''}}
    `,
    state: {
        value: 0,
        valueFormatted: null
    },
    methods: {
        onCommand(command) {
            if (command == "init"){
                //init
                this.bindEvent(this.state, "change:value", (event)=>{
                    let value = event.newValue;
                    this.state.valueFormatted = formatMilliseconds(value);
                });

            }
        }
    }
});
