
export default {
    contract: {
        description: "Displays the child navigation items of the containing Page.",
        examples: [
            {
                name: "basic",
                description: "List child navigation items on the Page that owns the menu branch.",
                template: `
                    <h1>In this section</h1>
                    <x-page-index></x-page-index>
                `
            }
        ]
    },
    style: `
        :host {
            display: block;
        }
    `,

    template: `
        <nav x-if="state.items.length" aria-label="Pages in this section">
            <ul>
                <li x-for="item in state.items">
                    <x-anchor x-attr:href="item.path || item.href">
                        {{ item.label }}
                    </x-anchor>
                </li>
            </ul>
        </nav>
    `,

    state: {
        items: []
    },

    controller({ areas, bus, events, getPage, state }) {
        return {
            load() {
                events.on(bus, "xshell:menus:change", "refresh");
                events.on(bus, "xshell:area:change", "refresh");
                events.on(bus, ["xshell:page:load", "xshell:page:change"], (event) => {
                    if (event.detail.id === getPage()?.id) {
                        this.refresh();
                    }
                });
            },

            mount() {
                this.refresh();
            },

            refresh() {
                const page = getPage();

                if (!page?.src) {
                    state.items = [];
                    return;
                }

                const areaId = areas.resolveAreaId(page.src);

                const menuitem = areas.resolveHref(
                    page.src,
                    areaId
                );

                state.items = menuitem?.children || [];
            }
        };
    }
};
