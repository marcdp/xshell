import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-listview-item", {
    style: `
        :host {}

        /* list */
        .list {display:block;}
        .list x-anchor {display:flex;} 
        .list x-anchor x-icon {margin-right:.25em;transform:translateY(-.1em);}
        .list x-anchor::part(a) { display:flex; align-items:center; }
        .list .description {color:var(--x-color-text-gray);}
        .list .description:empty {display:none;}
        .list .description::before {content:"("; padding-left:.25em;}
        .list .description::after {content:")";}
        .list .category {font-weight:600; padding-left: 1.5em; padding-top:.25em;}
        :host(.selected) .list {font-weight:600;}
        :host(.selected) .list x-anchor::part(a) {color:var(--x-color-primary);}

        /* icons */
        .icons {}
        .icons x-anchor {display:flex; width:6em; height:6em; border-radius:.5em;}  
        .icons x-anchor x-icon {font-size:2em; amargin-bottom:.15em;}
        .icons x-anchor::part(a) { display:flex; flex-direction:column; align-items:center; padding-left:.5em; padding-right:.5em; box-sizing:border-box; }
       
        .icons x-anchor:focus { outline:.15em solid var(--x-color-text)!important;}
        .icons x-anchor::part(a):focus {outline:anone; }

        .icons .label { text-align:center;}
        .icons .description {display:none}
        :host(.selected) .icons {font-weight:600;}
        :host(.selected) .icons x-anchor {outline:.15em solid var(--x-color-primary);}
        :host(.selected) .icons x-anchor::part(a) {color:var(--x-color-primary);}
    `,
    template: `
        <div x-attr:class="state.view">
            <div x-if="state.category" class="category">
                {{state.category}}
            </div>
            <x-anchor _tabindex="0" x-attr:href="state.href" x-attr:target="state.target" class="plain" x-attr:title="state.description">
                <x-icon class="size-ax2" x-attr:icon="state.icon"></x-icon>
                <span class="label" x-text="state.label"></span>
                <span class="description" x-text="state.description"></span>
            </x-anchor>
        </div>
    `,
    state: {
        icon: "",
        label: "",
        description: "",
        category: "",
        href: "",
        target: "",
        view: "list",
    },
    methods: {
        async onCommand(command) {
            if (command == "load") {
                //load                
            }
        }
    }
});

