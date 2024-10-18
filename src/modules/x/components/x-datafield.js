import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-datafield", {
    style: `
        :host {display:block; position:relative;}
        :host label {font-weight:600; display:block; padding-bottom:.35em;}
        :host label span.required {color:red;}
        :host p {margin:0; font-size:var(--x-font-size-small); padding-top:.25em;}
        ::placeholder {color:var(--x-input-color-placeholder);}        
        :host input,select,textarea {display:block;}

        .input {
            width:100%; 
            box-sizing:border-box; 
            border:none;
            background:var(--x-input-background);
            border-radius: var(--x-input-border-radius);
            border: var(--x-input-border); 
            border-bottom: var(--x-input-border-bottom); 
            padding:.4em;
            font-family: var(--x-input-font-family);
            font-size: var(--x-input-font-size);
        }
        .input:focus {
            outline:none;
            border:var(--x-input-border-focus);
            border-bottom: var(--x-input-border-bottom); 
        }
        :host > input[type='file'] {
            padding:.35em;
        }
        input[type='range'] {
            padding:.35em;
        }
        input[type='color'] {
            min-height:2.3em;
        }
        input, textarea, select {
            color:var(--x-input-color);
        }
        select .placeholder {color:var(--x-input-color-placeholder);}
        :host > input[type='checkbox'], :host > input[type='radio'] {
            width:unset;
            height:1.8em;            
        }
        
        span.mark {
            height:3px;
            box-sizing:border-box;
            transform: translateY(-3px);
            border-radius: 0 0 4px 4px;
            border-bottom:2px var(--x-color-primary) solid;
            width:100%;
            position:absolute;
            display:none;
            clip-path: inset(calc(100% - 2px) 0px 0px);
        }

        :host .container {padding:.25em; padding-top:.4em; padding-bottom:.1em;}
        :host .container div {display:flex; align-items:start; }
        :host .container div input {margin-right:.5em; width:1em;}
        :host .container div label {display:block; flex:1; color:var(--x-input-color); font-weight:normal; font-size:var(--x-input-font-size);}

        :host .picker {display:flex; padding:0;}
        :host .picker span {flex:1; display:block;padding-left:.5em; padding-right:.5em; line-height:2em; color:var(--x-input-color);}
        :host .picker input {border:none; outline:none;}
        :host .picker input:focus {border:none; outline:none;}
        :host .picker x-button::part(button) {padding:.3em}
        
        :host .input:focus + span.mark, :host .input:focus-within + span.mark {display:block;}
        `,
    template: `
        <label for="input">
            <span x-if="state.label" x-text="state.label"></span>
            <span x-if="state.required" class="required">*</span>
        </label>

        <select x-if="state.type=='select'" class="input" x-model="state.value">
            <option x-if="!state.required" x-text="state.placeholder" class="placeholder"></option>
            <option x-for="option in state.domain" x-attr:value="option.value" x-text="option.label" x-attr:selected="(option.value == state.value)"></option>
        </select>

        <div x-elseif="state.type=='radios'" class="input container">
            <div x-for="(option,index) in state.domain">
                <input type="radio" x-attr:value="option.value" name="radio" x-attr:id="'radio' + index" x-model="state.value"/>
                <label x-text="option.label" x-attr:for="'radio' + index"></label>
            </div>
        </div>

        <div x-elseif="state.type=='radio'" class="input container">
            <div>
                <input type="radio" x-attr:value="state.value" name="checkbox" id="radio" x-model="state.value"/>
                <label x-text="state.labelSecondary" for="radio"></label>
            </div>
        </div>

        <div x-elseif="state.type=='checkbox'" class="input container">
            <div>
                <input type="checkbox" x-attr:value="state.value" name="checkbox" id="checkbox" x-model="state.value" />
                <label x-text="state.labelSecondary" for="checkbox"></label>
            </div>
        </div>

        <div x-elseif="state.type=='checkboxes'" class="input container">
            <div x-for="(option,index) in state.domain">
                <input type="checkbox" x-attr:value="option.value" x-attr:id="'radio' + index" name="checkbox" />
                <label x-text="option.label" x-attr:for="'radio' + index"></label>
            </div>
        </div>

        <textarea x-elseif="state.type=='textarea'" class="input" x-model="state.value"></textarea>

        <div x-elseif="state.type=='picker'" class="input picker">
            <span x-text="state.value"></span>
            <x-button class="plain small" icon="x-edit" x-on:click="pick"></x-button>
        </div>

        <input 
            x-else
            class="input"
            id="input"
            x-model="state.value"
            x-attr:type="state.type" 
            x-attr:placeholder="state.placeholder" 
            x-attr:disabled="state.disabled"
            x-attr:readonly="state.readonly"
            x-attr:min="state.min"
            x-attr:max="state.max"
            x-attr:maxlength="state.maxlength"
            x-attr:multiple="state.multiple"
            x-attr:pattern="state.pattern"
            x-attr:required="state.required"
            x-attr:step="state.step"
            x-attr:autofocus="state.autofocus"
            x-attr:autocomplete="state.autocomplete"
        />

        <span class="mark"></span>
        <p x-if="state.message" x-text="state.message"></p>

        <div x-if="state.value != undefined" x-text="JSON.stringify(state.value)"></div>
    `,
    state: {
        label:"",
        labelSecondary:"",
        message: "",
        type:"",
        placeholder: "",
        disabled: false,
        readonly: false,
        min: null,
        max: null,
        maxlength: null,
        multiple: false,
        pattern: null,
        required: false,
        step: null,
        autofocus: false,
        autocomplete: null,
        domain: null,
        value: null,
    },
    settings:{
        observedAttributes:["label", "label-secondary", "message", "type", "placeholder", "disabled", "readonly", "required", "min", "max", "maxlength", "multiple", "pattern", "step", "autofocus", "autocomplete", "domain", "value"]
    },
    methods: {
        onStateChanged(name, oldValue, newValue) {
            if (name == "domain") {
                if (typeof newValue == "string") {
                    let domain = [];
                    for(let item of newValue.split("|")){
                        let i = item.indexOf("=");
                        if (i!=-1) {
                            let itemValue = item.substring(0, i);
                            let itemLabel = item.substring(i+1);
                            domain.push({value: itemValue, label: itemLabel});
                        }
                    }
                    this.state.domain = domain;
                }
            }
        },
        onCommand(command, args) {
            if (command == "load") {
                //load
                
            } else if (command == "pick") {
                //pick
                alert("pick");

            }
        }
    }
});

