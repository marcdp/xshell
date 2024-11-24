import XElement from "../ui/x-element.js";



// class
export default XElement.define("x-code-editor", {
    style: `
        :host {display:flex; height:10em; flex-direction:column; align-items:center; justify-content:center;}
        :host x-lazy {width:100%; height:100%;}
        :host ace-editor {border-radius:var(--x-input-border-radius); flex:1; height:100%;}
        :host x-spinner + x-lazy {visibility:hidden; height:0}
    `,
    state: {
        value: "",
        mode: "",
        theme: "chrome",
        wrap: false,
        readonly: false,
        ready: false
    },
    template: `
        <x-spinner x-if="!state.ready"></x-spinner>
        <x-lazy class="no-spinner">
            <ace-editor 
                class="editor"
                value-update-mode="start"

                x-on:blur="change"
                x-on:ready="ready"
                x-prop:value="state.value" 
                
                x-prop:wrap="state.wrap" 
                x-prop:readonly="state.readonly" 
                x-attr:mode="'ace/mode/' + state.mode"
                x-attr:theme="'ace/theme/' + state.theme"
            ></ace-editor>
        </x-lazy>
    `,
    settings:{
        observedAttributes: ["value", "mode", "theme"]
    },
    methods:{
        preRender() {
            if (this._renderCount > 0) {
                let spinner = this.shadowRoot.querySelector("x-spinner");
                let editor = this.shadowRoot.querySelector("ace-editor");
                if (this.state.ready && spinner) this.shadowRoot.removeChild(spinner);
                if (this.state.wrap) editor.wrap = true;
                if (this.state.mode) editor.mode = "ace/mode/" + this.state.mode;
                if (this.state.theme) editor.theme = "ace/theme/" + this.state.theme;
                editor.value = this.value;
                return true;
            }
        },
        onCommand(command, args){
            if (command == "load") {
                //load

            } else if(command == "ready") {
                //ready
                this.state.ready = true;

            } else if(command == "change") {
                //change
                let target = this.shadowRoot.querySelector(".editor");
                let oldValue = this.state.value;
                let newValue = target.value ?? "";
                this.state.value = newValue;
                this.dispatchEvent(new CustomEvent("change", {detail: {oldValue, newValue}, bubbles: true, composed: false}));
            }
        }
    }    
});
