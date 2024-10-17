import XElement from "../ui/x-element.js";

// definition
export default XElement.define("x-breadcrumb", {
    style: `
        :host {display:block;}
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
    state: {
        breadcrumb: [],
        label: ""
    },
    methods: {
        onCommand(command) {
            if (command == "load") {
                //load
                let page = this.page;
                if (page) {
                    page.addEventListener("page:load", () => {
                        this.onCommand("refresh");
                    });
                    page.addEventListener("page:change", () => {
                        this.onCommand("refresh");
                    });
                }
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                let page = this.page;
                if (page) {
                    let breadcrumb = [];
                    for (let item of page.breadcrumb) {
                        let label = item.label;
                        let href = this.xshell.getRealUrl(item.href);
                        breadcrumb.push({label, href});
                    }
                    this.state.breadcrumb = breadcrumb;
                    this.state.label = page.label;
                }
            }
        }
    }
});
