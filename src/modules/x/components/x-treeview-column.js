import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-treeview-column", {
    style: `
        :host {
            display:block; 
            width:var(--x-treeview-column-width);
            box-sizing:border-box;
        }
    `,
    template: `
        {{state.label}}
    `,
    state: {
        label: ""        
    },
    methods: {
        async onCommand(command) {
            if (command == "load") {
                //load               

            }
        }
    }
});

