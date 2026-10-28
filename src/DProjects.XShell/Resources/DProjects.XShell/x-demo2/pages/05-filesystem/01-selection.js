
export default {
    meta: {
        title: "File Selection",
        description: "Select a file and inspect its temporary upload reference and metadata."
    },

    template: `
        <p>The <code>file</code> datafield uploads selected files to XShell's temporary storage. Its bound value is a <code>temp:/</code> reference containing file metadata.</p>

        <h2>Select a file</h2>
        <x-datafield type="file" label="Choose a file" x-model="state.file"></x-datafield>

        <h2>File metadata</h2>
        <p x-if="!state.metadata">Select a file to display its metadata.</p>
        <x-datafields x-if="state.metadata" columns="2">
            <x-datafield label="Filename">{{ state.metadata.name }}</x-datafield>
            <x-datafield label="MIME type">{{ state.metadata.type }}</x-datafield>
            <x-datafield label="Size">
                <x-file-size x-attr:value="state.metadata.size"></x-file-size>
            </x-datafield>
            <x-datafield label="Size in bytes">{{ state.metadata.size }}</x-datafield>
            <x-datafield label="SHA-256">{{ state.metadata.hash }}</x-datafield>
            <x-datafield label="Expiration">
                <x-datetime x-attr:value="state.metadata.expiration" format="datetime"></x-datetime>
            </x-datafield>
        </x-datafields>

        <p x-if="state.metadata">
            <x-anchor x-attr:href="state.fileUrl" target="_blank">Open uploaded file</x-anchor>
        </p>

        <h2>Temporary file reference</h2>
        <p>The uploaded file is identified by a logical reference rather than a browser <code>File</code> object.</p>
        <pre x-text="state.file || 'No file selected'"></pre>

        <h2>Reading metadata</h2>
        <p>File metadata is encoded in the path and query parameters of the temporary reference.</p>
        <pre x-pre><code>const url = new URL(temp.getAbsoluteUrl(state.file));
const name = decodeURIComponent(url.pathname.split("/").pop());
const size = Number(url.searchParams.get("size"));
const type = url.searchParams.get("type");
const hash = url.searchParams.get("hash");
const expiration = Number(url.searchParams.get("expiration"));</code></pre>

        <p>The expiration value is a UTC Unix timestamp in seconds. The SHA-256 hash identifies the uploaded content; it does not establish that the file is safe or trustworthy.</p>
    `,

    state: {
        file: null,
        fileUrl: "",
        metadata: null
    },

    controller({state, events, temp}) {
        const refresh = () => {
            const reference = state.file;
            state.metadata = null;
            state.fileUrl = "";

            if (typeof reference !== "string" || !reference.startsWith("temp:/")) return;

            const url = new URL(temp.getAbsoluteUrl(reference));
            const expiration = Number(url.searchParams.get("expiration"));

            state.fileUrl = url.href;
            state.metadata = {
                name: decodeURIComponent(url.pathname.split("/").pop()),
                size: Number(url.searchParams.get("size")) || 0,
                type: url.searchParams.get("type") || "Unknown",
                hash: url.searchParams.get("hash") || "",
                expiration: expiration ? new Date(expiration * 1000).toISOString() : ""
            };
        };

        return {
            load() {
                events.on(state, "change:file", refresh);
                refresh();
            }
        };
    }
};
