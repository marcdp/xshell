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
        x-toolbar {flex:1;}
        x-toolbar a.logo {display:flex; align-items:center; text-decoration:none; color:var(--x-text-color); margin-right:.5em;}
        x-toolbar a.logo {height:2em; object-fit:contain;}
        x-toolbar a.logo .title {font-weight:bold; }
        x-toolbar .x-app-search {flex:1;}
    `,
    template: `
        <x-toolbar>
            <a class="logo" x-attr:href="state.url">
                <img x-attr:src="state.logo"></img>
            </a>

            <x-app-menu menu="primary"></x-app-menu>
            
            <x-app-search></x-app-search>                
            
            <x-app-menu menu="secondary"></x-app-menu>

        </x-toolbar>
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
            }
        },
    }

});

