import shell from "shell";
import XElement from "../ui/x-element.js";

// definition
export default XElement.define("x-page-breadcrumb", {
    style: `
        :host {display:block; margin-bottom:.25em;}
        ul {margin:0; padding:0; font-size:var(--x-font-size-small); color:var(--x-text-color-x-gray);}
        ul li {display:inline}
        ul li a {text-decoration:none; color:var(--x-text-color-x-gray);}
        ul li a:hover {color:var(--x-color-primary);}
        ul li.label {color:var(--x-text-color);}
    `,
    template: `
        <nav>
            <ul>
                <li x-for="item in state.breadcrumb">
                    <a x-attr:href="item.href">{{ item.label }}</a>
                    <x-icon icon="x-keyboard-arrow-right"><x-icon>
                </li>
                <li class="label">
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
                this.page.addEventListener("page:load", () => {
                    this.onCommand("refresh");
                });
                this.onCommand("refresh");

            } else if (command == "refresh") {
                //refresh
                let breadcrumb = [];
                for (let item of this.page.breadcrumb) {
                    let label = item.label;
                    let href = shell.getHref(item.src, this.page);
                    breadcrumb.push({ label, href });
                }
                this.state.breadcrumb = breadcrumb;
                this.state.label = this.label;
            }
        }
    }
});
