
import { bindMenuPresenter, getMenuShortcutHints } from "../utils/menu-presenter.js";

export default {
    contract: {
        description: "Workspace menu and pages.",
        properties: {
            menuName: {type:"string", default:"", state:true, query:true},
            item: {type:"string", default:null, state:true, query:true, reflect:true},
            showTitle: {type:"boolean", default:true, state:true, query:true}
        },
        examples: [
            {
                name: "preferences",
                description: "Open Internationalization in a stacked Preferences workspace.",
                language: "javascript",
                code: `
                    await navigation.navigate({
                        href: "page:x:/pages/workspace.js?menu-name=preferences&item=i18n",
                        page,
                        open: "stack"
                    });
                `
            },
            {
                name: "hide-title",
                description: "Open the Preferences workspace with its embedded Page heading hidden.",
                language: "javascript",
                code: `
                    await navigation.navigate({
                        href: "page:x:/pages/workspace.js?menu-name=preferences&show-title=false",
                        page,
                        open: "stack"
                    });
                `
            }
        ]
    },

    meta: {
        title:"Workspace", 
        description: "Workspace menu and pages.",
        classes: ["size-medium", "layout-fill"]
    },

    style: `
        :scope {height:100%;}
        :scope > div {display:flex; flex-direction: row; flex:1; height:100%;}

        :scope > div .menu-container {min-width:16; width:18em; background:var(--x-layout-main-drawer-background); padding:1.5em}

        :scope > div .page-container {display:block; padding:1.5em; flex:1; overflow-y:auto; min-width:50%; scrollbar-width: var(--x-scrollbar-width); scrollbar-gutter: var(--x-scrollbar-gutter); }
        :scope > div .page-container.hide-title > x-page {--x-layout-embed-heading-display:none;}
    `,

    template: `
        <div>
            <div class="menu-container" x-on:click.capture="selectItem">
                <x-menuitem x-recursive="(menuitem,index,indexAbsolute) in state.menu"
                    x-key="id,href,path,command,order" 
                    x-attr:data-menu-index="menuitem.shortcut ? indexAbsolute : null"
                    x-attr:data-item="menuitem.label != '-' && !menuitem.command && !menuitem.target && (menuitem.path || menuitem.href) ? menuitem.id : null"
                    x-attr:label="menuitem.label"
                    x-attr:href="menuitem.path || menuitem.href"
                    x-attr:target="menuitem.target"
                    x-attr:command="menuitem.command"
                    x-attr:shortcut="state.shortcutHints[indexAbsolute]"
                    x-attr:disabled="menuitem.disabled"
                    x-attr:icon="menuitem.icon"                     
                    x-attr:class="menuitem.class"
                    x-attr:tooltip="menuitem.tooltip" 
                    x-attr:selected="state.item != null && menuitem.id == state.item && menuitem.label != '-' && !menuitem.command && !menuitem.target && !!(menuitem.path || menuitem.href)"
                    open="embed"
                    outlet="content"
                    >                
                </x-menuitem>
            </div>
            
            <x-splitter opaque></x-splitter>

            <div class="page-container" x-class:hide-title="!state.showTitle">
                <x-page outlet="content" x-attr:src="state.src" x-on:load="refresh" class="titled" layout="embed" x-once></x-page>
            </div>
        </div>

    `,

    state: {
        menu: [],
        shortcutHints: [],
        title: null,
        description: null,
        src: null
    },

    controller({state, menus, page, navigation, query, postRender, services, bus, events}) {

        return {
            load() {
                // Retain the menu selected when this Workspace loads.
                this._menu = menus.getMenu(state.menuName);
                if (!this._menu) return;
                this.refreshMenu();
                events.on(bus, "xshell:menus:change", () => this.refreshMenu());
                page.label = this._menu.label;
                page.description = this._menu.description;
                page.icon = this._menu.icon;
            },
            mount() {
                // Wait until the Workspace is in the navigation stack and its outlet exists.
                postRender("bindMenu");
                if (!state.src) postRender("openInitialItem");
            },
            unmount() {
                this._releaseMenu?.();
                this._releaseMenu = null;
            },
            bindMenu() {
                // Keep mounted activation on the Workspace's own click handler and outlet.
                this._releaseMenu?.();
                this._releaseMenu = bindMenuPresenter(page.host?.querySelector(".menu-container"), state.menu, services);
            },
            refreshMenu() {
                // Publish the latest menu snapshot without reopening the selected Page.
                const items = this._menu.items;
                if (state.menu === items) return;
                this.collectItems(items);
                state.menu = items;
                state.shortcutHints = getMenuShortcutHints(items);
                if (this._releaseMenu) postRender("bindMenu");
            },
            collectItems(items, result = new Map()) {
                // Collect embedded destinations in depth-first menu order.
                for (const item of items) {
                    if (item.label !== "-" && !item.command && !item.target && (item.path || item.href)) {
                        if (item.id) {
                            if (result.has(item.id)) {
                                throw new Error(`Workspace menu '${state.menuName}' has duplicate navigable item ID '${item.id}'.`);
                            }
                            result.set(item.id, item);
                        }
                    }
                    if (item.children?.length) this.collectItems(item.children, result);
                }
                return result;
            },
            openInitialItem() {
                // Discard the obsolete query parameter without using it as a destination.
                if (query.has("src")) page.replaceQuery({ src: null });

                const items = this.collectItems(state.menu);
                const item = items.get(state.item) ?? items.values().next().value;
                if (item) return this.openItem(item);
                state.item = null;
            },
            selectItem({event}) {
                // Handle ordinary anchor activation before x-anchor performs its default navigation.
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                const path = event.composedPath();
                const anchor = path.findIndex(element => element.localName === "a");
                const menuitem = path.find(element => element.localName === "x-menuitem");
                if (anchor < 0 || !menuitem?.dataset.item || path.slice(0, anchor).some(element => element.classList?.contains("has-childs"))) return;
                const item = this.collectItems(state.menu).get(menuitem.dataset.item);
                if (!item || item.disabled) return;
                event.preventDefault();
                return this.openItem(item);
            },
            openItem(item) {
                // Reflect the selection and navigate the existing outlet, including after its x-once render.
                state.item = item.id;
                return navigation.navigate({ href: item.path || item.href, page, open: "embed", outlet: "content" });
            },
            refresh({event}) {
                // Track the embedded Page and heading independently of the Workspace selection.
                state.src = event.detail.page.src;
                state.title = event.detail.page.label;
                state.description = event.detail.page.description;
            }
        }

    }
};
