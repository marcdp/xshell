// contract
export const contract = {
    description: "Provides a draggable splitter between two adjacent panes.",
    events: {
        resize: {
            description: "Raised after the splitter changes the size of the preceding pane."
        }
    },
    properties: {
        orientation: {
            type: "string",
            default: "vertical",
            attribute: true,
            state: true,
            reflect: true,
            enum: ["vertical", "horizontal"],
            description: "Splitter orientation."
        },
        disabled: {
            type: "boolean",
            default: false,
            attribute: true,
            state: true,
            reflect: true,
            description: "Whether resizing is disabled."
        }
    },
    methods: {}
};


// implementation
export default {
    style: `
        :host {
            display:block;
            flex:0 0 .15em;
            background:var(--x-splitter-background);
            cursor:col-resize;
            user-select:none;
            touch-action:none;
        }

        :host([orientation="horizontal"]) {
            cursor:row-resize;
        }

        :host([disabled]) {
            cursor:default;
        }

        .handle {
            width:100%;
            height:100%;
            outline:none;
            box-sizing:border-box;
            touch-action:none;
        }
    `,
    template: `
        <div
            class="handle"
            role="separator"
            x-attr:aria-orientation="state.orientation"
            x-on:pointerdown="pointerDown"
            x-on:pointermove="pointerMove"
            x-on:pointerup="pointerUp"
            x-on:pointercancel="pointerUp"
            x-on:keydown="keydown">
        </div>
    `,
    controller({ state, host }) {
        function getLimits(pane, nextPane, vertical) {
            const dimension = vertical ? "width" : "height";
            const paneSize = pane.getBoundingClientRect()[dimension];
            const nextSize = nextPane.getBoundingClientRect()[dimension];
            const splitterSize = host.getBoundingClientRect()[dimension];
            const parent = host.parentElement;
            const parentStyle = parent && getComputedStyle(parent);
            const parentSize = parent && (parent[vertical ? "clientWidth" : "clientHeight"]
                - (parseFloat(parentStyle[vertical ? "paddingLeft" : "paddingTop"]) || 0)
                - (parseFloat(parentStyle[vertical ? "paddingRight" : "paddingBottom"]) || 0));
            const available = Math.max(0, Math.min(paneSize + nextSize,
                parentSize == null ? Infinity : parentSize - splitterSize));

            function minimum(element) {
                const style = getComputedStyle(element);
                const value = style[vertical ? "minWidth" : "minHeight"];
                const parsed = /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value) : 0;
                const inset = vertical
                    ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0)
                    : (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
                const basisInset = style.boxSizing === "border-box" ? 0 : inset;
                return { size: parsed + basisInset, basisInset };
            }

            const { size: min, basisInset } = minimum(pane);
            const { size: minNext } = minimum(nextPane);
            if (available < min + minNext) {
                return { min: paneSize, max: paneSize, basisInset };
            }
            return { min, max: available - minNext, basisInset };
        }

        return {
            pointerDown({ event }) {
                if (state.disabled || event.button !== 0) return;

                const pane = host.previousElementSibling;
                const nextPane = host.nextElementSibling;
                if (!pane || !nextPane) return;

                const vertical = state.orientation === "vertical";
                const paneRect = pane.getBoundingClientRect();
                const limits = getLimits(pane, nextPane, vertical);

                this._drag = {
                    pointerId: event.pointerId,
                    pane,
                    vertical,
                    start: vertical ? event.clientX : event.clientY,
                    size: vertical ? paneRect.width : paneRect.height,
                    ...limits
                };

                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
            },

            pointerMove({ event }) {
                const drag = this._drag;
                if (!drag || drag.pointerId !== event.pointerId) return;

                const position = drag.vertical ? event.clientX : event.clientY;
                const size = Math.max(drag.min, Math.min(drag.max, drag.size + position - drag.start));

                drag.pane.style.flex = `0 0 ${Math.max(0, size - drag.basisInset)}px`;
            },

            pointerUp({ event }) {
                const drag = this._drag;
                if (!drag || drag.pointerId !== event.pointerId) return;

                const rect = drag.pane.getBoundingClientRect();
                const size = drag.vertical ? rect.width : rect.height;

                if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }

                this._drag = null;

                host.dispatchEvent(new CustomEvent("resize", {
                    bubbles: true,
                    composed: false,
                    detail: { size }
                }));
            },

            keydown({ event }) {
                if (state.disabled) return;

                const pane = host.previousElementSibling;
                const nextPane = host.nextElementSibling;
                if (!pane || !nextPane) return;

                const vertical = state.orientation === "vertical";
                let direction = 0;

                if (vertical && event.key === "ArrowLeft") direction = -1;
                if (vertical && event.key === "ArrowRight") direction = 1;
                if (!vertical && event.key === "ArrowUp") direction = -1;
                if (!vertical && event.key === "ArrowDown") direction = 1;

                if (!direction) return;

                const paneRect = pane.getBoundingClientRect();
                const current = vertical ? paneRect.width : paneRect.height;
                const { min, max, basisInset } = getLimits(pane, nextPane, vertical);
                const size = Math.max(min, Math.min(max, current + direction * 10));

                pane.style.flex = `0 0 ${Math.max(0, size - basisInset)}px`;

                host.dispatchEvent(new CustomEvent("resize", {
                    bubbles: true,
                    composed: false,
                    detail: { size }
                }));

                event.preventDefault();
            },

            unload() {
                this._drag = null;
            }
        };
    }
};
