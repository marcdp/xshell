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

        .editor {
            display: block;
            flex:1;
        }
    `,

    template: `
        <x-notice x-if="state.renderingError" type="error" x-prop:message="state.renderingError"></x-notice>
        <div class="editor"></div>
    `,

    state: {
        renderingError: ""
    },

    controller({events, state, dependencies, loader, host, getPage, postRender, i18n, navigation}) {
        let renderEngine = null;
        let revision = 0;
        let renderPending = false;
        let mounted = false;
        let unloaded = false;
        let valueSnapshot = null;

        return {
            cloneValue(value) {
                // Clone values so change events retain the state before an in-place mutation.
                return value === null ? null : structuredClone(value);
            },

            getContext() {
                // Build the resource context expected by the dynamic XTemplate render engine.
                getPage();
                return {
                    resourceName: null,
                    resourcePath: document.baseURI,
                    resourceDefinition: {},
                    appBasePath: "",
                    componentLazy: "",
                    i18n,
                    get navigationMode() {return navigation.mode;}
                };
            },

            getEditor() {
                // Resolve the preview host after the component template has rendered.
                return host.shadowRoot?.querySelector(".editor") ?? null;
            },

            unmountRenderer() {
                // Detach the active renderer or clear any remaining preview content.
                const current = renderEngine;
                renderEngine = null;
                renderPending = false;

                if (current) {
                    current.unmount();
                } else {
                    this.getEditor()?.replaceChildren();
                }
            },

            reportError(error) {
                // Normalize thrown values into the rendering error shown by the component.
                state.renderingError = error instanceof Error ? error.message : String(error);
            },

            fail(error) {
                // Remove the failed renderer before exposing its error.
                this.unmountRenderer();
                this.reportError(error);
            },

            invalidateRenderer() {
                // Coalesce in-place state changes into one render per animation frame.
                if (!renderEngine || renderPending) return;

                const current = renderEngine;
                renderPending = true;

                requestAnimationFrame(() => {
                    // Ignore scheduled work when the renderer has already been replaced.
                    renderPending = false;
                    if (renderEngine !== current) return;

                    try {
                        current.render();
                    } catch (error) {
                        this.fail(error);
                    }
                });
            },

            dispatchCommand(command, params) {
                // Forward commands raised by the dynamic template through the component API.
                host.dispatchEvent(new CustomEvent("command", {
                    detail: {name: command, detail: params?.event?.detail ?? null},
                    bubbles: true,
                    composed: true
                }));
            },

            notifyChange() {
                // Snapshot the mutated value, refresh the preview, and notify the parent binding.
                const oldValue = valueSnapshot;
                const newValue = state.value;
                valueSnapshot = this.cloneValue(newValue);
                this.invalidateRenderer();

                host.dispatchEvent(new CustomEvent("change", {
                    detail: {oldValue, newValue},
                    bubbles: true,
                    composed: false
                }));
            },

            load() {
                // React to value changes with either an in-place render or a complete refresh.
                events.on(state, "change:value", (event) => {
                    valueSnapshot = this.cloneValue(event.newValue);
                    if (!mounted || unloaded) return;

                    if (event.oldValue === event.newValue) {
                        this.invalidateRenderer();
                    } else {
                        this.refresh();
                    }
                });

                // Rebuild the renderer whenever the dynamic template source changes.
                events.on(state, "change:template", () => {
                    if (!mounted || unloaded) return;
                    this.refresh();
                });
            },

            mount() {
                // Queue the first refresh after the component's own XTemplate creates the editor.
                mounted = true;
                postRender("refresh");
            },

            unmount() {
                // Cancel pending refreshes and detach the renderer while the component is unmounted.
                mounted = false;
                ++revision;
                this.unmountRenderer();
            },

            unload() {
                // Permanently stop refreshes and release the renderer during component disposal.
                mounted = false;
                unloaded = true;
                ++revision;
                this.unmountRenderer();
            },

            async refresh() {
                // Ignore work requested after the controller has been unloaded.
                if (unloaded) return;

                const currentRevision = ++revision;

                // Clear the active preview immediately when either required input is empty.
                if (!state.template || state.value === null) {
                    this.unmountRenderer();
                    state.renderingError = "";
                    return;
                }

                const editor = this.getEditor();

                // Let the queued post-render refresh handle an editor that is not ready yet.
                if (!editor) return;

                let replacementStarted = false;

                try {
                    // Compile the dynamic template with the same context as a regular XTemplate.
                    const factory = dependencies.renderEngineXClient(state.template, this.getContext(), null);

                    // Load component dependencies discovered in the dynamic template.
                    if (factory.dependencies.length) {
                        await loader.load(factory.dependencies);
                    }

                    // Stop when a newer refresh supersedes dependency loading.
                    if (currentRevision !== revision) {
                        return;
                    }

                    await factory.init();

                    // Stop when a newer refresh supersedes factory initialization.
                    if (currentRevision !== revision) {
                        return;
                    }

                    // Create a renderer that forwards commands and model changes through the component.
                    const current = factory.create({
                        host: editor,
                        state: state.value,
                        handler: (command, params) => this.dispatchCommand(command, params),
                        invalidate: () => this.notifyChange()
                    });

                    // Discard stale renderers without letting them clear the shared preview host.
                    if (currentRevision !== revision) {
                        return;
                    }

                    // Replace the old preview only after its successor is ready to mount.
                    const previous = renderEngine;
                    renderEngine = current;
                    renderPending = false;
                    replacementStarted = true;

                    if (previous) previous.unmount();
                    renderEngine.mount();
                    renderEngine.render();
                    state.renderingError = "";

                } catch (error) {
                    // Preserve the current preview unless its replacement had already started.
                    if (currentRevision === revision) {
                        if (replacementStarted) {
                            this.fail(error);
                        } else {
                            this.reportError(error);
                        }
                    }
                }
            },

            validate(detail = false) {
                // Report rendering failures before inspecting validation-capable descendants.
                if (state.renderingError) {
                    return [{type: "error", label: "", message: state.renderingError}];
                }

                const editor = this.getEditor();
                if (!editor) return [];

                const errors = [];

                // Aggregate validation errors from all supported fields and assertions.
                editor.querySelectorAll("x-datafield, x-form-assert, x-schema").forEach(element => {
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
