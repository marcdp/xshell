import xshell from "xshell";

// stylesheet
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(`
    :host {}
    :host a {display:inline; align-items:center; width:100%; }
    :host a[disabled] { pointer-events: none; color:gray;}
    
    :host(.menuitem) {}
    :host(.menuitem) a {display:flex; padding-left:.6em; padding-right:.6em; text-decoration:none;}

    :host(.plain) {}
    :host(.plain) a {text-decoration:none; color:var(--x-color-text)}
    :host(.plain) a:hover {color:var(--x-color-primary);}
    :host(.plain) a:active {color:var(--x-color-primary-dark)}
    :host(.plain.selected) a {color:var(--x-color-primary);}
    :host(.plain.selected) a:hover {color:var(--x-color-primary-dark);}    
`);

// class
class XAnchor extends HTMLElement {

    // vars
    _href = null;
    _open = "";
    _qs = {};
    _qsMutationObserver = null;
    _breadcrumb = null;
    _title = null;
    _icon = null;
    _disabled = false;
    _replace = false;
    
    // static
    static get observedAttributes() {
        return ["href", "target", "open", "rel", "breadcrumb", "title", "icon", "disabled", "replace"];
    }

    // props
    get href() { return this._href; }
    set href(value) { this._href = value; this._buildHref(); }
    get breadcrumb() { return this._breadcrumb; }
    set breadcrumb(value) { this._breadcrumb = value; this._buildHref(); }
    get title() { return this._title; }
    set title(value) { this._title = value; this._buildHref(); }
    get icon() { return this._icon; }
    set icon(value) { this._icon = value; this._buildHref(); }
    get open() { return this._open; }
    set open(value) { this._open = value; }
    get qs() { return this._qs; }
    set qs(value) { this._qs = value; this._buildHref(); }
    get disabled() { return this._disabled; }
    set disabled(value) { this._disabled = value; this._buildHref(); }
    get replace() { return this._replace; }
    set replace(value) { this._replace = value; this._buildHref(); }

    // ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.adoptedStyleSheets = [stylesheet];
        this.shadowRoot.innerHTML = `<a part="a"><slot></slot></a>`;
        this._anchor = this.shadowRoot.querySelector("a");
    }

    // methods
    connectedCallback() {
        this._anchor.addEventListener("click", (event)=> {
            if (this.disabled) {
                event.preventDefault();
                return true;
            }
            // default <a> behavior works automatically if href exists
            debugger;
        });
        for (const attr of this.attributes) {
            if (attr.name.startsWith("qs-")) {
                const attributeName = attr.name;
                const attributeValue = attr.value;
                this.attributeChangedCallback(attributeName, null, attributeValue);
            }
        }
        this._qsMutationObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.attributeName.startsWith("qs-")) {
                    const attributeName = mutation.attributeName;
                    const attributeOldValue = mutation.oldValue;
                    const attributeValue = this.getAttribute(mutation.attributeName);
                    this.attributeChangedCallback(attributeName, attributeOldValue, attributeValue);
                }
            }
        });
        this._qsMutationObserver.observe(this, {
            attributes: true
        });
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name == "href") {
            this._href = newValue;
            this._buildHref();
        } else if (name.startsWith("qs-")) {
            const qs = {};
            for (const attr of this.attributes) {
                if (attr.name.startsWith("qs-")) {
                    const key = attr.name.substring(3);
                    qs[key] = attr.value;
                }
            }
            this._qs = qs;
            this._buildHref();
        } else if (name == "breadcrumb") {
            this._breadcrumb = (newValue != null);
            this._buildHref();
        } else if (name == "title") {
            this._title = newValue;
            this._buildHref();
        } else if (name == "icon") {
            this._icon = newValue;
            this._buildHref();
        } else if (name == "open") {
            this._open = newValue;
        } else if (name == "target") {
            this._anchor.setAttribute("target", newValue);
        } else if (name == "rel") {
            this._anchor.setAttribute("rel", newValue);
        } else if (name == "disabled") {
            this._disabled = (newValue != null);
            this._buildHref();
        } else if (name == "replace") {
            this._replace = (newValue != null);
        }
    }
    disconnectedCallback() {
        this._qsMutationObserver.disconnect();
    }

    // private methods
    _buildHref() {
        if (!this._href) return;
        // build href
        const href = xshell.navigation.buildUrlAbsolute({
            href:   this._href,
            params: this._qs,
            nav:        {
                breadcrumb:(this._breadcrumb ? this.closest("x-page")?.breadcrumb : null),
                title: this.title,
                icon: this._icon
            },
            from: this.closest("x-page")
        });
        // set href    
        this._anchor.setAttribute("href", href);
        this._anchor.toggleAttribute("disabled", this._disabled);
    }
}

// register rewrite rule
xshell.urlRewriter.registerRule("x-anchor", "href", "navigation");

// register component
window.customElements.define("x-anchor", XAnchor);

// export component
export default XAnchor;


