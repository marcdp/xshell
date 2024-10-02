
class XBreadcrumb extends HTMLElement {

    //fields
    
    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = "&nbsp;";
    }

    //props
    get page() {
        var target = this;
        while (target) {
            if (!target.parentNode) {
                target = target.host;
            }
            if (target.localName == "x-page") return target;
            target = target.parentNode;
        }
        return null;
    }

    //events
    connectedCallback() { 
        this.page.addEventListener("load", () => {
            this.render();
        });
    } 
    render() {
        let html = [];
        html.push(this.page.label);
        this.shadowRoot.innerHTML = html.join("");
    }


}

export default XBreadcrumb;
customElements.define('x-breadcrumb', XBreadcrumb);