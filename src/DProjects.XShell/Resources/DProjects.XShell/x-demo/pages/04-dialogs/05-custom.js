
export default {
    meta: {
        title: "Custom Dialog",
        description: "Demonstrates custom Page dialogs, context passing, and structured results."
    },

    template: `
        <p>Use <code>dialog.open()</code> to open an ordinary XShell Page as a dialog. The parent Page can pass context to the dialog and await the result returned when it closes.</p>

        <h2>Open a custom dialog</h2>
        <p>Configure the values passed to the dialog. The child Page receives these values through its public contract.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="Context message" x-model="state.message"></x-datafield>
            <x-datafield type="text" label="Initial value" x-model="state.value"></x-datafield>
        </x-datafields>
        <p><x-button class="submit" label="Open custom dialog" command="openCustom"></x-button></p>
        <pre x-pre><code>const result = await dialog.open({
    href: "page:x-demo:/pages/04-dialogs/custom-dialog.js",
    title: "Custom dialog",
    context: {
        message: state.message,
        value: state.value
    }
});</code></pre>

        <h2>Context passing</h2>
        <p>The <code>context</code> object supplies initial values to the custom Page. The child declares the corresponding properties using <code>context:true</code>.</p>
        <pre x-pre><code>export const contract = {
    properties: {
        message: {type:"string", default:"", state:true, context:true},
        value: {type:"string", default:"", state:true, context:true}
    }
};</code></pre>

        <h2>Returning a result</h2>
        <p>The child Page calls <code>page.close(result)</code> to close the dialog and resolve the Promise returned by <code>dialog.open()</code>.</p>
        <p>Saving returns an object containing the edited value. Cancelling returns <code>null</code>.</p>
        <pre x-pre><code>controller({page, state}) {
    return {
        save() {page.close({accepted:true, value:state.value});},
        cancel() {page.close(null);}
    };
}</code></pre>

        <h2>Last result</h2>
        <p>Dialog status: <strong>{{ state.status }}</strong></p>
        <pre x-text="state.resultText"></pre>
        <pre x-pre><code>const result = await dialog.open(options);

if (result === null) {
    // The dialog was cancelled.
} else {
    // Use result.value.
}</code></pre>

        <h2>When to use custom dialogs</h2>
        <p>Use custom dialogs when predefined message, confirmation, prompt, or picker dialogs are insufficient. A custom dialog can contain its own form fields, state, and controller commands.</p>
        <p>For simpler interactions, see <x-anchor href="03-prompts.js">Prompts</x-anchor> and <x-anchor href="04-pickers.js">Pickers</x-anchor>.</p>
    `,

    state: {
        message: "Hello from the parent Page",
        value: "Ada",
        status: "Not opened",
        resultText: "No dialog result yet."
    },

    controller({dialog, state}) {
        return {
            async openCustom() {
                state.status = "Opening";
                const result = await dialog.open({
                    href: "page:x-demo:/pages/04-dialogs/custom-dialog.js",
                    title: "Custom dialog",
                    context: {message:state.message, value:state.value}
                });
                state.status = result === null ? "Cancelled" : "Saved";
                state.resultText = result === null ? "null" : JSON.stringify(result, null, 2);
            }
        };
    }
};
