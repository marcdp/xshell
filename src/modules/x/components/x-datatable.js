import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-datatable", {
    style: `
        :host { display:block; }
    `,
    styleGlobal: `	
        x-datatable > table {width:100%;}
        x-datatable > table > thead > tr > th {text-align:left; font-weight:600;}
        x-datatable > table > tbody > tr:nth-child(odd) {background:var(--x-background-alt);}
        x-datatable > table > tbody > tr:nth-child(even) {}
        x-datatable > table > tbody > tr > td {}
    `,
    template: `
        <slot></slot>
    `,
    state: {
    },
    settings:{
        observedAttributes:[]
    },
    methods:{
        onCommand(command, args){
            if (command == "load") {
                //load
            }
        }
    }
});

