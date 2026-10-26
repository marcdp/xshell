// contract
export const contract = {
    description: "Displays one selectable item in an x-listview collection.",
    events: {},
    properties: {
        icon:        {type:"string", default:"x-file", attribute:true, state:true, description:"Item icon."},
        label:       {type:"string", default:"", attribute:true, state:true, description:"Primary item label."},
        description: {type:"string", default:"", attribute:true, state:true, description:"Secondary item description."},
        path:        {type:"string", default:"", attribute:true, state:true, description:"Item path within the list."},
        href:        {type:"string", default:"", attribute:true, state:true, description:"Optional navigation target."},
        target:      {type:"string", default:"", attribute:true, state:true, description:"Optional browser target for navigation."},
        open:        {type:"string", default:"auto", attribute:true, state:true, enum:["auto", "top", "dialog", "stack", "embed"], description:"XShell navigation presentation."},
        breadcrumb:  {type:"boolean", default:false, attribute:true, state:true, description:"Whether navigation contributes the current breadcrumb."},
        category:    {type:"string", default:"", attribute:true, state:true, description:"Grouping label used in list and details views."},
        selected:    {type:"boolean", default:false, attribute:true, state:true, description:"Whether the item is selected."},
        index:       {type:"number", default:0, attribute:false, state:true, description:"Zero-based position assigned by the containing list."}
    },
    methods: {
        activate: {
            description: "Activates the item's navigation link when one is configured.",
            returns: {type:"void"}
        }
    },
    slots: {
        "": {description:"Additional details cells, in header-column order after the primary cell."}
    }
};

// implementation
export default {
    style: `
        :host {
            display: block;
            position: relative;
            min-width: 0;
            box-sizing: border-box;
        }
        :host([hidden]) {display:none!important;}
        
        /* category */
        .category {display: none;box-sizing: border-box; padding-left:2.1em; font-weight: 600; color: var(--x-color-text); }

        /* row */
        .row {min-width: 0;box-sizing: border-box;border-radius: var(--x-menuitem-border-radius); user-select: none;}
        .item-anchor {display: block; min-width: 0;box-sizing: border-box;border-radius: inherit;}
        .item-anchor::part(a) {display: flex; min-width: 0; box-sizing: border-box;align-items: center;}
        x-anchor.item-anchor {display:inline-block; }

        /* primary */
        .primary {display: flex; align-items:center; gap:.3em; min-width:0; width:100%; box-sizing: border-box;  cursor:pointer;}
        .primary x-icon {display: inline-block; transform: translateY(-.1em);}
        .primary .text {display: flex; align-items: baseline; min-width: 0;flex: 1;}
        .primary .label {cursor:pointer;}
        .primary .label, .primary .description {min-width: 0;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;}
        .primary .description {color:var(--x-color-text-gray);}
        .primary .description:empty {display:none;}

        /* list */
        @container style(--x-listview-view: 'list') {
            :host {line-height: 1.8em;}
            .row {padding:0 .5em;}
            x-anchor.item-anchor::part(a) {padding:0em .45em;}
            .description {display:none;}
            slot {display:none;}
            :host([data-category-visible]) .category {display: block;}
            .category:empty {display:none;}
        }

        /* details */
        @container style(--x-listview-view: 'details') {
            :host {line-height: 1.8em;}
            .row {display: grid; grid-template-columns: var(--x-listview-grid-template-columns);padding: 0 .35em; border-radius: 0; width:100%; }
            x-anchor.item-anchor::part(a), ::slotted(*) {padding: 0em .15em; min-width: 0; box-sizing: border-box;}
            .description::before {content:"("; padding-left:.25em;}
            .description::after {content:")"}
            slot {display:contents;}
            :host([data-category-visible]) .category {display: block;}
            .category:empty {display:none;}
        }

        /* icons */
        @container style(--x-listview-view: 'icons') {
            .row {height:6.5em;}
            x-anchor.item-anchor, x-anchor.item-anchor::part(a) {height:100%;}
            .primary {flex-direction:column; justify-content:center; padding:.5em;}
            .primary > x-icon {font-size:2.2em;}
            .text {display:block; flex:0 1 auto; width:100%; text-align:center;}
            .label {display:block; width:100%;}
            slot {display:none;}
            .description,
            .supplemental {display:none;}
        }

        /* tiles */
        @container style(--x-listview-view: 'tiles') {
            :host {padding:.12em;}
            .row {min-height:4.2em; height:100%;}
            x-anchor.item-anchor, x-anchor.item-anchor::part(a) {height:100%;}
            .primary {padding:.55em .7em; }
            .primary > x-icon {font-size:1.8em; flex:0 0 auto;}
            .text {display:flex; flex-direction:column; align-items:stretch; gap:.05em; }
            slot {display:none;}
        }

        /* selection */
        .row.selected {border-radius:.25em!important; background:var(--x-color-background-x-gray);}
        x-anchor.item-anchor::part(a):focus-visible {outline: .1em solid var(--x-color-text); outline-offset: -.2em; border-radius: inherit; border-radius:.25em; }
    `,
    template: `
        <div class="category" x-text="state.category"></div>
        <div class="row" x-class:selected="state.selected">
            <x-anchor x-if="state.href" data-item-anchor class="item-anchor plain" x-attr:href="state.href" x-attr:target="state.target" x-attr:open="state.open" x-prop:breadcrumb="state.breadcrumb" x-attr:tooltip="state.description">
                <div class="primary">
                    <x-icon x-attr:icon="state.icon || 'x-file'"></x-icon>
                    <span class="text">
                        <span class="label" x-text="state.label"></span>
                        <span class="description" x-text="state.description"></span>
                    </span>
                </div>
            </x-anchor>
            <label x-else data-item-anchor class="item-anchor">
                <div class="primary">
                    <x-icon x-attr:icon="state.icon || 'x-file'"></x-icon>
                    <span class="text">
                        <span class="label" x-text="state.label"></span>
                        <span class="description" x-text="state.description"></span>
                    </span>
                </div>
            </label>
            <slot></slot>
        </div>
    `,
    controller({ state, host }) {
        return {
            load() {
                // load
            },
            activate() {
                // activate
                if (!state.href) return;
                const anchor = host.shadowRoot?.querySelector("x-anchor");
                anchor?.shadowRoot?.querySelector("a")?.click();
            }
        };
    }
};
