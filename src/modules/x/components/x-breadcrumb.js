import xshell from "x-shell";

class XBreadcrumb extends HTMLElement {

    //fields
    
    //ctor
    constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = "&nbsp;";
    } 

    //events
    connectedCallback() { 
        let page = xshell.getPage(this);
        page.addEventListener("page:load", () => {
            this.render();
        });
        page.addEventListener("page:change", () => {
            this.render();
        });
    } 
    render() {
        let html = [];
        let page = xshell.getPage(this);
        if (page) {
            for(let item of page.breadcrumb) {
                let href = xshell.getRealUrl(item.href);
                html.push("<a href='" + href + "'>");
                html.push(item.label.replace(/</g,"&lt;"));
                html.push("</a>");
                html.push(" / ");

            }
            html.push(page.label);
            this.shadowRoot.innerHTML = html.join("");
        }
    }

}

export default XBreadcrumb;
customElements.define('x-breadcrumb', XBreadcrumb);