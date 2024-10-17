import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-avatar", {
    style: `
        :host {display:flex; flex-direction:row; user-select:none;}
        :host(.cursor) {cursor:pointer;}
        :host div.circle {
            display:flex; 
            box-sizing:border-box;
            aspect-ratio:1/1;
            height:2.25em; 
            border-radius:50%;
            background:var(--x-avatar-background);
            align-items:center;
            justify-content:center;            
        }
        div.circle span {color:var(--x-avatar-text-color); font-weight:600;}
        div.circle + div.details {margin-left:.75em; display:flex; flex-direction:column; justify-content:center;}

        div.details span.label {font-weight:600;}
        div.details span.message {font-size:var(--x-font-size-x-small); }
    `,
    template: `
        <div class="circle">
            <x-icon x-if="state.icon" x-attr:icon="state.icon"></x-icon>
            <img    x-elseif="state.image" x-attr:src="state.image"></x-icon>
            <span   x-elseif="state.initials" x-text="state.initials"></span>
        </div>
        <div class="details" x-if="(state.label || state.message ? true : false)">
            <span class="label"   x-text="state.label"></span>
            <span class="message" x-text="state.message"></span>
        </div>
    `,
    settings:{
        observedAttributes:["initials", "icon", "image", "label", "message", "command"]
    },
    state: {
        initials:"", 
        icon:"",
        image:"",
        label:"",
        message:"",
        command:"",
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                this.addEventListener("click", ()=>{
                    if (this.state.command) {
                        this.dispatchEvent(new CustomEvent("command", {detail: {command: this.state.command, data: this.dataset}, bubbles: true, composed: false}));
                    }
                });
            }
        }
    }
});

