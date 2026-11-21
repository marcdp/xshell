// component
export default {
    contract: {
        description: "Renders a dynamic XTemplate using an object as its state.",
        tags: ["content", "x-template", "rendering"],
        events: {
            change: {
                description: "Raised when the rendered XTemplate changes the value.",
                detail: {
                    oldValue: {type: "any"},
                    newValue: {type: "any"}
                }
            },
            command: {
                description: "Raised when the dynamic XTemplate invokes a command.",
                detail: {
                    name: {type: "string"},
                    detail: {type: "any"}
                }
            }
        },    
        properties: {
            template: {type: "string", default: "", state: true, attribute: true, description: "The raw XTemplate string."},
            value: {type: "object", default: null, state: true, attribute:true, attributeParser: "json", description: "The object used as the XTemplate state."}
        },
        methods: {
            validate: {
                description: "Validates fields and assertions rendered by the dynamic XTemplate.",
                parameters: [
                    {name: "detail", type: "boolean", description: "Whether to include validation paths."}
                ],
                returns: {
                    description: "Validation errors found in the rendered template.",
                    type: "array"
                }
            }
        },
        slots: {},
        examples: [
            {
                name: "basic",
                description: "Render an XTemplate string using the supplied object as its state.",
                state: {summaryTemplate: "<p>Project: {{ state.name }}</p>",project: {name: "Launch"}},
                template: `<x-template x-prop:template="state.summaryTemplate" x-prop:value="state.project"></x-template>`
            },
            {
                name: "edit-value",
                description: "Bind an editable dynamic XTemplate to the containing Page's state.",
                state: {fieldTemplate: "<x-datafield type=\"text\" label=\"Project\" x-model=\"state.name\"></x-datafield>",project: {name: "Launch"}},
                template: `<x-template x-prop:template="state.fieldTemplate" x-model="state.project"></x-template>`
            }
        ]
    },
    dependencies: {
        renderEngineXClient: "render-engine:x-client"
    },

    style: `
        :host {
            display: block;
            flex:1;
        }

        .editor-stack {
            position: relative;
            display: block;
            flex:1;
            min-width:0;
            min-height:0;
        }

        .editor {
            display: block;
            flex:1;
            min-width:0;
            min-height:0;
        }
    `,

    template: `
        <x-notice x-if="state.renderingError" type="error" x-prop:message="state.renderingError"></x-notice>
        <div class="editor-stack">
            <div class="editor"></div>
            <div class="editor"></div>
        </div>
    `,

    state: {
        renderingError: ""
    },

    controller({events, state, dependencies, loader, host, getPage, postRender, services}) {
        const doubleBufferingEnabled = true;
        let renderEngine = null;
        let preparingRenderEngine = null;
        let activeEditor = null;
        let bufferEditor = null;
        let revision = 0;
        let renderPending = false;
        let mounted = false;
        let unloaded = false;

        const getContext = () => {
            const page = getPage();
            return {
                resourceName: null,
                resourcePath: document.baseURI,
                resourceDefinition: {},
                appBasePath: "",
                componentLazy: "",
                services: services
            };
        };

        const setEditorActive = (editor, active) => {
            // Keep the staging editor connected and laid out while preventing visibility and interaction.
            editor.style.position = active ? "" : "absolute";
            editor.style.inset = active ? "" : "0";
            editor.style.visibility = active ? "" : "hidden";
            editor.style.pointerEvents = active ? "" : "none";
            editor.inert = !active;

            if (active) {
                editor.removeAttribute("aria-hidden");
            } else {
                editor.setAttribute("aria-hidden", "true");
            }
        };

        const initializeEditors = () => {
            // Resolve the rendered hosts once and assign their initial active and staging roles.
            if (activeEditor) return;
            activeEditor = host.shadowRoot?.querySelector(".editor") ?? null;
            if (!activeEditor || !doubleBufferingEnabled || typeof host.shadowRoot?.querySelectorAll !== "function") return;

            bufferEditor = [...host.shadowRoot.querySelectorAll(".editor")].find(editor => editor !== activeEditor) ?? null;
            if (!bufferEditor) return;

            setEditorActive(activeEditor, true);
            setEditorActive(bufferEditor, false);
        };

        const getEditor = () => {
            initializeEditors();
            return activeEditor;
        };

        const getBufferEditor = () => {
            initializeEditors();
            return bufferEditor;
        };

        const unmountRenderer = () => {
            const current = renderEngine;
            renderEngine = null;
            renderPending = false;

            if (current) {
                current.unmount();
            } else {
                getEditor()?.replaceChildren();
            }
        };

        const unmountPreparingRenderer = () => {
            // Dispose only the inactive host so cancellation cannot clear the visible preview.
            const current = preparingRenderEngine;
            preparingRenderEngine = null;

            if (current) {
                current.unmount();
            } else {
                getBufferEditor()?.replaceChildren();
            }
        };

        const waitForRenderFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

        const reportError = (error) => {
            state.renderingError = error instanceof Error ? error.message : String(error);
        };

        const fail = (error) => {
            unmountRenderer();
            reportError(error);
        };

        const invalidateRenderer = () => {
            if (!renderEngine || renderPending) {
                return;
            }

            const current = renderEngine;
            renderPending = true;

            requestAnimationFrame(() => {
                renderPending = false;

                if (renderEngine !== current) {
                    return;
                }

                try {
                    current.render();
                } catch (error) {
                    fail(error);
                }
            });
        };

        let valueSnapshot = null;
        const cloneValue = value => value === null ? null : structuredClone(value);

        return {
            load() {
                events.on(state, "change:value", (event) => {
                    valueSnapshot = cloneValue(event.newValue);
                    if (!mounted || unloaded) return;

                    if (event.oldValue === event.newValue) {
                        invalidateRenderer();
                    } else {
                        this.refresh();
                    }
                });
                events.on(state, "change:template", () => {
                    if (!mounted || unloaded) return;
                    this.refresh();
                });
            },

            mount() {
                mounted = true;

                // The component's own XTemplate has not rendered yet when
                // mount() is called. Run refresh after the first outer render.
                postRender("refresh");
            },

            unmount() {
                mounted = false;
                ++revision;
                unmountPreparingRenderer();
                unmountRenderer();
                activeEditor = null;
                bufferEditor = null;
            },

            unload() {
                mounted = false;
                unloaded = true;
                ++revision;
                unmountPreparingRenderer();
                unmountRenderer();
                activeEditor = null;
                bufferEditor = null;
            },

            async refresh() {
                if (unloaded) return;

                const currentRevision = ++revision;
                unmountPreparingRenderer();

                // Empty input intentionally clears the active preview immediately.
                if (!state.template || state.value === null) {
                    unmountRenderer();
                    state.renderingError = "";
                    return;
                }

                const editor = getEditor();

                // The initial refresh can happen before the component's own
                // template has produced the .editor element. mount() queues
                // another refresh after that first render.
                if (!editor) {
                    return;
                }

                const stagingEditor = getBufferEditor();
                const useDoubleBuffering = doubleBufferingEnabled && renderEngine !== null && stagingEditor !== null && stagingEditor !== editor;
                const replacementEditor = useDoubleBuffering ? stagingEditor : editor;
                let replacement = null;
                let replacementStarted = false;

                try {
                    const factory = dependencies.renderEngineXClient(
                        state.template,
                        getContext(),
                        null
                    );

                    // x-client discovers component dependencies from the
                    // dynamic template, exactly like a normal XTemplate.
                    if (factory.dependencies.length) {
                        await loader.load(factory.dependencies);
                    }

                    if (currentRevision !== revision) {
                        return;
                    }

                    await factory.init();

                    if (currentRevision !== revision) {
                        return;
                    }

                    replacement = factory.create({
                        host: replacementEditor,
                        state: state.value,

                        // Command routing for embedded x-on:* can be decided as
                        // part of the public x-template API later.
                        handler(command, params) {
                            host.dispatchEvent(new CustomEvent("command", {
                                detail: {
                                    name: command,
                                    detail: params?.event?.detail ?? null
                                },
                                bubbles: true,
                                composed: true
                            }));
                        },

                        invalidate: () => {
                            const oldValue = valueSnapshot;
                            const newValue = state.value;

                            valueSnapshot = cloneValue(newValue);

                            invalidateRenderer();

                            host.dispatchEvent(new CustomEvent("change", {
                                detail: {
                                    oldValue,
                                    newValue
                                },
                                bubbles: true,
                                composed: false
                            }));
                        }
                    });

                    // A stale, unmounted shared-host renderer must not clear the visible preview during disposal.
                    if (currentRevision !== revision) {
                        return;
                    }

                    if (useDoubleBuffering) {
                        // Warm the replacement while hidden, then give nested Components two render frames to settle.
                        preparingRenderEngine = replacement;
                        replacement.mount();
                        replacement.render();

                        await waitForRenderFrame();
                        if (currentRevision !== revision || preparingRenderEngine !== replacement) {
                            if (preparingRenderEngine === replacement) unmountPreparingRenderer();
                            return;
                        }

                        replacement.render();
                        await waitForRenderFrame();
                        if (currentRevision !== revision || preparingRenderEngine !== replacement) {
                            if (preparingRenderEngine === replacement) unmountPreparingRenderer();
                            return;
                        }

                        // Reveal the prepared host before retiring the previous renderer and recycling its host.
                        const previous = renderEngine;
                        const previousEditor = activeEditor;
                        preparingRenderEngine = null;
                        renderEngine = replacement;
                        renderPending = false;
                        replacementStarted = true;

                        setEditorActive(replacementEditor, true);
                        setEditorActive(previousEditor, false);
                        activeEditor = replacementEditor;
                        bufferEditor = previousEditor;

                        if (previous) previous.unmount();
                        state.renderingError = "";
                        return;
                    }

                    // Commit synchronously so the old preview is removed only when its replacement is ready.
                    const previous = renderEngine;
                    renderEngine = replacement;
                    renderPending = false;
                    replacementStarted = true;

                    if (previous) previous.unmount();
                    renderEngine.mount();
                    renderEngine.render();
                    state.renderingError = "";

                } catch (error) {
                    if (preparingRenderEngine === replacement) {
                        try {
                            unmountPreparingRenderer();
                        } catch {
                            // Preserve the preparation failure as the reported error.
                        }
                    }

                    if (currentRevision === revision) {
                        if (replacementStarted) {
                            fail(error);
                        } else {
                            reportError(error);
                        }
                    }
                }
            },
            validate(detail = false) {
                if (state.renderingError) {
                    return [{type: "error", label: "", message: state.renderingError}];
                }

                const editor = getEditor();
                if (!editor) return [];

                const errors = [];

                editor.querySelectorAll("x-datafield, x-form-assert").forEach(element => {
                    if (typeof element.validate !== "function") return;

                    for (const error of element.validate(detail)) {
                        errors.push(error);
                    }
                });

                return errors;
            }
        };
    }
};
