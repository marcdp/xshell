import XElement from "../ui/x-element.js";
import xshell from "./../../../x-shell.js";

// class
export default XElement.define("x-layout-app-main", {
    style: `
        :host {display:block;}
        nav {
            height:3em;
            color:var(--x-text-color-inverse); 
            background:var(--x-color-primary); 
            display:flex;
            align-items:center;
            position:fixed;
            top:0; left:0; right:0;
            z-index:20;
            padding-right:1em;
        }
        nav > x-icon {width:2.5em; text-align:center;}
        nav > span {flex:1}
        div {margin-top:3em;}
        :not(:defined) {
            visibility: hidden;
        }
    `,
    template: `
        <nav>
            <x-icon icon="x-settings"></x-icon>
            <label>This is header</label>
            <span></span>
            <slot name="toolbar"></slot>
            <x-avatar class="cursor" initials="MD" command="show-profile" x-on:command="show-profile"></x-avatar>
        </nav>
        <div>
            <slot></slot>
        </div>
        <x-drawer>
            <x-avatar initials="MD" label="Lucas grijander" message="Lorem ipsum asdfa "></x-avatar>
            <h2>Profile</h2>
            <x-menu class="plain">
                <x-menugroup label="Lorem ipsum">
                    <x-menuitem class="plain" label="Subopció 1" command="aaaaa"></x-menuitem>
                    <x-menuitem class="plain" label="Subopció 2"></x-menuitem>
                </x-menugroup>
                <x-divider></x-divider>
                <x-menugroup label="Lorem ipsum">
                    <x-menuitem class="plain" label="Subopció 3"></x-menuitem>
                    <x-menuitem class="plain" label="Subopció sdfgsdg4"></x-menuitem>
                    <x-menuitem class="plain" label="Subopció fgsd sd5"></x-menuitem>
                    <x-menuitem class="plain childs-inline" label="Subopció f sdfg sdfg6">
                        <x-menuitem class="plain" label="label3.1" command="s"></x-menuitem>
                        <x-menuitem class="plain" label="label3.2" command="s"></x-menuitem>
                        <x-menuitem class="plain childs-inline" label="label3.3  asdf MARC" >
                            <x-menuitem class="plain" label="label3.3.1" command="s"></x-menuitem>
                            <x-menuitem class="plain" label="label3.3.2" command="s"></x-menuitem>
                        </x-menuitem>
                    </x-menuitem>
                </x-menugroup>
            </x-menu>
        </x-drawer>
    `,
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load

            } else if (command == "show-profile") {
                //show profile
                this.shadowRoot.querySelector("x-drawer").toggle();
            }
        }
    }
});
