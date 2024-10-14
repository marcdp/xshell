import XElement from "../ui/x-element.js";

// export
export default XElement.define("x-clock", {
    template: `
        {{ state.time }}
    `,
    state: {
        time: new Date().toLocaleTimeString(),
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                this.onCommand("refresh");
                this._timerId = setInterval(() => {
                    this.onCommand("refresh");
                }, 1000);

            } else if (command == "refresh") {
                //refresh
                this.state.time = new Date().toLocaleTimeString();

            } else if (command == "unload") {
                //refresh
                clearInterval(this._timerId);
            }
        }
    }
});
