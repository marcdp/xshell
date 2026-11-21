export default {
    meta: {
        title: "Dialog Sizes",
        description: "Demonstrates semantic dialog sizes and caller-supplied classes."
    },

    template: `
        <h2>Auto</h2>
        <p>If not size specified, dialogs automatically adjust their size based on content and viewport.</p>

        <h2>Semantic sizes</h2>
        <p>Choose a size to open a confirmation dialog.</p>
        <p>
            <x-button label="size-compact" command="confirmSize" data-size="compact"></x-button>
            <x-button label="size-narrow" command="confirmSize" data-size="narrow"></x-button>
            <x-button label="size-medium" command="confirmSize" data-size="medium"></x-button>
            <x-button label="size-wide" command="confirmSize" data-size="wide"></x-button>
            <x-button label="size-full" command="confirmSize" data-size="full"></x-button>
        </p>
        <x-code language="javascript" x-pre>await dialog.confirm({
    title: "Compact dialog",
    message: "This dialog uses size-compact.",
    variant: "ok",
    classes: ["size-compact"]
});</x-code>

        <h2>Dialog methods</h2>
        <p>Pass <code>classes</code> in the options for each method.</p>
        <p>
            <x-button label="size-compact" command="confirmSize" data-size="compact"></x-button>
            <x-button label="size-narrow" command="showMessage"></x-button>
            <x-button label="size-compact" command="showPrompt"></x-button>
            <x-button label="size-medium" command="showPicker"></x-button>
            <x-button label="size-wide" command="openCustom" data-size="size-wide"></x-button>
        </p>

        <h2>Page defaults and overrides</h2>
        <p>The custom Page declares <code>meta: { classes: ["size-medium"] }</code>.
        Pass <code>classes: ["size-compact"]</code> to override its preferred size.</p>
        <p>
            <x-button label="Page default (Medium)" command="openCustom"></x-button>
            <x-button label="Caller override (Compact)" command="openCustom" data-size="size-compact"></x-button>
        </p>

        <h2>Last result</h2>
        <pre x-text="state.resultText"></pre>
    `,

    state: {
        resultText: "No dialog result yet."
    },

    controller({dialog, state}) {
        return {
            async confirmSize({size}) {
                // Apply the size selected by the button.
                const sizeClass = "size-" + size;
                const title = size[0].toUpperCase() + size.slice(1) + " dialog";
                this.showResult(await dialog.confirm({ title, message: "This dialog uses " + sizeClass + ".", variant: "ok", classes: [sizeClass] }));
            },
            async showMessage() {
                this.showResult(await dialog.message({ title: "Message", message: "This message uses size-narrow.", classes: ["size-narrow"] }));
            },
            async showPrompt() {
                this.showResult(await dialog.prompt({ title: "Rename item", message: "Enter a new name.", value: "Untitled", classes: ["size-compact"] }));
            },
            async showPicker() {
                // Supply the radio choices and a preferred width.
                const domain = [{value:"red", label:"Red"}, {value:"blue", label:"Blue"}];
                this.showResult(await dialog.picker({ title: "Choose a color", domain, inputType: "radios", value: "red", classes: ["size-medium"] }));
            },
            async openCustom({size}) {
                // Reuse the custom Page with its required context, optionally overriding its size.
                const result = await dialog.open({
                    href: "page:x-demo:/pages/04-dialogs/custom-dialog.js",
                    title: "Custom dialog",
                    ...(size ? { classes: [size] } : {}),
                    context: { message: "Hello from the sizes demo", value: "Example" }
                });
                this.showResult(result);
            },
            showResult(result) {
                state.resultText = JSON.stringify(result, null, 2);
            }
        };
    }
};
