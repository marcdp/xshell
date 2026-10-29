import * as PathUtils from "../utils/path.js";

// contract
export const contract = {
    description: "Upload page",
    events: {},
    properties: {
        message: { type: "string", description: "The message to display on the upload page", context:true},
        src: { type: "string", description: "The filesystem src", context:true },
        path: { type: "string", description: "The filesystem base path", context:true },
        filesPath: { type: "string", description: "The file path for the upload", context:true },
        files: { type: "array", description: "The files to upload", context:true },
        filesystem: { type: "object", description: "The filesystem instance", context:true }
    },
    methods: {}
};

// export page
export default {
    meta: {
        title: "Upload files"
    },
    style: `
        :scope x-form {
            min-width: 45em;
        }
        :scope ul {
            display:block;
            max-height: 15em;
            overflow-y:auto;
            list-style:none;
            padding:0; margin:0;
        }
    `,
    template: `
        {{state.message}}            
        <x-form>
            <x-datafields>
                <x-datafield label="Summary">
                    Path: {{state.summary.path}}<br/>
                    
                    Uploaded: {{state.summary.oks}} / {{state.summary.total}}
                    <span x-if="state.summary.filesPerSecond">
                        ({{state.summary.filesPerSecond}} files per second)
                    </span>
                    <br/>

                    Bytes: <x-file-size x-prop:value="state.summary.bytes"></x-file-size> / <x-file-size x-prop:value="state.summary.bytesTotal"></x-file-size>
                    <span x-if="state.summary.bytesPerSecond">
                        (<x-file-size x-prop:value="state.summary.bytesPerSecond"></x-file-size> per second)
                    </span>
                    <br/>                    
                </x-datafield>               

                <x-datafield label="Progress" collapsed collapsible x-if="state.tasks">
                    <ul>
                        <li x-for="(task,index) in state.tasks" x-attr:key="index">
                            <x-icon x-if="task.status == 'ok'" icon="x-check"></x-icon>
                            <x-icon x-elseif="task.status == 'error'" icon="x-error"></x-icon>
                            <x-icon x-else icon="x-file"></x-icon>
                            {{task.path}}
                            <span x-if="task.size">
                                (<x-file-size x-attr:value="task.size"></x-file-size>)
                            </span>
                        </li>
                    </ul>                    
                </x-datafield>            

                <x-progress x-if="state.tasks" x-attr:value="state.summary.bytes" x-attr:max="state.summary.bytesTotal"></x-progress>
                
            </x-datafields>
            <x-button slot="footer" label="Abort" command="onAbort" class="submit" autofocus></x-button>
        </x-form>
    `,    
    state: {
        tasks: null,
        index: 0,
        summary: {   
            path: "",         
            total: 0,
            files: 0,
            filesPerSecond: 0,
            directories: 0,
            bytes: 0,
            bytesTotal: 0,
            bytesPerSecond: 0,
            oks: 0,
            errors: 0
        }
    },
    controller({ state, page, loader }) {
        const isNativeFile = entry => typeof File !== "undefined" && entry instanceof File;
        const isFileEntry = entry => isNativeFile(entry) || entry?.isFile === true || entry?.kind === "file";
        const isDirectoryEntry = entry => entry?.isDirectory === true || entry?.kind === "directory";
        async function getFile(entry) {
            if (isNativeFile(entry)) return entry;
            if (entry?.kind === "file") return await entry.getFile();
            if (entry?.isFile === true) return await new Promise((resolve, reject) => entry.file(resolve, reject));
            throw new TypeError("Unsupported upload file input");
        }
        const getEntries = async function* (entry, basePath = "", signal) {
            signal?.throwIfAborted();
            if (!isFileEntry(entry) && !isDirectoryEntry(entry)) throw new TypeError("Unsupported upload input");
            const path = PathUtils.combine(basePath || "/", entry.name);
            yield {entry, path};
            if (entry?.kind === "directory") {
                for await (const child of entry.values()) {
                    signal?.throwIfAborted();
                    yield* getEntries(child, path, signal);
                }
            } else if (entry?.isDirectory === true) {
                const reader = entry.createReader();
                while (true) {
                    signal?.throwIfAborted();
                    const children = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                    signal?.throwIfAborted();
                    if (!children.length) break;
                    for (const child of children) yield* getEntries(child, path, signal);
                }
            }
        }
        return {
            load(){
                //load
                this.abortController = new AbortController();
            },
            async mount() {
                const signal = this.abortController.signal;
                const tasks = [];
                try {
                    // mount
                    if (state.src && state.path) {
                        state.filesystem = await loader.load("filesystem:" + state.src);
                    }
                    // expand directories and create upload tasks
                    state.summary.path= "Scanning files ...";
                    for(const entry of state.files) {
                        signal.throwIfAborted();
                        for await (const {entry: child, path} of getEntries(entry, "", signal)) {
                            signal.throwIfAborted();
                            const type = isDirectoryEntry(child) ? "directory" : "file";
                            const file = type === "file" ? await getFile(child) : null;
                            signal.throwIfAborted();
                            state.summary.bytesTotal += file?.size ?? 0;
                            const task = {
                                type,
                                entry: child,
                                file,
                                size: file?.size,
                                path: PathUtils.combine(state.path, path),
                                status: "pending"
                            }
                            tasks.push(task);
                            state.summary.total++;
                            // update progress
                            page.invalidate();
                        }
                    }
                    // set tasks
                    state.tasks = tasks;
                    signal.throwIfAborted();
                    // start processing tasks
                    this.processTasks();
                } catch (error) {
                    if (!signal.aborted) throw error;
                    state.tasks = tasks;
                    page.close(tasks.map(task => ({
                        path: task.path,
                        status: task.status,
                        error: task.error,
                    })));
                }
            },
            
            async processTasks() {
                const signal = this.abortController.signal;    
                const startTime = performance.now();
                const pathMaxLength = 80;
                try {
                    for (const task of state.tasks) {
                        signal.throwIfAborted();
                        // action
                        state.summary.path = (task.path.length > pathMaxLength ? "..." + task.path.slice(-pathMaxLength) : task.path);
                        try {
                            if (task.type === "directory") {
                                task.result = await state.filesystem.createDirectory(task.path, {signal});
                                task.size = 0;
                                state.summary.directories++;
                            } else {
                                signal.throwIfAborted();
                                task.result = await state.filesystem.saveFile(task.path, task.file, {signal});
                                state.summary.files++;
                            }
                            signal.throwIfAborted();
                            task.status = "ok";
                            state.summary.oks++;
                        } catch (error) {
                            if (signal.aborted) throw error;
                            task.status = "error";
                            task.error = error;
                            state.summary.errors++;
                        }
                        state.index++;
                        state.summary.bytesPerSecond = state.summary.bytes / ((performance.now() - startTime) / 1000);
                        state.summary.filesPerSecond = parseInt(state.summary.files / ((performance.now() - startTime) / 1000));
                        state.summary.bytes += task.size;
                        // invalidate
                        page.invalidate();
                        // scroll to the current task
                        this.scrollToTask(state.index - 1);                                               
                    }
                } catch (error) {
                    if (!signal.aborted) throw error;
                } finally {
                    const result = [];
                    for (const task of state.tasks) {
                        result.push({
                            path: task.path,
                            status: task.status,
                            error: task.error,
                        });
                    }
                    page.close(result);
                }
            },

            scrollToTask(index) {
                // scroll to the task at the given index
                const list = page.host.querySelector('ul');
                const item = list?.children[index];
                item?.scrollIntoView({block:"nearest", inline:"nearest", behavior:"instant"});
            },
            onAbort({event}) {
                // abort
                this.abortController?.abort();
            }
        };
    }
}
