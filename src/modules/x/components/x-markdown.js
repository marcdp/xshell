import XElement from "../ui/x-element.js";
import {marked} from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js"

// class
export default XElement.define("x-markdown", {
    style: `
        :host {display:block;}
    `,
    template: `
        <div x-html="state.html"></div>
    `,
    state: {
        value:"",
        html:""
    },
    methods:{
        onCommand(name, args){
            if(name === "init"){
                //load
                this.state.addEventListener("change:value", (event) => {
                    this.html = marked.parse(event.newValue);
                });
                
            }
        }
    }
});

