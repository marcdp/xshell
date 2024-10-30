import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-wizard-header", {
    style: `
        :host {display:block;background:var(--x-background-gray);}
        
        :host ul {display:flex; margin:0; justify-content:center; padding:1em;}
        :host ul li {list-style:none; display:block; align-items:center; width:10em; text-align:center; padding:.5em; position:relative;}
        :host ul li div.icon {width:1.6em; height:1.6em; text-align:center; border:.1em var(--x-color-primary) solid; color:var(--x-color-primary); margin:0 auto; border-radius:50%; line-height:1.5em; background:var(--x-background-page);}
        :host ul li div.icon .number {font-size:var(--x-font-size-small);}
        :host ul li div.labels {display:block; z-index:1; position:relative}
        :host ul li div.labels span.label {margin-top:.25em; display:block;}
        :host ul li div.labels span.message {font-size:var(--x-font-size-small); display:block;}
        :host ul li:before {
            content:"";
            border:.075em gray solid; 
            top:1.25em;
            width:calc(50% - 1.25em);
            left:0;
            position:absolute;
        }
        :host ul li:after {
            content:"";
            border:.075em gray solid; 
            top:1.25em;
            width:calc(50% - 1.25em);
            right:0;
            position:absolute;
        }
        :host ul li:first-child:before {display:none;}
        :host ul li:last-child:after {display:none;}
        :host ul li[visited] span.label {}
        :host ul li[visited] div.icon {background:var(--x-color-primary); color:white;}
        :host ul li[selected] span.label {font-weight:600; }

        :host(.vertical) {}
        :host(.vertical) ul {flex-direction:column; padding:0; padding-top:1em; padding-bottom:1em;}
        :host(.vertical) ul li {display:flex; align-items:center; width:unset; min-height:4em; padding:0;}
        :host(.vertical) ul li div.icon-container { width:5em; }
        :host(.vertical) ul li div.icon {}
        :host(.vertical) ul li div.labels {text-align:left;display:block;  width:10em;}
        :host(.vertical) ul li div.labels span.label {white-space:nowrap;}
        :host(.vertical) ul li:before {
            content:"";
            border:.075em gray solid; 
            top:0;
            left:2.45em;
            height:calc(50% - 1.5em);
            width:0em;
            position:absolute;
        }
        :host(.vertical) ul li:after {
            content:"";
            border:.075em gray solid; 
            left:2.45em;
            height:calc(50% - 1.25em);
            top:calc(50% + 1.25em);
            width:0;
            position:absolute;
        }

    `,
    state: {
        index: 0,
        panels: []
    },
    template: `        
        <ul>
            <li x-for="panel in state.panels" x-attr:selected="(state.index == panel.index - 1 ? true : false)" x-attr:visited="(panel.index - 1 <= state.index ? true : false)">
                <div class="icon-container">
                    <div class="icon">
                        <x-icon x-if="panel.index - 1 < state.index" icon="x-check"></x-icon>
                        <x-icon x-elseif="panel.icon" x-attr:icon="panel.icon" ></x-icon>
                        <span   x-else class="number" x-text="panel.index"></span>
                    </div>
                </div>
                <div class="labels">
                    <span x-if="panel.label" class="label" x-text="panel.label"></span>
                    <span x-if="panel.message" class="message" x-text="panel.message"></span>
                </div>
            </li>
        </ul>
    `,
    settings: {
        observedAttributes: ["index"],
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                let panels = [];
                this.querySelectorAll(":scope > *").forEach((panel, index) => {
                    panels.push({
                        label: panel.getAttribute("label"),
                        message: panel.getAttribute("message"),
                        icon: panel.getAttribute("icon") || "",
                        index: index + 1
                    });
                });
                this.state.panels = panels;
            }
        }
    }
});

