
// component
export default {
    contract: {
        description: "Automatically resizes adjacent flex panes.",
        events: {
            resize: {
                description: "Raised when resizing finishes.",
                detail: {
                    size: { type: "number" }
                }
            },
            change: {
                description: "Raised when the splitter position changes.",
                detail: {
                    size: { type: "number" }
                }
            }
        },
        properties: {
            disabled: {
                type: "boolean",
                default: false,
                attribute: true,
                state: true,
                reflect: true
            }
        },
        methods: {}
        
    },
    style: `
        :host {
            display: flex;
            position: relative;
            z-index: 1;
            justify-content: end;
            flex: 0 0 .15em;
            background: var(--x-splitter-background);
        }

        /* Handle */
        .handle {
            position: absolute;
            inset: 0;
            cursor: col-resize;
            touch-action: none;
            user-select: none;
            outline: none;
        }
        .handle[aria-orientation="horizontal"] { cursor: row-resize; }
        :host([disabled]) .handle { cursor: default; }
 
    `,
    template: `
        <div class="handle" role="separator" tabindex="0"
            x-attr:aria-disabled="state.disabled"
            x-on:pointerdown="pointerDown"
            x-on:pointermove="pointerMove"
            x-on:pointerup="pointerUp"
            x-on:pointercancel="pointerUp"
            x-on:keydown="keydown">
        </div>
    `,
    controller({ state, host, postRender }) {
        let drag = null;

        const size = (element, axis) => element.getBoundingClientRect()[axis];

        function minimum(element, axis) {
            const style = getComputedStyle(element);
            const sides = axis === "width" ? ["Left", "Right"] : ["Top", "Bottom"];
            const inset = sides.reduce((sum, side) => sum + (parseFloat(style["padding" + side]) || 0) + (parseFloat(style["border" + side + "Width"]) || 0), 0);
            const value = parseFloat(style[axis === "width" ? "minWidth" : "minHeight"]) || 0;
            const basisInset = style.boxSizing === "border-box" ? 0 : inset;
            return {
                min: Math.max(inset, value + basisInset),
                basisInset
            };
        }

        function orientation() {
            const direction = getComputedStyle(host.parentElement).flexDirection;
            const y = direction.startsWith("column");
            host.shadowRoot.querySelector(".handle") ?.setAttribute("aria-orientation", y ? "horizontal" : "vertical");
            return {
                axis: y ? "height" : "width",
                coordinate: y ? "clientY" : "clientX",
                sign: direction.endsWith("reverse") ? -1 : 1
            };
        }

        function measure() {
            const pane = host.previousElementSibling;
            const next = host.nextElementSibling;
            if (!pane || !next || !host.parentElement) return null;

            const direction = orientation();
            const current = size(pane, direction.axis);
            const total = current + size(next, direction.axis);
            const { min, basisInset } = minimum(pane, direction.axis);
            const nextMin = minimum(next, direction.axis);
            const valid = total >= min + nextMin.min;

            return {
                ...direction,
                pane, next, current, total, basisInset,
                nextInset: nextMin.basisInset,
                min: valid ? min : current,
                max: valid ? total - nextMin.min : current
            };
        }

        function resize(target, value) {
            const actual = Math.max(target.min, Math.min(target.max, value));
            // Keep the preceding pane flexible.
            // Resize only the following pane.
            const nextSize = target.total - actual - target.nextInset;
            target.next.style.flex = `0 0 ${Math.max(0, nextSize)}px`;
        }

        function notify(target) {
            host.dispatchEvent(new CustomEvent("resize", {
                bubbles: true,
                detail: { size: size(target.pane, target.axis) }
            }));
        }
        function notifyChange(target) {
            host.dispatchEvent(new CustomEvent("change", {
                bubbles: true,
                detail: { size: size(target.pane, target.axis) }
            }));
        }

        return {
            mount() {
                if (host.parentElement) postRender("orientation");
            },
            orientation() {
                return orientation();
            },
            pointerDown({ event }) {
                if (state.disabled || event.button !== 0) return;

                const target = measure();
                if (!target) return;

                drag = {
                    ...target,
                    pointerId: event.pointerId,
                    start: event[target.coordinate]
                };

                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
            },

            pointerMove({ event }) {
                if (!drag || drag.pointerId !== event.pointerId) return;
                resize(drag, drag.current + (event[drag.coordinate] - drag.start) * drag.sign);
                notifyChange(drag);
            },

            pointerUp({ event }) {
                if (!drag || drag.pointerId !== event.pointerId) return;
                if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                notify(drag);
                notifyChange(drag);
                drag = null;
            },

            keydown({ event }) {
                if (state.disabled) return;

                const target = measure();
                if (!target) return;

                const keys = target.axis === "width"
                    ? { ArrowLeft: -1, ArrowRight: 1 }
                    : { ArrowUp: -1, ArrowDown: 1 };

                const direction = keys[event.key];
                if (!direction) return;

                resize(target, target.current + direction * target.sign * (event.shiftKey ? 1 : 10));

                notify(target);
                notifyChange(target);
                event.preventDefault();
            },

            unload() {
                drag = null;
            }
        };
    }
};
