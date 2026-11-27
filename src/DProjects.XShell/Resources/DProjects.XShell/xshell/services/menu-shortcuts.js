import { getEventShortcut, parseShortcut } from "../utils/keyboard-shortcut.js";

const changeEvents = ["xshell:area:change", "xshell:menus:change"];
const editingKeys = /^[abciuvxyz ]$/i;

export default class MenuShortcuts {

    // Declare the empty options object required by the Services container.
    static optionsSchema = { 
        type: "object", 
        properties: {}, 
        additionalProperties: false 
    };

    // fields
    #menus;
    #bus;
    #document;
    #navigation;
    #listening = false;
    #bindings = new Map();
    #presenters = new WeakMap();
    #diagnostics = new Set();

    // ctor
    constructor({ bus, document, menus, navigation }) {
        // Use the application's document and effective navigation context.
        this.#menus = menus;
        this.#bus = bus;
        this.#document = document;
        this.#navigation = navigation;
    }

    // methods
    init() {
        // Subscribe once after Areas and Navigation have initialized.
        if (this.#listening) return;
        this.#refresh();
        this.#document.addEventListener("keydown", this.#keydown);
        for (const event of changeEvents) this.#bus.addEventListener(event, this.#refresh);
        this.#listening = true;
    }

    dispose() {
        // Release application listeners and all binding and presenter references.
        if (!this.#listening) return;
        this.#document.removeEventListener("keydown", this.#keydown);
        for (const event of changeEvents) this.#bus.removeEventListener(event, this.#refresh);
        this.#bindings.clear();
        this.#presenters = new WeakMap();
        this.#diagnostics.clear();
        this.#listening = false;
    }

    registerPresenter(item, host, activate) {
        // Match the effective object so identically labeled items remain independent.
        let presenters = this.#presenters.get(item);
        if (!presenters) this.#presenters.set(item, presenters = new Map());
        presenters.set(host, activate);
        return () => { if (presenters.get(host) === activate) presenters.delete(host); };
    }

    #refresh = () => {
        // Index only the current Area and the shared global menus.
        const menus = this.#menus.getMenus();
        const candidates = new Map();
        const diagnostics = new Set();
        const collect = (items, location) => {
            for (const [index, item] of items.entries()) {
                const name = `${location} / ${item.id || item.label || "item"} [${index + 1}]`;
                if (item.disabled || item.label === "-") continue;
                if (item.shortcut !== undefined && (item.command || item.href || item.path || item.children.length) &&
                    !(item.open === "embed" && item.outlet === "self")) {
                    // Normalize each alternative once so repeated declarations on one item don't conflict.
                    const declared = Array.isArray(item.shortcut) ? item.shortcut : [item.shortcut];
                    const keys = new Set();
                    for (const shortcut of declared) {
                        const key = parseShortcut(shortcut);
                        if (key) keys.add(key);
                        else diagnostics.add(`Invalid menu shortcut ${JSON.stringify(shortcut)} on ${name}.`);
                    }
                    for (const key of keys) {
                        if (!candidates.has(key)) candidates.set(key, []);
                        candidates.get(key).push({ item, name });
                    }
                }
                collect(item.children, name);
            }
        };
        for (const menu of menus) collect(menu.items, `${menu.scope === "global" ? "Global" : `Area '${menu.items[0]?.area}'` } menu '${menu.name}'`);

        // Suppress every claimant of an ambiguous combination and report the participants.
        this.#bindings.clear();
        for (const [key, entries] of candidates) {
            if (entries.length === 1) this.#bindings.set(key, entries[0].item);
            else diagnostics.add(`Conflicting menu shortcut '${key}': ${entries.map(entry => entry.name).join("; ")}.`);
        }
        for (const message of diagnostics) {
            if (!this.#diagnostics.has(message)) console.warn(message);
        }
        this.#diagnostics = diagnostics;
    };

    #keydown = event => {
        // Let focused controls handle the event first and preserve text entry and editing chords.
        if (event.repeat || event.isComposing || event.defaultPrevented) return;
        const item = this.#bindings.get(getEventShortcut(event));
        if (!item) return;
        const path = event.composedPath();
        const editable = path.find(node => typeof node.isContentEditable === "boolean");
        const inEditor = editable?.isContentEditable || path.some(node => node.localName === "input" || node.localName === "textarea");
        if (inEditor && (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.length !== 1 || editingKeys.test(event.key))) return;

        // Limit handling to XShell Pages and the document's default focus when XShell has a Page.
        const pages = this.#navigation.getXPages();
        const target = path[0];
        const rootPage = path.find(node => pages.includes(node) ||
            (node.localName === "x-page" && node.layout === "dialog" && node.parentNode === this.#document.body));
        if (!rootPage && !(pages.length && [this.#document, this.#document.body, this.#document.documentElement].includes(target))) return;

        // Prefer the mounted control, preserving its Page context and bubbling events.
        const pageHost = path.find(node => node.localName === "x-page") ?? pages[0];
        if (this.#activate(item, pageHost)) event.preventDefault();
    };

    #activate(item, pageHost) {
        // Prefer visible presenters and use the focused Page to break ties between copies.
        const presenters = [];
        for (const [host, activate] of this.#presenters.get(item) ?? []) {
            if (!host.isConnected || host.ownerDocument !== this.#document) continue;
            const visible = host.checkVisibility?.({visibilityProperty: true}) ?? true;
            const samePage = this.#navigation.getXPageFromElement(host) === pageHost;
            presenters.push({activate, priority: Number(visible) * 2 + Number(samePage)});
        }
        presenters.sort((a, b) => b.priority - a.priority);
        if (presenters.some(({activate}) => activate())) return true;

        // Preserve UI command events for menus that have no mounted control.
        if (item.command) {
            pageHost.dispatchEvent(new CustomEvent("command", {detail: {command: item.command, data: {}}, bubbles: true, composed: true}));
            return true;
        }

        // Use Navigation for logical XShell links and native anchor activation for browser targets.
        const href = item.path || item.href;
        if (!href) return false;
        const link = {href, open: item.open || "auto", outlet: item.outlet, page: pageHost.page};
        if (item.target || (!href.startsWith("page:") && (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith("//")))) {
            const anchor = this.#document.createElement("a");
            anchor.href = this.#navigation.buildUrlAbsolute(link);
            if (item.target) anchor.target = item.target;
            anchor.hidden = true;
            pageHost.appendChild(anchor);
            try { anchor.click(); }
            finally { anchor.remove(); }
        } else {
            this.#navigation.navigate(link).catch(error => console.error("Menu shortcut navigation failed.", error));
        }
        return true;
    }
}
