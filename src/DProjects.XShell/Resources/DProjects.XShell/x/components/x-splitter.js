
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
            disabled: {type: "boolean",default: false,attribute: true,state: true,reflect: true},
            opaque: {type: "boolean",default: false,attribute: true,state: true,reflect: true}

        },
        methods: {},
        examples: [
            {
                name: "row-panes",
                description: "Resize adjacent panes in a flex row while retaining minimum widths.",
                template: `
                    <div style="display:flex; min-height:8rem">
                        <aside style="flex:0 0 14rem; min-width:8rem">Outline</aside>
                        <x-splitter></x-splitter>
                        <section style="flex:1; min-width:12rem">Content</section>
                    </div>
                `
            },
            {
                name: "disabled-column",
                description: "Lay out vertical panes with a splitter that cannot be resized.",
                template: `
                    <div style="display:flex; flex-direction:column; height:20rem">
                        <section style="flex:0 0 8rem; min-height:4rem">Preview</section>
                        <x-splitter disabled></x-splitter>
                        <section style="flex:1; min-height:4rem">Details</section>
                    </div>
                `
            }
        ]
    },
    style: `
        :host {
            display: flex;
            position: relative;
            z-index: 1;
            justify-content: end;
            flex: 0 0 .15em;
            
        }

        /* Handle */
        .handle {
            background: var(--x-splitter-background);
            position: absolute;
            inset: 0;
            cursor: col-resize;
            touch-action: none;
            user-select: none;
            outline: none;
        }
        .handle[aria-orientation="horizontal"] { cursor: row-resize; }
        :host([disabled]) .handle { cursor: default; }
        .handle.opaque {opacity:0;}
    `,
    template: `
        <div class="handle" role="separator" tabindex="0"
            x-class:opaque="state.opaque"
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

        return {
            mount() {
                if (host.parentElement) postRender("orientation");
            },
            orientation(direction = getComputedStyle(host.parentElement).flexDirection) {
                // Use the parent's main axis and keep the separator semantics in sync.
                const y = direction.startsWith("column");
                host.shadowRoot.querySelector(".handle")?.setAttribute("aria-orientation", y ? "horizontal" : "vertical");
                return { axis: y ? "height" : "width", coordinate: y ? "clientY" : "clientX", sign: direction.endsWith("reverse") ? -1 : 1 };
            },
            sideSum(style, sides, property, suffix = "") {
                return sides.reduce((sum, side) => sum + (parseFloat(style[property + side + suffix]) || 0), 0);
            },
            resolveLength(value, reference) {
                if (value.endsWith("px")) return parseFloat(value);
                if (reference !== undefined && value.endsWith("%")) return parseFloat(value) * reference / 100;
            },
            probeSize(element, axis, basis) {
                // Let Flexbox resolve intrinsic, percentage and calculated limits in the live layout.
                const { style } = element;
                const hadStyle = element.hasAttribute("style");
                const flex = ["flex-grow", "flex-shrink", "flex-basis"].map(name => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]);
                try {
                    // Write through CSSOM so the probe works under the host's Content Security Policy.
                    style.setProperty("flex", `0 0 ${basis}px`, "important");
                    return size(element, axis);
                } finally {
                    style.removeProperty("flex");
                    for (const [name, value, priority] of flex) {
                        if (value) style.setProperty(name, value, priority);
                    }
                    if (!hadStyle && element.hasAttribute("style")) element.removeAttribute("style");
                }
            },
            measurePane(element, style, axis, sides, total) {
                // Express CSS limits in border-box pixels and record the inset needed for a flex basis.
                const dimension = axis === "width" ? "Width" : "Height";
                const inset = this.sideSum(style, sides, "padding") + this.sideSum(style, sides, "border", "Width");
                const basisInset = style.boxSizing === "border-box" ? 0 : inset;
                const min = this.resolveLength(style["min" + dimension]);
                const maxValue = style["max" + dimension];
                const max = this.resolveLength(maxValue);
                const flexible = Number(style.flexGrow) > 0;
                const minimum = min === undefined ? this.probeSize(element, axis, 0) : Math.max(inset, min + basisInset);
                const maximum = maxValue === "none" ? Infinity : max === undefined
                    ? this.probeSize(element, axis, total) : Math.max(inset, max + basisInset);
                return { element, flexible, basisInset, min: minimum, max: Math.max(minimum, maximum) };
            },
            measure() {
                // Measure the pair and the parent's content box before changing any flex bases.
                const parent = host.parentElement;
                const first = host.previousElementSibling;
                const second = host.nextElementSibling;
                if (!parent || !first || !second) return null;
                const parentStyle = getComputedStyle(parent);
                const direction = this.orientation(parentStyle.flexDirection);
                const { axis } = direction;
                const horizontal = axis === "width";
                const sides = horizontal ? ["Left", "Right"] : ["Top", "Bottom"];
                const inner = size(parent, axis) - this.sideSum(parentStyle, sides, "border", "Width");
                const client = horizontal ? parent.clientWidth : parent.clientHeight;
                const reference = Math.max(0, (Math.abs(client - inner) <= 0.5 ? inner : client) - this.sideSum(parentStyle, sides, "padding"));
                const firstStyle = getComputedStyle(first);
                const secondStyle = getComputedStyle(second);
                const current = size(first, axis);
                let total = current + size(second, axis);

                // Fill the available space in a two-pane layout, accounting for margins and both gaps.
                if (parent.children.length === 3 && parentStyle.flexWrap === "nowrap") {
                    const gap = this.resolveLength(horizontal ? parentStyle.columnGap : parentStyle.rowGap, reference) ?? 0;
                    const margins = [firstStyle, getComputedStyle(host), secondStyle].reduce((sum, style) => sum + this.sideSum(style, sides, "margin"), 0);
                    total = Math.max(0, reference - size(host, axis) - margins - 2 * gap);
                }
                const pane = this.measurePane(first, firstStyle, axis, sides, total);
                const next = this.measurePane(second, secondStyle, axis, sides, total);
                return { ...direction, pane, next, current, total, min: Math.max(pane.min, total - next.max), max: Math.min(pane.max, total - next.min) };
            },
            setBasis(pane, value) {
                pane.element.style.flexBasis = `${Math.max(0, value - pane.basisInset)}px`;
            },
            resize(target, value) {
                // Clamp the preceding size to the range where both panes can fit.
                const { pane, next, axis, min, max, total } = target;
                if (min > max) return;
                const first = Math.max(min, Math.min(max, value));
                const second = total - first;
                const fits = () => Math.abs(size(pane.element, axis) - first) < 0.03 && Math.abs(size(next.element, axis) - second) < 0.03;
                if (fits()) return;

                // Keep the growing pane's basis where it can absorb the remainder on its own.
                if (pane.flexible === next.flexible) {
                    this.setBasis(pane, first);
                    this.setBasis(next, second);
                } else if (pane.flexible) {
                    this.setBasis(next, second);
                    if (!fits()) this.setBasis(pane, first);
                } else {
                    this.setBasis(pane, first);
                    if (!fits()) this.setBasis(next, second);
                }
            },
            notify(type, target) {
                host.dispatchEvent(new CustomEvent(type, {
                    bubbles: true,
                    detail: { size: size(target.pane.element, target.axis) }
                }));
            },
            pointerDown({ event }) {
                if (state.disabled || event.button !== 0) return;

                const target = this.measure();
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
                this.resize(drag, drag.current + (event[drag.coordinate] - drag.start) * drag.sign);
                this.notify("change", drag);
            },

            pointerUp({ event }) {
                if (!drag || drag.pointerId !== event.pointerId) return;
                if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                this.notify("resize", drag);
                this.notify("change", drag);
                drag = null;
            },

            keydown({ event }) {
                if (state.disabled) return;

                const target = this.measure();
                if (!target) return;

                const keys = target.axis === "width"
                    ? { ArrowLeft: -1, ArrowRight: 1 }
                    : { ArrowUp: -1, ArrowDown: 1 };

                const direction = keys[event.key];
                if (!direction) return;

                this.resize(target, target.current + direction * target.sign * (event.shiftKey ? 1 : 10));

                this.notify("resize", target);
                this.notify("change", target);
                event.preventDefault();
            },

            unload() {
                drag = null;
            }
        };
    }
};
