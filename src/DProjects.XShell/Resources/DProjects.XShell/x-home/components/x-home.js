const favoritesKey = "x-home.favorites";
const pendingWrites = new WeakMap();

export default {
    contract: {
        description: "Launches Areas and Pages from their composed navigation menus.",
        tags: ["navigation", "areas", "pages"],
        properties: {
            areaId: {type: "string", default: "", attribute: true, state: true, description: "Area for Quick Links. Defaults to the current Area."}
        },
        examples: [
            {
                name: "current-area",
                description: "Show the home launcher with Quick Links from the current Area.",
                template: `<x-home></x-home>`
            }
        ]
    },
    style: `
        :host {display:grid; gap:1.5rem; color:var(--x-color-text);}
        h2 {margin:0 0 .65rem; font-size:1.2em;}
        .tiles {display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap:.65rem; list-style:none; margin:0; padding:0;}
        .tile {display:flex; align-items:center; gap:.5rem; min-width:0; padding:.75rem; border:var(--x-card-border); border-radius:var(--x-card-border-radius);}
        .tile[data-current] {background:var(--x-color-background-x-gray);}
        .destination {min-width:0; flex:1; display:flex; align-items:center; gap:.6rem; color:inherit; overflow-wrap:anywhere;}
        a.destination {text-decoration:none;}
        a.destination:hover, a.destination:focus-visible {color:var(--x-color-primary); text-decoration:underline;}
        .detail {display:block; margin-top:.2em; font-size:.9em;}
        .pin {flex:none; min-height:2rem; color:inherit; font:inherit; background:var(--x-button-background); border:var(--x-button-border); border-radius:var(--x-button-border-radius); cursor:pointer;}
        .pin:hover {background:var(--x-button-background-hover);}
        .pin:disabled {opacity:.6; cursor:default;}
    `,
    template: `
        <section aria-label="Areas">
            <h2>Areas</h2>
            <ul x-if="state.areaTiles.length" class="tiles">
                <li x-for="area in state.areaTiles" x-key="id" class="tile" x-attr:data-current="area.current">
                    <a x-if="area.link" class="destination" x-attr:href="area.link.url" x-attr:data-area="area.id"
                        x-attr:aria-current="area.current ? 'true' : null" x-on:click="openArea">
                        <x-icon x-attr:icon="area.icon" aria-hidden="true"></x-icon>
                        <span><strong>{{ area.label }}</strong><span x-if="area.description" class="detail">{{ area.description }}</span></span>
                    </a>
                    <div x-else class="destination" x-attr:aria-current="area.current ? 'true' : null">
                        <x-icon x-attr:icon="area.icon" aria-hidden="true"></x-icon>
                        <span><strong>{{ area.label }}</strong><span x-if="area.description" class="detail">{{ area.description }}</span>
                            <span class="detail">No landing Page</span></span>
                    </div>
                </li>
            </ul>
            <x-empty x-else icon="x-apps" label="No Areas available"></x-empty>
        </section>
        <section aria-label="Favorites">
            <h2>Favorites</h2>
            <p x-if="state.preferenceError" role="status">{{ state.preferenceError }}</p>
            <ul x-if="state.favorites.length" class="tiles">
                <li x-for="link in state.favorites" x-key="href" class="tile">
                    <a class="destination" x-attr:href="link.url" x-attr:data-href="link.href" x-attr:data-area="link.areaId" x-on:click="openLink">
                        <x-icon x-attr:icon="link.icon" aria-hidden="true"></x-icon>
                        <span><strong>{{ link.label }}</strong><span class="detail">{{ link.areaLabel }}</span></span>
                    </a>
                    <button type="button" class="pin" x-attr:data-favorite="link.favoriteId" x-attr:aria-label="'Unpin ' + link.label"
                        x-prop:disabled="state.saving" x-on:click="toggleFavorite">Unpin</button>
                </li>
            </ul>
            <x-empty x-else icon="x-star" label="No favorites" message="Pin Pages from Quick Links to keep them handy."></x-empty>
        </section>
        <section aria-label="Quick Links">
            <h2>Quick Links</h2>
            <ul x-if="state.quickLinks.length" class="tiles">
                <li x-for="link in state.quickLinks" x-key="href" class="tile">
                    <a class="destination" x-attr:href="link.url" x-attr:data-href="link.href" x-attr:data-area="link.areaId" x-on:click="openLink">
                        <x-icon x-attr:icon="link.icon" aria-hidden="true"></x-icon>
                        <strong>{{ link.label }}</strong>
                    </a>
                    <button x-if="link.favoriteId" type="button" class="pin" x-attr:data-favorite="link.favoriteId"
                        x-attr:aria-label="link.pinLabel + ' ' + link.label" x-prop:disabled="state.saving"
                        x-on:click="toggleFavorite">{{ link.pinLabel }}</button>
                </li>
            </ul>
            <x-empty x-else icon="x-page" label="No quick links" message="This Area has no Pages in its navigation menu."></x-empty>
        </section>
    `,
    state: {
        areaTiles: [],
        quickLinks: [],
        favorites: [],
        saving: false,
        preferenceError: ""
    },
    controller({ state, events, bus, areas, menus, navigation, preferences, config }) {
        let active = false;
        let readVersion = 0;
        let favoriteIds = [];
        let linksByArea = new Map();
        let favoriteLinks = new Map();

        return {
            load() {
                // Track navigation context, composed menus and the shared preference.
                active = true;
                events.on(bus, ["xshell:area:change", "xshell:menus:change"], "refresh");
                events.on(state, "change:areaId", "refresh");
                events.on(bus, "preferences:changed", event => {
                    if (event.detail.name === favoritesKey) return this.restoreFavorites();
                });
                this.refresh();
                return this.restoreFavorites();
            },

            unload() {
                // Ignore reads and writes that settle after destruction.
                active = false;
            },

            refresh() {
                // Build the launcher from current menu snapshots, including favorites from other Areas.
                const currentId = areas.getCurrentArea()?.id;
                linksByArea = new Map();
                favoriteLinks = new Map();
                state.areaTiles = areas.getAreas().map(area => {
                    const links = this.collectLinks(menus.getMenu("navigation", area.id)?.items || [], area);
                    linksByArea.set(area.id, links);
                    for (const link of links.values()) {
                        if (link.favoriteId && !favoriteLinks.has(link.favoriteId)) favoriteLinks.set(link.favoriteId, link);
                    }
                    return {
                        id: area.id, label: area.label, description: area.description, icon: area.icon || "x-apps",
                        current: area.id === currentId, link: links.get(area.home) || null
                    };
                });
                this.showFavorites();
            },

            collectLinks(items, area, links = new Map()) {
                // Inventory menus can attach paths to folders without a destination.
                for (const item of items) {
                    if (this.isPageTarget(item.href)) {
                        const href = this.isPath(item.path) ? item.path : item.href;
                        if (!links.has(href)) {
                            const link = this.createLink(href, area);
                            if (link) links.set(href, {
                                ...link, areaId: area.id, areaLabel: area.label, label: item.label,
                                icon: item.icon || "x-page", favoriteId: this.isFriendlyPath(item.path) ? item.path : null
                            });
                        }
                    }
                    if (item.children?.length) this.collectLinks(item.children, area, links);
                }
                return links;
            },

            isPath(value) {
                return typeof value === "string" && /^\/(?!\/)[^\s\\]*$/.test(value);
            },

            isPageTarget(value) {
                return this.isPath(value) || (typeof value === "string" && /^page:[^\s]+$/.test(value));
            },

            isFriendlyPath(value) {
                // Exclude the asset namespace even when it follows an Area prefix.
                const assetNamespace = config.xshell.assets.basePath;
                const path = this.isPath(value) ? value.split(/[?#]/, 1)[0] : "";
                return !!path && !path.endsWith(assetNamespace) && !path.includes(assetNamespace + "/");
            },

            createLink(href, area) {
                // Use the destination Area as context, including when it has an empty prefix.
                const page = {src: area.prefix || "/"};
                try {
                    return {href, page, url: navigation.buildUrlAbsolute({href, page})};
                } catch {
                    return null;
                }
            },

            openArea({ event }) {
                // Open the exact landing destination derived by Areas.
                const area = state.areaTiles.find(area => area.id === event.currentTarget.dataset.area);
                return this.navigate(event, area?.link);
            },

            openLink({ event }) {
                const {area, href} = event.currentTarget.dataset;
                return this.navigate(event, linksByArea.get(area)?.get(href));
            },

            navigate(event, link) {
                // Preserve native behavior for modified clicks and use Navigation for normal activation.
                if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                return navigation.navigate({href: link.href, page: link.page, open: "top"});
            },

            normalizeFavorites(value) {
                return Array.isArray(value) ? [...new Set(value.filter(path => this.isFriendlyPath(path)))] : [];
            },

            showFavorites() {
                // Resolve stored identities again after menu updates and omit missing destinations.
                const pinned = new Set(favoriteIds);
                state.favorites = favoriteIds.map(id => favoriteLinks.get(id)).filter(Boolean);
                const areaId = state.areaId || areas.getCurrentArea()?.id;
                state.quickLinks = [...(linksByArea.get(areaId)?.values() || [])].map(link => ({
                    ...link, pinLabel: pinned.has(link.favoriteId) ? "Unpin" : "Pin"
                }));
            },

            async restoreFavorites() {
                // Only the latest read may update this live instance.
                const version = ++readVersion;
                try {
                    const value = await preferences.get(favoritesKey, []);
                    if (!active || version !== readVersion) return;
                    favoriteIds = this.normalizeFavorites(value);
                    state.preferenceError = "";
                    this.showFavorites();
                } catch {
                    if (active && version === readVersion) state.preferenceError = "Favorites could not be loaded.";
                }
            },

            async toggleFavorite({ event }) {
                // Capture the displayed intent and serialize read-modify-write across launcher instances.
                const id = event.currentTarget.dataset.favorite;
                if (!active || state.saving || !favoriteLinks.has(id)) return;
                const pin = !favoriteIds.includes(id);
                state.saving = true;
                ++readVersion;
                const write = (pendingWrites.get(preferences) || Promise.resolve()).then(async () => {
                    const saved = this.normalizeFavorites(await preferences.get(favoritesKey, []));
                    const next = pin ? [...new Set([...saved, id])] : saved.filter(value => value !== id);
                    await preferences.set(favoritesKey, next);
                });
                pendingWrites.set(preferences, write.catch(() => {}));
                try {
                    await write;
                    if (active) await this.restoreFavorites();
                } catch {
                    if (active) state.preferenceError = "Favorites could not be saved.";
                } finally {
                    if (active) state.saving = false;
                }
            }
        };
    }
};
