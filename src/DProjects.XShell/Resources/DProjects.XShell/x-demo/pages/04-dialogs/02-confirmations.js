
export default {
    meta: {
        title: "Confirmations",
        description: "Demonstrates confirmation variants, button choices, and asynchronous results."
    },

    template: `
        <p>Use <code>dialog.confirm()</code> when the user must make a decision before an operation continues. The dialog returns the value of the button selected by the user.</p>

        <h2>Confirmation variants</h2>
        <p>The <code>variant</code> option controls which buttons appear in the dialog.</p>
        <p>
            <x-button label="Yes / No" command="confirmYesNo"></x-button>
            <x-button label="Yes / No / Cancel" command="confirmYesNoCancel"></x-button>
            <x-button label="OK / Cancel" command="confirmOkCancel"></x-button>
            <x-button label="OK" command="confirmOk"></x-button>
        </p>
        <pre x-pre><code>await dialog.confirm({
    title: "Confirmation",
    message: "Do you want to continue?",
    variant: "yesno"
});</code></pre>

        <h2>Available variants</h2>
        <p>Each variant represents a different kind of decision.</p>
        <x-datafields columns="2">
            <x-datafield label="yesno">Yes or No</x-datafield>
            <x-datafield label="yesnocancel">Yes, No, or Cancel</x-datafield>
            <x-datafield label="okcancel">OK or Cancel</x-datafield>
            <x-datafield label="ok">OK</x-datafield>
        </x-datafields>

        <h2>Confirmation options</h2>
        <p>The <code>title</code> identifies the dialog, <code>message</code> explains the decision, and <code>variant</code> defines the available buttons.</p>
        <pre x-pre><code>const result = await dialog.confirm({
    title: "Delete item",
    message: "Are you sure you want to delete this item?",
    variant: "yesnocancel"
});</code></pre>

        <h2>Asynchronous results</h2>
        <p>The <code>dialog.confirm()</code> method returns a Promise that resolves when the dialog closes. The result identifies the selected button.</p>
        <p>Last confirmation: <strong>{{ state.lastAction }}</strong></p>
        <p>Returned value: <strong>{{ state.result }}</strong></p>
        <pre x-pre><code>controller({dialog, state}) {
    return {
        async confirmDelete() {
            const result = await dialog.confirm({
                title: "Delete item",
                message: "Are you sure?",
                variant: "yesno"
            });
            state.result = result;
        }
    };
}</code></pre>

        <h2>Handling the result</h2>
        <p>Inspect the returned value before performing the requested action. A Cancel response should not be treated as confirmation.</p>
        <pre x-pre><code>const result = await dialog.confirm({
    title: "Delete item",
    message: "Delete the selected item?",
    variant: "yesnocancel"
});

if (result === "yes") {
    // Perform the operation.
}</code></pre>

        <h2>When to use confirmations</h2>
        <p>Use confirmation dialogs for decisions such as deleting data, discarding changes, or proceeding with an important operation. For informational messages that require only acknowledgment, see <x-anchor href="01-messages.js">Messages</x-anchor>.</p>
    `,

    state: {
        lastAction: "None",
        result: "No dialog opened"
    },

    controller({dialog, state}) {
        const confirm = async (variant) => {
            state.lastAction = variant;
            state.result = await dialog.confirm({
                title: "Confirmation",
                message: "Choose a button to see the returned value.",
                variant
            });
        };

        return {
            async confirmYesNo() {await confirm("yesno");},
            async confirmYesNoCancel() {await confirm("yesnocancel");},
            async confirmOkCancel() {await confirm("okcancel");},
            async confirmOk() {await confirm("ok");}
        };
    }
};
