// contract
export const contract = {
    description: "Renders a dynamic XTemplate using an object as its state.",
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
        value: {type: "object", default: null, state: true, description: "The object used as the XTemplate state."}
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
    slots: {}
};


// implementation
export default {
    dependencies: {
        renderEngineXClient: "render-engine:x-client"
    },

    style: `
        :host {
            display: block;
        }

        .editor {
            display: block;
        }
    `,

    template: `
        <x-notice x-if="state.renderingError" type="error" x-prop:message="state.renderingError"></x-notice>
        <div class="editor"></div>
    `,

    state: {
        renderingError: ""
    },

    controller({events, state, dependencies, loader, host, getPage, commands}) {
        let renderEngine = null;
        let revision = 0;
        let renderPending = false;

        const getContext = () => {
            const page = getPage();

            if (page?.context) {
                return page.context;
            }

            // Fallback for an x-template used outside an x-page.
            return {
                resourceName: null,
                resourcePath: document.baseURI,
                resourceDefinition: {},
                appBasePath: "",
                navigationMode: "path",
                componentLazy: ""
            };
        };

        const getEditor = () => {
            return host.shadowRoot?.querySelector(".editor") ?? null;
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

        const fail = (error) => {
            unmountRenderer();
            state.renderingError = error instanceof Error ? error.message : String(error);
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
                    if (event.oldValue === event.newValue) {
                        invalidateRenderer();
                    } else {
                        this.refresh();
                    }
                });

                events.on(state, "change:template", () => {
                    this.refresh();
                });
            },

            mount() {
                // The component's own XTemplate has not rendered yet when
                // mount() is called. Run refresh after the first outer render.
                commands.enqueue("refresh");
            },

            unmount() {
                ++revision;
                unmountRenderer();
            },

            unload() {
                ++revision;
                unmountRenderer();
            },

            async refresh() {
                const currentRevision = ++revision;

                unmountRenderer();
                state.renderingError = "";

                if (!state.template || state.value === null) {
                    return;
                }

                const editor = getEditor();

                // The initial refresh can happen before the component's own
                // template has produced the .editor element. mount() queues
                // another refresh after that first render.
                if (!editor) {
                    return;
                }

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

                    const current = factory.create({
                        host: editor,
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

                    if (currentRevision !== revision) {
                        current.unmount();
                        return;
                    }

                    renderEngine = current;
                    renderEngine.mount();
                    renderEngine.render();

                } catch (error) {
                    if (currentRevision === revision) {
                        fail(error);
                    }
                }
            },
            validate(detail = false) {
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