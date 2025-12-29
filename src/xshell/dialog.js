
export default class Dialog {

    // vars

    // ctor
    constructor() {
    }

    // methods
    async confirm() {
        debugger;
    }
    async message() {
        debugger;
    }
    async prompt() {
        debugger;
    }
    async showDialog({ src, context, sender }) {
        //show page dialog
        if (sender) {
            src = utils.combineUrls(sender.src, src);
        }
        let resolveFunc = null;
        let page = document.createElement("x-page");
        page.setAttribute("src", src);
        page.setAttribute("layout", "dialog");
        page.context = context || {};
        page.addEventListener("close", (event) => {
            resolveFunc(event.target.result);
            if (event.target.parentNode) {
                event.target.parentNode.removeChild(event.target);
            }
        });
        debugger;
        xshell.container.appendChild(page);
        return new Promise((resolve) => {
            resolveFunc = resolve;
        });
    }
}

