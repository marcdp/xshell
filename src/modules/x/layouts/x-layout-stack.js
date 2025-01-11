import XElement from "../../x/ui/x-element.js";
import shell from "../../../shell.js";

// class
export default XElement.define("x-layout-stack", {
    style:`
        x-loading {
            position:fixed; top:0; left:0; right:0; 
            z-index:5;
        }
        div.backdrop {
            background:var(--x-layout-stack-backdrop);
            position:fixed; 
            top:0;
            left:0;
            right: 0;
            bottom:0;
            z-index:7;
        }
        div.panel {
            background:white;
            position:fixed;
            top:0;
            bottom:0;
            right: 0;
            width:80vw;
            overflow:auto;
            width:var(--x-layout-stack-width);
            height: unset;
            margin-right:0;
            outline:var(--x-layout-stack-border);
            max-height:unset; 
            padding:0;
            border-radius:var(--x-layout-stack-border-radius);
            box-shadow: var(--x-layout-stack-shadow);
            opacity:1;
            transform:translateX(100%);
            transition:transform var(--x-transition-duration) ease-out, opacity var(--x-transition-duration) ease-out;
            z-index:10;
        }
        div.panel.expanded {
            transform:translateX(0);
            opacity:1;
            transition:transform var(--x-transition-duration) ease, opacity var(--x-transition-duration) ease;
        }
        div.panel .header {
            padding: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);
            padding-bottom: 0;
            display:flex; 
            align-items:baseline; 
        }
        div.panel .header h2 {margin:0; flex:1; font-size: var(--x-font-size-subtitle); margin-right:1em;}
        div.panel .header x-button {transform:translateY(-0.2em);}
        div.panel .body {
            padding:var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);
        }    
        @media (max-width: 768px) {
            :host {
                --x-layout-stack-width:100vw;
                --x-layout-stack-border-radius: none;
                --x-layout-stack-shadow: none;
                --x-layout-stack-border: none;
            }
            div.panel .body {
                padding-top:1.4em;
            }    
        }
    `,
    template: `
        <div class="backdrop" x-on:click="query-close"></div>
        <div class="panel" x-class:expanded="state.expanded" x-on:transitionend="transition-end">
            <x-loading x-if="state.status=='loading'"></x-loading>
            <div class="header">
                <h2>{{ state.label }}&nbsp;</h2>
                <x-button class="anchor" icon="x-close" x-on:click="query-close"></x-button>
            </div>
            <div class="body">
                <slot></slot>
            <div>
        </div>
    `,
    state: {
        label:"", 
        expanded: false,
        status: ""
    },
    //settings: {
    //    observedAttributes: ["status"]
    //},
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load
                this.bindEvent(this.page, "load", "refresh");
                this.onCommand("refresh");
                this.shadowRoot.addEventListener("transitionEnd", ()=>this.onCommand("transition-end"));
                this.render();
                const secondsSinceLoad = ((performance.now() - shell.loadTime) / 1000).toFixed(2);
                if (secondsSinceLoad < .5) {
                    this.state.expanded = true;    
                } else {
                    setTimeout(()=>{
                        this.state.expanded = true;    
                    }, 50);
                }                

            } else if (command == "refresh") {
                //refresh
                this.label = this.page.label;

            } else if (command == "query-close") {
                //query close
                this.dispatchEvent(new CustomEvent("query-close", { composed: true }));

            } else if (command == "transition-end") {
                //transition end
                if (!this.state.expanded) {
                    this.page.remove();
                }

            } else if (command == "unload") {
                //unload
                return () => {
                    this.state.expanded = false;    
                };   
            }
        }

    }
});
