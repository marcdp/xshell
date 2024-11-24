import XElement from "../ui/x-element.js";
import xshell from "./../../../x-shell.js";

// class
export default XElement.define("x-app-bar", {
    style: `
        :host {
            display:flex;
            padding: 0 var(--x-page-padding-left) 0 var(--x-page-padding-right);
            height:4em;
            background:var(--x-background-page); 
            align-items:center;
            top:0; 
            left:0; 
            right:0;
            z-index:20;
            padding-right:1em;
        }
        a.logo {display:flex; align-items:center; text-decoration:none; color:var(--x-text-color); margin-right:.5em;}
        a.logo {height:2em; object-fit:contain;}
        a.logo .title {font-weight:600; padding-left:.5em;; }
        x-toolbar {flex:1;}
        x-toolbar .x-app-search {flex:1;}
        x-button.burguer {display:none}

        @media only screen and (max-width: 768px) {
            :host {border-bottom:.1em var(--x-color-primary) solid; position:fixed; top:0; left:0; right:0; height:3em;}
            :host a {flex:1;}
            :host x-toolbar {display:none;}
            :host x-button.burguer {display:block;}
        }

    `,
    template: `
        <a class="logo" x-attr:href="state.url">
            <img x-attr:src="state.logo"></img>
            <span class="title" x-text="state.title"></span>
        </a>
        <x-toolbar>
            <x-app-menu menu="primary" class="vertical"></x-app-menu>
            <x-app-search></x-app-search>                
            <x-app-menu menu="secondary"></x-app-menu>
        </x-toolbar>
        <x-button class="burguer plain icon-big" icon="x-menu" x-on:click="toggle"></x-button>
        <x-app-drawer>
            <h1>asda</h1>
            Lorem ipsum ....
        </x-app-drawer>
    `, 
    settings: {
        preload: ["component:x-menuitem", "component:x-contextmenu", "component:x-button"]
    },
    state: {
        title: "",
        logo: null,
        url: "#"
    },
    methods:{
        onCommand(command) {
            if (command == "load") {
                // load
                this.state.title = xshell.config.app.title;
                this.state.logo = xshell.config.app.logo;
                this.state.url = xshell.config.navigator.base;

            } else if (command == "toggle") {
                // toggle
                let drawer = this.shadowRoot.querySelector("x-app-drawer")
                drawer.toggle();

            }
        },
    }

});

