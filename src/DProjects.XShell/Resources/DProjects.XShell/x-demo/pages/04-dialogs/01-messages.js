
export default {
    meta: {
        title: "Messages",
        description: "Demonstrates informational, success, warning, and error message dialogs."
    },

    template: `
        <p>Use <code>dialog.message()</code> to display a modal message. The Dialog service opens the message and returns a result when the user closes it.</p>

        <h2>Message types</h2>
        <p>Message dialogs support different types to communicate information, success, warnings, and errors.</p>
        <p>
            <x-button label="Information" command="showInfo"></x-button>
            <x-button label="Success" command="showSuccess"></x-button>
            <x-button label="Warning" command="showWarning"></x-button>
            <x-button label="Error" command="showError"></x-button>
        </p>
        <pre x-pre><code>await dialog.message({
    type: "success",
    title: "Saved",
    message: "The changes were saved successfully."
});</code></pre>

        <h2>Message options</h2>
        <p>The <code>type</code> controls the message appearance, <code>title</code> identifies the dialog, and <code>message</code> contains its content.</p>
        <x-datafields columns="2">
            <x-datafield label="type">info, success, warning, error</x-datafield>
            <x-datafield label="title">Dialog title</x-datafield>
            <x-datafield label="message">Message displayed to the user</x-datafield>
        </x-datafields>

        <h2>Asynchronous results</h2>
        <p>The <code>dialog.message()</code> method returns a Promise. Use <code>await</code> to continue after the dialog closes. A message dialog normally returns <code>"ok"</code>.</p>
        <p>Last message: <strong>{{ state.lastMessage }}</strong></p>
        <p>Last result: <strong>{{ state.result }}</strong></p>
        <pre x-pre><code>controller({dialog, state}) {
    return {
        async showSuccess() {
            state.result = await dialog.message({
                type: "success",
                title: "Saved",
                message: "The operation completed successfully."
            });
        }
    };
}</code></pre>

        <h2>When to use messages</h2>
        <p>Use message dialogs when the user needs to acknowledge important information. For non-blocking status updates, consider <code>x-notice</code> or the Toast service instead.</p>
        <p>When the user must make a decision, use <x-anchor href="02-confirmations.js">confirmation dialogs</x-anchor> instead.</p>
    `,

    state: {
        lastMessage: "None",
        result: "No dialog opened"
    },

    controller({dialog, state}) {
        const showMessage = async (type, title, message) => {
            state.lastMessage = title;
            state.result = await dialog.message({type, title, message});
        };

        return {
            async showInfo() {await showMessage("info", "Information", "This is an informational message.");},
            async showSuccess() {await showMessage("success", "Saved", "The operation completed successfully.");},
            async showWarning() {await showMessage("warning", "Review needed", "Check the values before continuing.");},
            async showError() {await showMessage("error", "Operation failed", "The example operation could not be completed.");}
        };
    }
};
