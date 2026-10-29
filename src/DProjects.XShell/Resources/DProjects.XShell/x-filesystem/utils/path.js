
export const PATH_INVALID_CHARS = [":", "*", "?", "<", ">", "|", "\""];
export const PATH_NAME_INVALID_CHARS = [...PATH_INVALID_CHARS, "/", "\\"];

export function combine(path, ...names) {
    for (let name of names) {
        if ((path === "" || path === "/") && name.startsWith("/")) {
            path = name;
        } else {
            if (name === "/") name = "";
            if (!path.endsWith("/")) path += "/";
            if (name.startsWith("/")) name = name.slice(1);
            if (path !== "/" && name === "" && path.endsWith("/")) path = path.slice(0, -1);
            path += name;
            if (path.includes("..")) {
                const tokens = path.split("/");
                let i = 0;
                while (i < tokens.length) {
                    if (tokens[i] === "..") {
                        tokens.splice(i, 1);
                        if (i > 0) {
                            if (tokens[i - 1] !== "..") tokens.splice(i - 1, 1);
                            i--;
                        }
                    } else if (tokens[i] === ".") {
                        tokens.splice(i, 1);
                    } else {
                        i++;
                    }
                }
                path = tokens.join("/") || "/";
            }
        }
        while (path.includes("/./")) path = path.replaceAll("/./", "/");
        while (path.endsWith("/.") && path.length > 2) path = path.slice(0, -2);
        if (path === "/.") path = "/";
    }
    return path;
}

export function normalize(path) { return combine(path, ""); }
export function normalizeIfRequired(path) { return path.includes("/.") ? normalize(path) : path; }

export function normalizeStrict(path) {
    if (typeof path !== "string" || !path.trim()) throw new TypeError("Path cannot be null, empty, or whitespace.");
    if (!path.startsWith("/")) throw new TypeError("Path must be absolute.");
    if (path.includes("\\")) throw new TypeError("Path cannot contain '\\'.");
    if (path.includes("//")) throw new TypeError("Path cannot contain empty segments.");
    const value = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
    if (value !== "/" && value.slice(1).split("/").some(s => !s || s === "." || s === "..")) throw new TypeError("Path cannot contain empty, '.' or '..' segments.");
    return normalize(path);
}

export function validateSegment(segment) {
    if (segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\")) throw new TypeError(`'${segment}' is not a valid virtual path segment.`);
}

export function isWithin(path, parentPath) {
    const p = normalizeStrict(path), parent = normalizeStrict(parentPath);
    return parent === "/" || p === parent || p.startsWith(parent + "/");
}

export function uncombine(prefix, path, ignoreCase = false) {
    if (prefix !== "/" && (ignoreCase ? path.toLowerCase().startsWith(prefix.toLowerCase()) : path.startsWith(prefix))) return path.slice(prefix.length) || "/";
    return path;
}

export function create(pwd, path) { return path.startsWith("/") ? path : combine(pwd, path); }

export function getPathParent(path) {
    path = normalizeIfRequired(path);
    const i = path.lastIndexOf("/");
    return i < 0 ? "" : path.slice(0, i) || "/";
}

export function getPathGrandParent(path) { return getPathParent(getPathParent(path)); }

export function getPathAncestor(path, levels) {
    for (let i = 0; i < levels; i++) path = getPathParent(path);
    return path;
}

export function getPathExtension(path) {
    path = normalizeIfRequired(path);
    const i = path.lastIndexOf(".");
    if (i < 0) return "";
    const extension = path.slice(i);
    return extension.includes("/") ? "" : extension;
}

export function getPathName(path) {
    path = normalizeIfRequired(path);
    return path.slice(path.lastIndexOf("/") + 1);
}

export function getPathNameWithoutExtension(path) {
    const name = getPathName(path), i = name.lastIndexOf(".");
    return i < 0 ? name : name.slice(0, i);
}

export function getPathFirstName(path) {
    path = normalizeIfRequired(path);
    if (path.startsWith("/")) path = path.slice(1);
    const i = path.indexOf("/");
    return i < 0 ? path : path.slice(0, i);
}

export function getPathPartsCount(path) {
    path = normalizeIfRequired(path);
    return path === "/" ? 0 : path.split("/").length - 1;
}

export function getPathCuttedByLevel(path, level) {
    const parts = normalizeIfRequired(path).split("/");
    return parts.slice(0, Math.max(1, level + 1)).join("/");
}

export function getPathCuttedFromLevel(path, level) {
    const parts = normalizeIfRequired(path).split("/");
    const result = parts.slice(level + 1);
    return result.length ? "/" + result.join("/") : "/";
}

export function getPathInvalidCharsReplaced(path) { return path.replace(/[\\:*?<>|"]/g, "_"); }
export function getPathInvalidCharsReplacedStrong(path) { return path.replace(/[\\:*?<>|",/]/g, ""); }
export function getPathInvalidCharsReplacedStrongStrong(path) { return path.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase() || "_"; }

export function validate(path) {
    if (path == null) throw new TypeError("Path cannot be null.");
    if (typeof path !== "string" || !path.startsWith("/") || (path.length > 1 && path.endsWith("/"))) throw new TypeError("Path is not valid: " + path);
    for (let i = 0; i < path.length; i++) {
        const c = path[i], code = path.charCodeAt(i);
        if (code < 32 || PATH_INVALID_CHARS.includes(c)) throw new TypeError(`Invalid character '0x${code.toString(16)}' in path '${path}', position ${i}`);
    }
}
export function validateName(name) {
    if (name == null) throw new TypeError("Name cannot be null.");
    if (typeof name !== "string" || name.length === 0) throw new TypeError("Name is not valid: " + name);
    for (let i = 0; i < name.length; i++) {
        const c = name[i], code = name.charCodeAt(i);
        if (code < 32 || PATH_NAME_INVALID_CHARS.includes(c)) throw new TypeError(`Invalid character '0x${code.toString(16)}' in name '${name}', position ${i}`);
    }
}

export function getPathURLEncoded(path) {
    let result = path.split("/").filter(Boolean).map(p => "/" + encodeURI(p).replace(/#/g, "%23").replace(/\[/g, "%5B").replace(/\]/g, "%5D")).join("") || "/";
    if (path.length > 1 && path.endsWith("/") && !result.endsWith("/")) result += "/";
    return result;
}

export function compareName(nameA, nameB) { return nameA < nameB ? -1 : nameA > nameB ? 1 : 0; }

export function comparePath(pathA, pathB) {
    pathA = normalizeIfRequired(pathA);
    pathB = normalizeIfRequired(pathB);
    if (getPathParent(pathA) === getPathParent(pathB)) return compareName(getPathName(pathA), getPathName(pathB));
    const a = pathA.split("/"), b = pathB.split("/");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const result = compareName(a[i] ?? "", b[i] ?? "");
        if (result) return result;
    }
    return 0;
}
