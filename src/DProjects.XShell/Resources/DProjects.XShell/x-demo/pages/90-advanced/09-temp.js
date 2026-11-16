export default {
    meta: {
        title: "Temp",
        description: "Uploads local files through the Temp service and resolves their temporary identifiers."
    },

    style: `
        .picker {display:block; margin:.75em 0;}
        .uploads {display:grid; gap:1em; padding:0; list-style:none;}
        .reference {white-space:pre-wrap; overflow-wrap:anywhere;}
    `,

    template: `
        <p>The <code>temp</code> service sends local files to XShell's ASP.NET Temp middleware. Select one or several files; this Page uses the real
        <code>temp.upload()</code> implementation and does not add another upload path.</p>

        <h2>Select and upload</h2>
        <input ref="files" class="picker" type="file" multiple x-on:change="selectFiles">
        <p>Selected: {{ state.selection }}</p>
        <p><x-button label="Upload selected files" command="upload"></x-button></p>
        <x-notice x-if="state.error" type="error" label="Upload error" x-attr:message="state.error"></x-notice>
        <pre x-pre><code>const results = await temp.upload(files, progress =&gt; {
    // progress: {name, loaded, total, percent}
});

const absoluteUrl = temp.getAbsoluteUrl(results[0]);</code></pre>

        <h2>Per-file progress and results</h2>
        <p x-if="state.uploads.length == 0">Choose files to prepare the upload list.</p>
        <ul class="uploads">
            <li x-for="item in state.uploads" x-key="id">
                <strong>{{ item.name }}</strong> — {{ item.status }}
                <x-progress x-if="item.progress != null" x-prop:value="item.progress" max="100"></x-progress>
                <div x-if="item.reference">
                    <div><strong>Identifier</strong></div>
                    <pre class="reference">{{ item.reference }}</pre>
                    <x-anchor x-attr:href="item.url" target="_blank" rel="noopener noreferrer">Open absolute URL</x-anchor>
                </div>
                <x-notice x-if="item.error" type="error" label="File upload failed" x-attr:message="item.error"></x-notice>
            </li>
        </ul>

        <h2>Temporary identifiers</h2>
        <p>A successful upload returns a logical <code>temp:/</code> identifier. <code>temp.getAbsoluteUrl()</code> converts that identifier to the middleware
        URL for opening or downloading it. Upload failures are returned in the corresponding result slot with an <code>error: </code> prefix.</p>
        <p>The Temp API has no cancellation argument. If this Page unloads during an upload, the request may finish, but its progress and result callbacks
        are ignored so they cannot update stale Page state.</p>
        <p>Compare this with <x-anchor href="07-tasks.js">Tasks</x-anchor> and <x-anchor href="08-commands.js">Commands</x-anchor>. The existing
        <x-anchor href="../05-filesystem/01-selection.js">File Selection</x-anchor> Page demonstrates the higher-level file datafield.</p>
        
    `,

    state: {
        selection: "No files selected",
        uploads: [],
        error: ""
    },

    controller({temp, state}) {
        let alive = true;
        let selectedFiles = [];
        let uploadRevision = 0;

        const updateItem = (name, update) => {
            state.uploads = state.uploads.map(item => item.name === name ? {...item, ...update} : item);
        };

        return {
            selectFiles({event}) {
                selectedFiles = [...(event.currentTarget.files || [])];
                state.selection = selectedFiles.length === 0
                    ? "No files selected"
                    : selectedFiles.map(file => file.name).join(", ");
                state.error = "";
                state.uploads = selectedFiles.map((file, index) => ({
                    id: `${index}:${file.name}`,
                    name: file.name,
                    status: "Ready",
                    progress: 0,
                    reference: "",
                    url: "",
                    error: ""
                }));
            },

            async upload() {
                if (selectedFiles.length === 0) {
                    state.error = "Select at least one local file first.";
                    return;
                }

                const revision = ++uploadRevision;
                state.error = "";
                state.uploads = state.uploads.map(item => ({...item, status:"Uploading", progress:0, reference:"", url:"", error:""}));

                try {
                    const results = await temp.upload(selectedFiles, progress => {
                        if (!alive || revision !== uploadRevision) return;
                        updateItem(progress.name, {status:"Uploading", progress:Math.round(progress.percent)});
                    });
                    if (!alive || revision !== uploadRevision) return;

                    state.uploads = state.uploads.map((item, index) => {
                        const result = results[index];
                        if (typeof result !== "string") {
                            return {...item, status:"Failed", error:"The Temp service returned an invalid result."};
                        }
                        if (result.startsWith("error: ")) {
                            return {...item, status:"Failed", error:result.substring(7)};
                        }
                        return {
                            ...item,
                            status:"Uploaded",
                            progress:100,
                            reference:result,
                            url:temp.getAbsoluteUrl(result)
                        };
                    });
                } catch (error) {
                    if (!alive || revision !== uploadRevision) return;
                    state.error = error?.message || String(error);
                    state.uploads = state.uploads.map(item => ({...item, status:"Failed", error:state.error}));
                }
            },

            unload() {
                alive = false;
                uploadRevision++;
                selectedFiles = [];
            }
        };
    }
};
