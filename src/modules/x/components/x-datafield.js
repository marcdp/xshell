import XElement from "../ui/x-element.js";
import { utils } from "../ui/x-template.js";
import i18n from "../../../i18n.js";

// utils
const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+)\.([a-zA-Z]{2,})(\/[a-zA-Z0-9#-]+\/?)*$/;
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const telPattern = /^(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4,7}$/;

// class
export default XElement.define("x-datafield", {
    style: `
        :host {display:block; position:relative; }

        :host label {display:var(--x-input-label-display, none); padding-bottom:.35em; width:100%;}
        :host label span.label {font-weight:600; }
        :host label span.required {color:var(--x-input-error-color); }

        :host label span.langs {float:right; border:var(--x-input-border); border-radius:var(--x-input-border-radius) var(--x-input-border-radius) 0 0 ; display:inline-flex; border-bottom:none;}
        :host label span.langs x-button {}
        :host label span.langs x-button + x-button {border-left:var(--x-input-border);}
        :host label span.langs .add {}
        
        :host p {margin:0; font-size:var(--x-font-size-small); padding-top:.25em;}
        ::placeholder {color:var(--x-input-color-placeholder);}        
        :host input,select,textarea {display:block; width:100%; resize: none;}

        .input {
            width:100%; 
            box-sizing:border-box; 
            border:none;
            background:var(--x-input-background);
            border-radius: var(--x-input-border-radius);
            border: var(--x-input-border); 
            border-bottom: var(--x-input-border-bottom); 
            padding:var(--x-input-padding);
            font-family: var(--x-input-font-family);
            font-size: var(--x-input-font-size);
        }
        .input.code {padding:0;}
        
        label.error {color:var(--x-input-error-color);}
        label.error + .input {border-color:var(--x-input-error-color); color:var(--x-input-error-color);}
        label.error + .input::placeholder {color:var(--x-input-error-color); opacity:.5;}
        label.error + .container div label {color:var(--x-input-error-color)}
        
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
        
        span.mark {height:3px;box-sizing:border-box;transform: translateY(-3px);border-radius: 0 0 4px 4px;border-bottom:2px var(--x-color-primary) solid;width:100%;position:absolute;display:none;clip-path: inset(calc(100% - 2px) 0px 0px); z-index:10;}

        :host .i18n {padding:0; display:flex;}
        :host .i18n div {display:flex;flex:1; align-items:center; position:relative;}
        :host .i18n div input {flex:1; border:none; padding-right:1.5em;}
        :host .i18n div + div input {border-left:var(--x-input-border); border-radius:0 1em 1em 0;}
        :host .i18n textarea {border-left:var(--x-input-border); border-radius:0 1em 1em 0; padding-right:1.5em;}
        :host .i18n textarea + span.lang {top:0.65em;}
        :host .i18n div span.lang {position:absolute; margin-top:.5em; right:.5em; text-transform:uppercase; font-size:var(--x-font-size-x-small); color:var(--x-input-color-placeholder);}
        :host(.vertical) .i18n {flex-direction:column;}
        :host(.vertical) .i18n .input {border: none; border-top:var(--x-input-border); border-radius:0; background:none;}
        :host(.vertical) .i18n div:first-child .input {border-top:none;}
        
        :host .container {padding:.25em; padding-top:.4em; padding-bottom:.1em;}
        :host .container div {display:flex; align-items:start; }
        :host .container div input {margin-right:.5em; width:1em;}
        :host .container div label {display:block; flex:1; color:var(--x-input-color); font-weight:normal; font-size:var(--x-input-font-size);}

        :host .object > input {width:unset;}

        :host .picker {display:flex; padding:0;}
        :host .picker span {flex:1; display:block;padding-left:.5em; padding-right:.5em; line-height:2.15em; color:var(--x-input-color);}
        :host .picker input {border:none; outline:none; }
        :host .picker input:focus {border:none; outline:none;}
        :host .picker x-button {font-size:.9em; }
        
        :host .list {padding:0}
        :host .list .list-body {display:flex; flex-direction:column; padding:var(--x-input-padding);}
        :host .list .list-body ::slotted(x-datafields) {}
        :host .list .list-body[empty] {padding:.05em; }
        :host .list .list-buttons {display:flex; justify-content:flex-end;}

        :host .richtext {padding:0;}

        :host label:not(.error) + .input:focus + span.mark {display:block;}
        :host label:not(.error) + .input:focus-within + span.mark {display:block;}

        :host > div.error {font-size:var(--x-font-size-small); color:var(--x-input-error-color); display:flex; padding-top:.25em; align-items: flex-end; display:var(--x-input-error-display, none)}
        :host > div.error x-icon {vertical-align:text-bottom}
        `,
    template: `
        <label x-attr:for="state.inputId" x-attr:class="(state.errors.length ? 'error' : '')" >
            <span class="label" x-if="state.label" x-text="state.label"></span>
            <span class="required" x-if="state.required">*</span>
            <span class="langs" x-if="state.type.endsWith('_i18n')" >
                <x-button 
                        slot="toolbar" 
                        x-for="(lang,index) in state.langs"
                        x-attr:label="lang"
                        x-on:click="lang-changed"
                        x-attr:title="utils.getLang(lang).label"
                        x-attr:data-lang="lang"
                        x-attr:class="'plain x-short ' + (state.langIndex == index ? ' selected' : '') + (state.value.indexOf('i18n:' + lang + '=')==-1 ? ' empty' : '') ">
                </x-button><x-button class="add plain x-short" x-on:click="lang-add" icon="x-add" title="Add translation"></x-button>
            </span>
        </label>

        <div x-if="state.type==''" class="input slot">
            <slot>&nbsp;</slot>
        </div>

        <select x-elseif="state.type=='select'" 
            class="input" 
            x-model="state.value" 
            x-attr:id="state.inputId"
            x-attr:multiple="state.multiple">
            <option x-if="!state.multiple" x-text="state.placeholder" class="placeholder"></option>
            <option x-for="option in state.domain" x-attr:value="option.value" x-text="option.label" x-attr:disabled="option.disabled" x-attr:selected="(option.value == state.value || (state.multiple && (',' + state.value + ',').indexOf(',' + option.value + ',')!=-1))"></option>
        </select>

        <div x-elseif="state.type=='radios'" class="input container">
            <div x-for="(option,index) in state.domain">
                <input type="radio" x-attr:value="option.value" name="radio" x-attr:id="'radio' + index" x-model="state.value" x-attr:disabled="option.disabled"/>
                <label x-text="option.label" x-attr:for="'radio' + index"></label>
            </div>
        </div>

        <div x-elseif="state.type=='checkbox'" class="input container">
            <div>
                <input type="checkbox" x-attr:value="state.value" name="checkbox" id="checkbox" x-model="state.value"/>
                <label x-text="state.labelSecondary" for="checkbox"></label>
            </div>
        </div>

        <div x-elseif="state.type=='checkboxes'" class="input container">
            <div x-for="(option,index) in state.domain">
                <input type="checkbox" x-attr:value="option.value" x-attr:id="'radio' + index" name="checkbox" x-attr:checked="(state.value ? state.value.split(',').indexOf(option.value)!=-1 : null)" x-on:change="checkbox-changed" x-attr:disabled="option.disabled"/>
                <label x-text="option.label" x-attr:for="'radio' + index"></label>
            </div>
        </div>

        <textarea x-elseif="state.type=='textarea'" 
            class="input" 
            x-model="state.value"
            x-attr:id="state.inputId"
            x-attr:lang="state.lang" 
            x-attr:spellcheck="state.spellcheck"
            x-attr:placeholder="state.placeholder" 
            x-attr:minlength="state.minlength"
            x-attr:maxlength="state.maxlength"
            x-attr:disabled="state.disabled" 
            x-attr:readonly="state.readonly" 
        ></textarea>

        <div x-elseif="state.type=='picker'" class="input picker">
            <span x-text="state.value"></span>
            <x-button 
                class="plain no-hover" 
                icon="x-edit" 
                x-attr:id="state.inputId"
                x-on:click="pick"></x-button>
        </div>

        <div x-elseif="state.type=='text_i18n'" class="input i18n">
            <div x-for="(lang,index) in state.langs">
                <input 
                    type="text" 
                    class="input"
                    x-prop:value="utils.i18n(state.value, lang)"
                    x-on:change="text_i18n-changed"
                    x-attr:id="state.inputId + (index == 0 ? '' : index)"
                    x-attr:lang="lang" 
                    x-attr:placeholder="(index == 0 ? state.placeholder : '')" 
                    x-attr:minlength="state.minlength"
                    x-attr:maxlength="state.maxlength"
                    x-attr:pattern="state.pattern"
                    x-attr:disabled="state.disabled" 
                    x-attr:readonly="state.readonly" 
                    x-attr:spellcheck="state.spellcheck"
                />
                <span class="lang" x-html="lang" x-attr:title="utils.getLang(lang).label"></span>
            </div>
            <span class="mark"></span>            
        </div>

        <div x-elseif="state.type=='textarea_i18n'" class="input i18n">
            <div x-for="(lang,index) in state.langs">
                <textarea 
                    class="input" 
                    x-prop:value="utils.i18n(state.value, lang)"
                    x-on:change="text_i18n-changed"
                    x-attr:id="state.inputId + (index == 0 ? '' : index)"
                    x-attr:lang="lang" 
                    x-attr:placeholder="(index == 0 ? state.placeholder : '')" 
                    x-attr:minlength="state.minlength"
                    x-attr:maxlength="state.maxlength"
                    x-attr:disabled="state.disabled" 
                    x-attr:readonly="state.readonly" 
                    x-attr:spellcheck="state.spellcheck"
                ></textarea>
                <span class="lang" x-html="lang" x-attr:title="utils.getLang(lang).label"></span>
            </div>
            <span class="mark"></span>
        </div>
        
        <div x-elseif="state.type=='file'" class="input file">
            <input 
                type="file"
                x-on:change="file-changed"
                x-attr:id="state.inputId"
                x-attr:disabled="state.disabled"
                x-attr:readonly="state.readonly"
                x-attr:multiple="state.multiple"
                x-attr:required="state.required"
                x-attr:accept="state.accept"
            />
        </div>

        <div x-elseif="state.type=='richtext'" class="input richtext">
            <x-richtext
                x-model="state.value" 
                x-attr:id="state.inputId"
                x-attr:lang="state.langs[state.langIndex]" 
                x-attr:disabled="state.disabled" 
                x-attr:readonly="state.readonly"
                x-attr:spellcheck="state.spellcheck"
            ></x-richtext>
        </div>

        <div x-elseif="state.type=='richtext_i18n'" class="input richtext">
            <x-richtext
                x-prop:value="utils.i18n(state.value, state.langs[state.langIndex])"
                x-on:change="text_i18n-changed"
                x-attr:id="state.inputId"
                x-attr:lang="state.langs[state.langIndex]" 
                x-attr:disabled="state.disabled" 
                x-attr:readonly="state.readonly"
                x-attr:spellcheck="state.spellcheck"
            ></x-richtext>            
            <span class="mark"></span>
        </div>

        <div x-elseif="state.type=='javascript'" class="input code">
            <x-code-editor x-model="state.value" mode="javascript"></x-code-editor>
        </div>
        <div x-elseif="state.type=='css'" class="input code">
            <x-code-editor x-model="state.value" mode="css"></x-code-editor>
        </div>
        <div x-elseif="state.type=='html'" class="input code">
            <x-code-editor x-model="state.value" mode="html"></x-code-editor>
        </div>
        <div x-elseif="state.type=='markdown'" class="input code">
            <x-code-editor x-model="state.value" mode="markdown"></x-code-editor>
        </div>
        <div x-elseif="state.type=='markdown_i18n'" class="input code">
            <x-code-editor 
                mode="markdown"
                x-prop:value="utils.i18n(state.value, state.langs[state.langIndex])"
                x-on:change="text_i18n-changed"
                x-attr:id="state.inputId"
                x-attr:lang="state.langs[state.langIndex]" 
                x-attr:disabled="state.disabled" 
                x-attr:readonly="state.readonly"
                x-attr:spellcheck="state.spellcheck"
            ></x-code-editor>
        </div>

        <div x-elseif="state.type=='object'" class="input object">
            <input 
                type="checkbox" 
                x-on:change="object-changed"
                x-attr:id="state.inputId"
                x-attr:checked="state.value != null"
                x-attr:disabled="state.disabled"
                x-attr:readonly="state.readonly" />
            <div x-if="state.value != null">
                <slot></slot>
            </div>
        </div>

        <div x-elseif="state.type=='list'" class="input list">
            <div class="list-body" x-on:edit="list-edit" x-on:remove="list-remove" x-on:move="list-move" x-attr:empty="!state.hasChilds">
                <slot x-on:slotchange="slotchange"></slot>
            </div>
            <div class="list-buttons">
                <x-button x-if="state.add" x-on:click="list-add" icon="x-add" class="plain short no-hover"></x-button>
            </div>
        </div>
        
        <input 
            x-else
            class="input"
            x-model="state.value"
            x-attr:id="state.inputId"
            x-attr:type="state.type" 
            x-attr:lang="state.lang" 
            x-attr:spellcheck="state.spellcheck" 
            x-attr:placeholder="state.placeholder" 
            x-attr:disabled="state.disabled"
            x-attr:readonly="state.readonly"
            x-attr:min="state.min"
            x-attr:max="state.max"
            x-attr:minlength="state.minlength"
            x-attr:maxlength="state.maxlength"
            x-attr:multiple="state.multiple"
            x-attr:pattern="state.pattern"
            x-attr:required="state.required"
            x-attr:step="state.step"
            x-attr:accept="state.accept"
            x-attr:autocomplete="state.autocomplete"
        />

        <span class="mark"></span>

        <p x-if="state.message" x-text="state.message"></p>

        <div x-if="state.errors.length" class="error">
            <span x-for="error in state.errors">
                <x-icon icon="x-error2-fill"></x-icon>
                <span x-text="error.message"></span>
            </span>
        </div>
    `,
    state: {
        label:"",
        labelSecondary:"",
        message: "",
        type: "",
        placeholder: "",
        disabled: false,
        readonly: false,
        min: null,
        max: null,
        minlength: null,
        maxlength: null,
        multiple: false,
        pattern: null,
        required: false,
        step: null,
        autofocus: false,
        autocomplete: null,
        domain: null,
        value: null,
        valueOriginal: null,
        accept: null,
        lang: null,
        spellcheck: "true",
        langs: [],
        langIndex: 0,
        errors: [],
        validated: false,
        inputId: "input",
        add: false
    },
    settings:{
        observedAttributes:["label", "label-secondary", "message", "type", "placeholder", "disabled", "readonly", "required", "min", "max", "minlength", "maxlength", "multiple", "pattern", "step", "autofocus", "autocomplete", "domain", "value", "accept", "add", "lang", "spellcheck"]
    },
    methods: {
        onStateChanged(name, oldValue, newValue) {
            if (name == "domain") {
                //transform domain if required
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
            } else if (name == "type" || name == "required" || name == "min" || name == "max" || name == "minlength" || name == "maxlength" || name == "pattern") {
                //value changed
                this.onCommand("validate");

            } else if (name == "value") {
                //value changed
                if (this._connected) {
                    this.onCommand("validate");
                    this.dispatchEvent(new CustomEvent("change", {detail: {oldValue, newValue}, bubbles: true, composed: false}));
                    this.dispatchEvent(new CustomEvent("datafield:change", {detail: {oldValue, newValue}, bubbles: true, composed: false}));
                } else {
                    this.state.validated =false;
                }
            }
        },
        postRender() {
            if (this.state.autofocus && this._renderCount == 1) {
                let element = this.shadowRoot.querySelector(".input");
                if (element && element.focus) {
                    setTimeout(() => {
                        element.focus();
                    }, 25);                    
                }
            }
        },
        async onCommand(command, args) {
            if (command == "load") {
                // load
                this.state.inputId = utils.getFreeId();
                if (!this.state.validated) {
                    this.onCommand("validate");
                }                
                this.state.hasChilds = (this.firstElementChild != null);

            } else if (command == "slotchange") {
                //slotchange
                this.state.hasChilds = (this.firstElementChild != null);

            } else if (command == "lang-add") {
                //lang-add
                let lang = await this.page.showDialog({ url: "page:x-page-lang-picker?disabled=" + this.state.langs.join(",")});
                if (lang) {
                    this.state.langs.push(lang);
                    this.state.langIndex = this.state.langs.length - 1;
                }

            } else if (command == "lang-changed") {
                //lang-changed
                let lang = args.event.target.dataset.lang;
                this.state.langIndex = this.state.langs.indexOf(lang);

            } else if (command == "object-changed"){
                //object-changed
                if (this.state.value) {
                    this.state.valueOriginal = this.state.value;
                    this.state.value = null;
                } else {
                    this.state.value = this.state.valueOriginal;
                }
                
            } else if (command == "file-changed"){
                // file-changed
                var files = args.event.target.files;
                // ... todo

            } else if (command == "list-add") {
                // list-add
                this.state.value = this.state.value.concat({});

            } else if (command == "list-edit"){
                // list-edit

            } else if (command == "list-move"){
                // list-move
                let event = args.event;
                let index = Array.from(event.target.parentNode.children).indexOf(event.target);
                let newIndex = (event.detail.direction == "up" ? index - 1 : index + 1);
                let value = [...this.state.value];
                let aux = value.splice(index, 1)[0]; // Remove the item from the array
                value.splice(newIndex, 0, aux); // Insert it at the new index
                this.state.value = value;
                event.stopPropagation();

            } else if (command == "list-remove"){
                // list-remove
                let event = args.event;
                let index = Array.from(event.target.parentNode.children).indexOf(event.target);
                this.state.value = this.state.value.filter((item, i) => i != index);
                event.stopPropagation();

            } else if (command == "checkbox-changed"){
                // checkbox-changed
                let value = [];
                this.shadowRoot.querySelectorAll("input:checked").forEach((element)=>{
                    value.push(element.value);
                });
                this.state.value = value.join(",");
                
            } else if (command == "text_i18n-changed") {
                // text_i18n-changed
                let value = args.event.target.value;
                let lang = args.event.target.lang;
                let parts = [];
                for(let targetLang of this.state.langs) {
                    if (targetLang == lang) { 
                        if (value.length) parts.push("i18n:" + lang + "=" + value.replaceAll("|", "&#124;"));
                    } else {
                        let partValue = "";
                        for(let aux of this.state.value.split("|")) {
                            if (aux.startsWith("i18n:" + targetLang + "=")) {
                                partValue = aux.substring(aux.indexOf("=")+1);
                                break;
                            }
                        }
                        if (partValue.length) parts.push("i18n:" + targetLang + "=" + partValue.replaceAll("|", "&#124;"));
                    }
                }
                this.state.value = parts.join("|");

            } else if (command == "pick") {
                // pick
                alert("pick");

            } else if (command == "validate") {
                // validate
                this.state.errors = this.validate();
                this.state.validated = true;
            }
        },
        validate(detail) {
            let result = [];
            //langs                    
            if (this.state.type.endsWith("_i18n")) { 
                let langs = i18n.getMainLangs();
                if (this.state.value) {
                    for(let aux of this.state.value.split("|")) {
                        if (aux.startsWith("i18n:") && aux.length > 7) {
                            let lang = aux.substring(5, 7);
                            if (!langs.includes(lang)) langs.push(lang);
                        }
                    }
                }
                this.state.langs = langs;
            }
            //errors
            if (this.state.required && !this.state.value) {
                result.push({type:"error", label: this.label, message:"Required"});
            } else if (this.state.type == "text" || this.state.type == "textarea") {
                if (this.state.value) {
                    if (this.state.minlength && this.state.value.length < this.state.minlength) {
                        result.push({type:"error", label: this.label, message:"Too short"});
                    } else if (this.state.maxlength && this.state.value.length > this.state.maxlength) {
                        result.push({type:"error", label: this.label, message:"Too long"});
                    }
                    if (this.state.pattern) {
                        let re = new RegExp(this.state.pattern);
                        if (!re.test(this.state.value)) {
                            result.push({type:"error", label: this.label, message:"Invalid format"});
                        }
                    }
                    }
            } else if (this.state.type == "number") {
                if (this.state.value && isNaN(this.state.value)) {
                    result.push({type:"error", label: this.label, message:"Invalid number"});
                } else if (this.state.min && this.state.value < parseInt(this.state.min)) {
                    result.push({type:"error", label: this.label, message:"Value too low"});
                } else if (this.state.max && this.state.value > parseInt(this.state.max)) {
                    result.push({type:"error", label: this.label, message:"Value too high"});
                }
            } else if (this.state.type == "url") {
                if (this.state.value) {
                    if (!urlPattern.test(this.state.value)) {
                        result.push({type:"error", label: this.label, message:"Invalid url"});
                    }
                }
            } else if (this.state.type == "email") {
                if (this.state.value) {
                    if (!emailPattern.test(this.state.value)) {
                        result.push({type:"error", label: this.label, message:"Invalid email"});
                    }
                }
            } else if (this.state.type == "tel") {
                if (this.state.value) {
                    if (!telPattern.test(this.state.value)) {
                        result.push({type:"error", label: this.label, message:"Invalid phone number"});
                    }
                }
            } else if (this.state.type.endsWith("_i18n")) {
                if (this.state.value) {
                    let hasMainValue = false;
                    for(let lang of this.state.langs) {
                        let value = utils.i18n(this.state.value, lang);
                        if (value && lang == this.state.langs[0]) hasMainValue = true;

                    }
                    if (this.state.required && !hasMainValue) {  
                        result.push({type:"error", label: this.label, message:"Required"});
                    }
                }
            } else if (this.state.type == "list") {
                if (this.state.required && (!this.state.value || this.state.value.length == 0)) {
                    result.push({type:"error", label: this.label, message:"Required"});
                } else if (this.state.value && this.state.minlength && this.state.value.length < this.state.minlength) {
                    result.push({type:"error", label: this.label, message:"Too few items"});
                } else if (this.state.value && this.state.maxlength && this.state.value.length > this.state.maxlength) {
                    result.push({type:"error", label: this.label, message:"Too many items"});
                }
            }
            //path
            if (detail) {
                let path = [];
                let element = this;
                while (element.parentNode) {
                    element = element.parentNode;
                    if (element.localName == "x-datafield" || element.localName == "x-datafields" || element.localName == "x-tab") {
                        if (element.label) path.push(element.label);
                    }
                    if (element.localName == "x-form") break;
                }
                path = path.reverse().join(" / ");
                for(let error of result) {
                    error.path = path;
                }
            }
            //return
            return result;
        }
    }
});

