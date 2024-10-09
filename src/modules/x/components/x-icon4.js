import XElement from "../../../x-element.js";
import loader from "../../../loader.js";

// definition
let definition = {
    style: `
        :host {display:inline-block;}
        :host svg {height:1em; fill:currentcolor; vertical-align:middle;}
    `,
    template: `
        <span x-html="state.svg"></span> 
    `,
    state() {
        return {
            counterValue: 0,
            icon:"",
            svg: "",
            checked: false
        };
    },
};

// class
class XIcon4 extends XElement {

    //static
    static definition = definition;
    static get observedAttributes() { return ["icon"]; }


    //events
    onStateChanged(name, oldValue, newValue) {
        if (name == "icon" ) {
            loader.load("icon:" + newValue).then((svg)=>{
                this.state.svg = svg;
            });
        }
    }
 
}

//define
customElements.define('x-icon4', XIcon4);

// export
export default XIcon4;
