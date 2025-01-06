import XElement from "../ui/x-element.js";

// export
export default XElement.define("x-splitter", {
    style:`
        :host {
            display:block;
            width:.2em;
            background: var(--x-splitter-background); 
            cursor:ew-resize;
        }
    `,
    template: ``,
    state: {
    },
    methods: {
        onCommand(command) {
            if (command == "init"){
                //init
                let mouseMove = (event) => {
                    console.log("mouse move");
                };
                let mouseUp = (event) => {
                    console.log("mouse up");
                    document.removeEventListener("mousemove", mouseMove);
                    document.removeEventListener("mouseup", mouseUp);
                };
                this.addEventListener("mousedown", (event) => {
                    document.addEventListener("mousemove", mouseMove);
                    document.addEventListener("mouseup", mouseUp);
                });

            } else if (command == "resize") {
                //resize

            }
        }
    }                
});
