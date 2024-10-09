import XElement from "../../../x-element.js";
import xshell from "../../../x-shell.js";

// definition
let definition = {
    style: `
        :host {}
        ul {margin:0; padding:0}
        li {display:inline}
        li + li:before {content: ' / '}
    `,
    template: `
        <nav>
            <ul>
                <li x-for="item in state.breadcrumb">
                    <a x-attr:href="item.href">{{ item.label }}</a>
                </li>
                <li>
                    {{ state.label }}
                </li>
            </ul>
        </nav>
    `,
    state() {
        return {
            breadcrumb: [],
            label: ""
        };
    },
};

// class
class XBreadcrumb2 extends XElement {

    //static
    static definition = definition;

    //events
    onLoad() { 
        let page = xshell.getPage(this);
        if (page) {
            page.addEventListener("page:load", () => {
                this.refresh();
            });
            page.addEventListener("page:change", () => {
                this.refresh();
            });
        }
    } 
    
    //methods
    refresh() {
        let page = xshell.getPage(this);
        if (page) {
            let breadcrumb = [];
            for (let item of page.breadcrumb) {
                item.href = xshell.getRealUrl(item.href);
                breadcrumb.push(item);
            }
            this.state.breadcrumb = breadcrumb;
            this.state.label = page.label;
        }
    }
 
}

//define
customElements.define('x-breadcrumb2', XBreadcrumb2);

// export
export default XBreadcrumb2;
