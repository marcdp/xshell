
export default {
    contract: {
        description: "Image viewer",
        properties: {
            src: { type: "string", default: null, state: true, query: true },
            path: { type: "string", default: null, state: true, query: true }
        }
    },

    meta: {
        title: "Image viewer",
        classes: ["fill"]
    },

    style: `
        .viewer {display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden;}
        .toolbar {display:flex; align-items:center; gap:.3em; flex:1;}
        .viewport {display:flex; flex:1; min-width:0; min-height:0; overflow:auto; overscroll-behavior:contain;}
        .image-stage {position:relative; flex:none; margin:auto;}
        .image-stage img {position:absolute; top:50%; left:50%; display:block; max-width:none; max-height:none; transform-origin:center; cursor:grab; user-select:none; -webkit-user-drag:none;}
        .image-stage img.dragging {cursor:grabbing;}
        x-notice {margin: var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal) var(--x-layout-stack-page-padding-vertical) var(--x-layout-stack-page-padding-horizontal);}
    `,

    template: `
        <x-toolbar class="toolbar" slot="header-actions" x-if="!state.error">
            <x-button icon="x-substract" command="zoomOut" class="round light"></x-button>
            <span>{{ state.label }}</span>
            <x-button icon="x-add" command="zoomIn" class="round light"></x-button>
            <x-button label="100%" command="actualSize" class="light"></x-button>
            <x-button label="Fit" command="fit" class="light"></x-button>
            <x-button icon="x-rotate" command="rotate" class="round light"></x-button>

            <span style="flex:1"></span>
            <span x-if="state.naturalWidth">
                {{ state.naturalWidth }} × {{ state.naturalHeight }} px /
                <x-file-size x-prop:value="state.fileSize"></x-file-size>
            </span>
            <x-button label="Print" icon="x-print" command="print" class="light"></x-button>
        </x-toolbar>

        <x-notice x-if="state.error" type="error" x-attr:message="state.error"></x-notice>
        <div class="viewer" x-else>
            
            <div class="viewport">
                <div class="image-stage"
                     x-if="state.url && !state.error"
                     x-style:width="state.stageWidth + 'px'"
                     x-style:height="state.stageHeight + 'px'">

                    <img x-attr:src="state.url"
                         x-style:width="state.width + 'px'"
                         x-style:height="state.height + 'px'"
                         x-style:transform="'translate(-50%, -50%) rotate(' + state.rotation + 'deg)'"
                         x-on:load="onImageLoaded"
                         x-on:error="onImageError"
                         x-on:wheel.prevent="onImageWheel"
                         x-on:pointerdown="onPointerDown"
                         x-on:pointermove="onPointerMove"
                         x-on:pointerup="onPointerUp"
                         x-on:pointercancel="onPointerUp"
                         x-on:lostpointercapture="onPointerUp"
                         draggable="false">
                </div>
            </div>
        </div>
    `,

    state: {
        src: null,
        path: null,
        url: null,
        error: "",
        fit: true,
        zoom: 1,
        label: "Fit",
        rotation: 0,
        naturalWidth: 0,
        naturalHeight: 0,
        fileSize: 0,
        width: 0,
        height: 0,
        stageWidth: 0,
        stageHeight: 0
    },

    controller({ state, page, loader }) {
        let filesystem = null;
        let readUrl = null;
        let viewport = null;
        let resizeObserver = null;
        let revision = 0;
        let disposed = false;
        let drag = null;

        let zoomFrame = 0;
        let zoomAnchor = null;

        const release = () => {
            readUrl?.dispose?.();
            readUrl = null;
        };

        const updateSize = () => {
            if (!state.naturalWidth || !state.naturalHeight) return;

            const rotated = state.rotation % 180 !== 0;
            const w = rotated ? state.naturalHeight : state.naturalWidth;
            const h = rotated ? state.naturalWidth : state.naturalHeight;

            if (state.fit && viewport?.clientWidth && viewport?.clientHeight) {
                state.zoom = Math.min(
                    1,
                    viewport.clientWidth / w,
                    viewport.clientHeight / h
                );
            }

            state.width = Math.round(state.naturalWidth * state.zoom);
            state.height = Math.round(state.naturalHeight * state.zoom);
            state.stageWidth = rotated ? state.height : state.width;
            state.stageHeight = rotated ? state.width : state.height;
            state.label = state.fit ? "Fit" : Math.round(state.zoom * 100) + "%";
        };

        const stopDrag = () => {
            if (!drag) return;

            const { element, pointerId } = drag;
            drag = null;
            element.classList.remove("dragging");

            if (element.hasPointerCapture(pointerId)) {
                element.releasePointerCapture(pointerId);
            }
        };

        const cancelZoomAnchor = () => {
            if (zoomFrame) cancelAnimationFrame(zoomFrame);
            zoomFrame = 0;
            zoomAnchor = null;
        };

        const applyZoomAnchor = () => {
            zoomFrame = 0;

            const anchor = zoomAnchor;
            zoomAnchor = null;

            if (!anchor || disposed || anchor.revision !== revision || !viewport) return;

            const stage = viewport.querySelector(".image-stage");
            if (!stage) return;

            const rect = stage.getBoundingClientRect();

            // Keep the same image point beneath the cursor.
            viewport.scrollLeft += rect.left + anchor.x * rect.width - anchor.clientX;
            viewport.scrollTop += rect.top + anchor.y * rect.height - anchor.clientY;
        };

        return {
            async load() {
                page.label = state.path.split("/").pop();
                page.description = state.path;
                await this.refresh();
            },

            async refresh() {
                const id = ++revision;

                stopDrag();
                cancelZoomAnchor();
                resizeObserver?.disconnect();
                viewport = null;

                state.url = null;
                state.error = "";
                state.naturalWidth = 0;
                state.naturalHeight = 0;
                state.rotation = 0;
                state.zoom = 1;
                state.fit = true;
                state.label = "Fit";

                release();

                try {
                    const fs = await loader.load("filesystem:" + state.src);
                    const entry = await fs.getEntry(state.path);
                    const result = await fs.getReadUrl(state.path);

                    if (disposed || id !== revision) {
                        result.dispose?.();
                        return;
                    }

                    filesystem = fs;
                    readUrl = result;
                    state.fileSize = entry?.length ?? 0;
                    state.url = result.url;
                } catch (error) {
                    if (!disposed && id === revision) {
                        state.error = error.message + ": " + state.path;
                    }
                }
            },

            // image events
            onImageLoaded({ event }) {
                state.naturalWidth = event.target.naturalWidth;
                state.naturalHeight = event.target.naturalHeight;

                viewport = event.target.closest(".viewport");

                resizeObserver?.disconnect();
                resizeObserver = new ResizeObserver(() => {
                    if (state.fit) updateSize();
                });

                if (viewport) resizeObserver.observe(viewport);
                this.fit();
            },

            onImageError() {
                state.error = "Unable to display image.";
            },

            // mouse wheel: zoom around the pointer position
            onImageWheel({ event }) {
                if (!state.naturalWidth || !event.deltaY || !viewport) return;

                const stage = event.currentTarget.parentElement;
                const rect = stage.getBoundingClientRect();

                if (!rect.width || !rect.height) return;

                // Position of the cursor within the current image.
                // Normalized coordinates also work with 90-degree rotation.
                zoomAnchor = {
                    x: (event.clientX - rect.left) / rect.width,
                    y: (event.clientY - rect.top) / rect.height,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    revision
                };

                const delta = event.deltaY *
                    (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);

                stopDrag();
                this.zoom(Math.exp(-delta * 0.002));

                // XShell renders state changes on the next animation frame.
                // Adjust scrolling after the new image dimensions are rendered.
                if (!zoomFrame) {
                    zoomFrame = requestAnimationFrame(applyZoomAnchor);
                }
            },

            // drag-to-pan
            onPointerDown({ event }) {
                if (event.pointerType !== "mouse" || event.button !== 0 || !viewport) return;

                if (viewport.scrollWidth <= viewport.clientWidth &&
                    viewport.scrollHeight <= viewport.clientHeight) return;

                event.preventDefault();
                stopDrag();

                drag = {
                    pointerId: event.pointerId,
                    element: event.currentTarget,
                    x: event.clientX,
                    y: event.clientY,
                    scrollLeft: viewport.scrollLeft,
                    scrollTop: viewport.scrollTop
                };

                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.classList.add("dragging");
            },

            onPointerMove({ event }) {
                if (!drag || drag.pointerId !== event.pointerId || !viewport) return;

                viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
                viewport.scrollTop = drag.scrollTop - (event.clientY - drag.y);
            },

            onPointerUp({ event }) {
                if (drag?.pointerId === event.pointerId) stopDrag();
            },

            // zoom
            fit() {
                cancelZoomAnchor();
                state.fit = true;
                updateSize();
            },

            actualSize() {
                cancelZoomAnchor();
                state.fit = false;
                state.zoom = 1;
                updateSize();
            },

            zoom(factor) {
                if (!state.naturalWidth) return;

                state.zoom = Math.max(.05, Math.min(16, state.zoom * factor));
                state.fit = false;
                updateSize();
            },

            zoomIn() {
                cancelZoomAnchor();
                this.zoom(1.25);
            },

            zoomOut() {
                cancelZoomAnchor();
                this.zoom(.8);
            },

            // rotation
            rotate() {
                cancelZoomAnchor();
                state.rotation = (state.rotation + 90) % 360;
                updateSize();
            },

            // printing
            async print() {
                if (!filesystem || !state.url) return;

                const win = window.open("", "_blank");
                if (!win) {
                    state.error = "Pop-up blocked.";
                    return;
                }

                let printUrl = null;
                const cleanup = () => {
                    printUrl?.dispose?.();
                    printUrl = null;
                };

                win.addEventListener("pagehide", cleanup, { once: true });
                win.addEventListener("afterprint", () => {
                    cleanup();
                    win.close();
                }, { once: true });

                try {
                    const img = win.document.createElement("img");
                    const sheet = new win.CSSStyleSheet();

                    sheet.replaceSync(`
                        @page {margin:12mm;}
                        body {margin:0; display:flex; justify-content:center;}
                        img {max-width:100%; max-height:100vh; object-fit:contain;}
                    `);

                    win.document.adoptedStyleSheets = [sheet];
                    win.document.body.appendChild(img);

                    printUrl = await filesystem.getReadUrl(state.path);

                    if (win.closed) {
                        cleanup();
                        return;
                    }

                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = () => reject(new Error("Image load failed"));
                        img.src = printUrl.url;
                    });

                    if (!win.closed) {
                        win.focus();
                        win.print();
                    }
                } catch (error) {
                    cleanup();
                    if (!win.closed) win.close();
                    state.error = error.message;
                }
            },

            unmount() {
                stopDrag();
                cancelZoomAnchor();
                resizeObserver?.disconnect();
                resizeObserver = null;
                viewport = null;
            },

            unload() {
                disposed = true;
                revision++;
                stopDrag();
                cancelZoomAnchor();
                resizeObserver?.disconnect();
                release();
            }
        };
    }
};
