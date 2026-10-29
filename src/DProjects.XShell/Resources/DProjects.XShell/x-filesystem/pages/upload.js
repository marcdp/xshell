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
        async function getFileEntrySize(entry) {
            const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
            return file.size;
        }
        const getEntries =  async function* (entry, basePath = "") {
            const path = basePath + "/" + entry.name;
            yield {entry, path};
            if (entry.isDirectory) {
                const reader = entry.createReader();
                while (true) {
                    const children = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
                    if (!children.length) break;
                    for (const child of children) yield* getEntries(child, path);
                }
            }
        }
        return {
            load(){
                //load
                this.abortController = new AbortController();
            },
            async mount() {
                // mount
                if (state.src && state.path) {
                    state.filesystem = await loader.load("filesystem:" + state.src);
                }
                // expand directories files
                state.summary.path= "Scanning files ...";
                const files = []
                for(const file of state.files) {
                    if (file.isDirectory) {
                        for await (const {entry: child, path} of getEntries(file)) {
                            files.push({entry: child, path});
                        }
                    } else {
                        files.push({entry: file, path: file.fullPath});
                    }   
                }
                // create upload tasks
                const tasks = [];
                for(const f of files) {
                    const file = (f.entry.isDirectory ? null : await new Promise((resolve, reject) => f.entry.file(resolve, reject)));
                    state.summary.bytesTotal += file?.size ?? 0;
                    const task = {
                        type: f.entry.isDirectory ? "directory" : "file",                        
                        entry: f.entry,
                        file: file,
                        size: file?.size,
                        path: PathUtils.combine(state.path, f.path),
                        status: "pending"
                    }
                    tasks.push(task);
                    state.summary.total++;                    
                    // update progress
                    page.invalidate();
                }
                // set tasks
                state.tasks = tasks;
                // start processing tasks
                this.processTasks();
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
