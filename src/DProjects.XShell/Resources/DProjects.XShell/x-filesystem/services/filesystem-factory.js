import FilesystemMem from '../js/filesystem-mem.js'

export default class {

    // ctor
    constructor() {
    }

    // methods
    create(url) {
        // create a filesystem instance based on the provided URL
        debugger;
        if (url == "mem:") return new FilesystemMem();
        throw new Error(`Unsupported filesystem URL: ${url}`)
    }

}