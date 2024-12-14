import shell from "shell";
import XElement from "../ui/x-element.js";

// definition
export default XElement.define("x-page-title", {
    style: `
        :host {display:flex;}
        span {flex:1}

    `,
    template: `
        <span>{{ state.label }}</span>
        <x-button class="plain" icon="x-close" x-on:click="query-close"></x-button>
    `,
    state: {
        label: ""
    },
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load
                this.page.addEventListener("page:load", () => {
                    this.onCommand("refresh");
                });
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                let page = this.page;
                if (page) {
                    this.label = page.label;
                }
            } else if (command == "query-close") {
                //query-close
                this.dispatchEvent(new CustomEvent("page:query-close", { composed: true }));

            }
        }
    }
});
