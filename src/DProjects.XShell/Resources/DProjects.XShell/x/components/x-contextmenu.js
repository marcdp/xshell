
// contract
export const contract = {
    description: "Provides a styled container for contextual menu content.",
    events: {},
    properties: {
        position: {type: "string", description: "The position of the context menu."}
    },
    methods: {        
        open: {
            description: "Opens the context menu.",
            parameters: [
                {name: "options", type: "object", description: "The options for opening the context menu, including x and y coordinates.", schema: {
                    type: "object",
                    properties: {
                        x: {type: "number", description: "The x-coordinate for the context menu."},
                        y: {type: "number", description: "The y-coordinate for the context menu."}
                    },
                    required: ["x", "y"]
                }}
            ]
        },
        close: {description: "Closes the context menu."}
    },
    slots: {
        "": {
            description: "Default slot for the context menu content."
        }
    }    
};


// implementation
export default {
    style: `
        :host div {
            background:var(--x-contextmenu-background);
            width:var(--x-menu-width);
            position:fixed;
            z-index:10;
            flex-direction:column; 
            width:var(--x-contextmenu-width); 
            border-radius:var(--x-contextmenu-border-radius); 
            padding: var(--x-contextmenu-padding); 
            box-shadow:var(--x-contextmenu-shadow); 
            border:var(--x-contextmenu-border); 
        }
    `,
    template: `
        <div x-if="state.visible" tabindex="0" x-style:left="state.x" x-style:top="state.y" x-on:keydown="keydown" x-on:command="command">
            <slot></slot>
        </div>
    `,
    state: {
        visible: false,
        x: 0,
        y:0,
    },
    controller({ state, host, commands }) {
        const outsideClick = (event) => {
            if (!event.composedPath().includes(host)) {
                host.close();
            }
        };
        const scroll = (event) => {
            host.close();
        }; 
        return {
            open({x, y}) {
                // open
                if (typeof x === "number" && typeof y === "number") {
                    // Keep the menu within the viewport
                    const rect = host.getBoundingClientRect();
                    const margin = 8;
                    const left = Math.max(margin,Math.min(x, window.innerWidth - rect.width - margin));
                    const top = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));
                    state.x = left + "px";
                    state.y = top + "px";
                }
                state.visible = true;
                // add event listeners to handle outside click and escape key
                document.addEventListener("pointerdown", outsideClick, true);
                document.addEventListener("scroll", scroll, true);
                // focus the menu after opening
                commands.enqueue("focus");
            },
            command({ event }) {
                this.close();
            },
            focus() {
                // focus
                const div = host.shadowRoot.querySelector("div");
                div.focus();
            },
            keydown({event}){
                // keydown
                if (event.key === "ArrowDown") {
                    // down: move focus to next menu item
                    event.preventDefault();
                    let menuitems = Array.from(host.querySelectorAll("x-menuitem"));
                    let currentIndex = menuitems.findIndex(item => item.matches(":focus"));
                    while (currentIndex < menuitems.length - 1 && (menuitems[currentIndex + 1].label == "-" || menuitems[currentIndex + 1].disabled)) {
                        currentIndex++;
                    }
                    if (currentIndex < menuitems.length - 1) {
                        menuitems[currentIndex + 1].focus();
                    }                    
                } else if (event.key === "ArrowUp") {
                    // up: move focus to previous menu item
                    event.preventDefault();
                    let menuitems = Array.from(host.querySelectorAll("x-menuitem"));
                    let currentIndex = menuitems.findIndex(item => item.matches(":focus"));
                    while (currentIndex > 0 && (menuitems[currentIndex - 1].label == "-" || menuitems[currentIndex - 1].disabled)) {
                        currentIndex--;
                    }
                    if (currentIndex > 0) {
                        menuitems[currentIndex - 1].focus();
                    }                    
                } else if (event.key === "PageUp") {
                    // page up: move focus to the first menu item
                    event.preventDefault();
                    let menuitems = Array.from(host.querySelectorAll("x-menuitem"));
                    if (menuitems.length > 0) {
                        menuitems[0].focus();
                    }
                } else if (event.key === "PageDown") {
                    // page down: move focus to the last menu item
                    event.preventDefault();
                    let menuitems = Array.from(host.querySelectorAll("x-menuitem"));
                    if (menuitems.length > 0) {
                        menuitems[menuitems.length - 1].focus();
                    }
                } else if (event.key === "Escape") {
                    // close
                    event.preventDefault();
                    this.close();
                }
            },
            close() {
                // close
                state.visible = false;
                // remove event listeners for outside click and escape key
                document.removeEventListener("pointerdown", outsideClick, true);
                document.removeEventListener("scroll", scroll, true);
            }
        }
    }
};

