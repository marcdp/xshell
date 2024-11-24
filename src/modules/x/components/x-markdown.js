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
    settings: {
        observedAttributes: ["value"],
    },
    methods:{
        onStateChanged(name, oldValue, newValue){
            if (name == "value") {
                this.html = marked.parse(newValue);
            }
        },
        onCommand(name, args){
            if(name === "load"){
                //load
                
            }
        }
    }
});

