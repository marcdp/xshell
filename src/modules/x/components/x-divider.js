import XElement from "../ui/x-element.js";

// class
export default XElement.define("x-divider", {
    style: `
        :host {display:block;}
        :host hr {border:var(--x-divider-border); margin-left:0; margin-right:0;}

        :host-context(x-commandbar) hr {margin:0; margin-top:.45em; margin-bottom:.45em; height:calc(100% - .45em - .45em);}
        :host-context(x-menu) hr {margin-top:.3em; margin-bottom:.3em; margin-left:-.25em; margin-right:-.25em; border-top:none; }
    `,
    state: {
    },
    template: `<hr/>`
});

