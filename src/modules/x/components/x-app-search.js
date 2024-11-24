import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-app-search", {
    style: `
        :host {
            flex:1; 
            display:flex; 
            align-items:center; 
            padding-left:.25em; 
            padding-right:.25em;
            justify-content:end;
        }
        :host div {
            border:var(--x-input-border);
            border-bottom:var(--x-input-border-bottom);
            border-radius:var(--x-input-border-radius);
            color:var(--x-input-color-placeholder);
            background:var(--x-input-background);
            padding:var(--x-input-padding);
            padding-right:1em;
            box-sizing: border-box;
            display:flex;
            align-items:center;
            cursor:pointer;
        }
        :host div x-icon {amargin-top:-.25em;a margin-bottom:0; margin-right:.5em;}
    `,
    template: `
        <div tabindex="0" x-on:click="search">
            <x-icon icon="x-search"></x-icon>
            <span>Search or jump to ...</span>
        </div>
    `,
    methods: {
        onCommand(command, args) {
            if (command=="load"){
                //load

            } else if (command == "search") {
                //search
                this.xshell.showPage({url: "page:x-page-search", target:"#dialog"});
            }

        }

    }
});

