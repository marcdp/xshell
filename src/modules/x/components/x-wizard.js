import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-wizard", {
    style: `
        :host {display:block;}
        
        :host .header {display:flex; margin:0; padding:0; justify-content:center}
        :host .header li {list-style:none; display:block; align-items:center; width:10em; text-align:center; padding:.5em; position:relative;}
        :host .header li > span {display:block; z-index:1; position:relative}
        :host .header li > span.icon {width:1.6em; height:1.6em; text-align:center; border:.1em var(--x-color-primary) solid; color:var(--x-color-primary); margin:0 auto; border-radius:50%; line-height:1.5em;}
        :host .header li > span.icon .number {font-size:var(--x-font-size-small);}
        :host .header li > span.label {margin-top:.25em;}
        :host .header li > span.message {font-size:var(--x-font-size-small); }
        :host .header li:before {
            content:"";
            border:.075em gray solid; 
            top:1.25em;
            width:calc(50% - 1.25em);
            left:0;
            position:absolute;
        }
        :host .header li:after {
            content:"";
            border:.075em gray solid; 
            top:1.25em;
            width:calc(50% - 1.25em);
            right:0;
            position:absolute;
        }
        :host .header li:first-child:before {display:none;}
        :host .header li:last-child:after {display:none;}
        :host .header li[visited] span.label {}
        :host .header li[visited] span.icon {background:var(--x-color-primary); color:white;}
        :host .header li[selected] span.label {font-weight:600; }


        :host .body {padding:1em;}
        :host .footer {text-align:right;}
        :host .footer x-button {min-width: var(--x-button-width-wide);}

        ::slotted(x-wizard-panel) {
            display:none;
        }
    `,
    state: {
        index: 0,
        panels: []
    },
    template: `
        <style x-html="state.style"></style>
        <ul class="header">
            <li x-for="panel in state.panels" x-attr:selected="(state.index == panel.index - 1 ? true : false)" x-attr:visited="(panel.index - 1 <= state.index ? true : false)">
                <span class="icon">
                    <x-icon x-if="panel.index - 1 < state.index" icon="x-check"></x-icon>
                    <x-icon x-elseif="panel.icon" x-attr:icon="panel.icon" ></x-icon>
                    <span   x-else class="number" x-text="panel.index"></span>
                </span>
                <span x-if="panel.label" class="label" x-text="panel.label"></span>
                <span x-if="panel.message" class="message" x-text="panel.message"></span>
            </li>
        </ul>        
        <div class="body">
            <slot x-on:slotchange="refresh"></slot>
        </div>
        <div class="footer">
            <x-button x-if="state.index > 0" x-on:click="prev" label="prev"></x-button>
            <x-button class="important" x-if="state.index < state.panels.length" x-on:click="next" label="next"></x-button>
            <x-button class="important" x-if="state.index == state.panels.length" x-on:click="done" label="done"></x-button>
        </div>
    `,
    settings: {
        observedAttributes: [],
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "prev") {
                //prev
                this.state.index--;
                this.onCommand("refresh");

            } else if (command == "next") {
                //next
                this.state.index++;
                this.onCommand("refresh");

            } else if (command == "done") {
                //done

            } else if (command == "refresh") {
                //refresh
                let panels = [];
                this.querySelectorAll(":scope > x-wizard-panel").forEach((panel, index) => {
                    panels.push({
                        label: panel.getAttribute("label"),
                        message: panel.getAttribute("message"),
                        icon: panel.getAttribute("icon") || "",
                        index: index + 1
                    });
                });
                this.state.panels = panels;
                this.state.style = `::slotted(x-wizard-panel:nth-child(${parseInt(this.state.index) + 1})) {display:block;}`;
            }
        }
    }
});

