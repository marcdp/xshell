
// consts
const mode = document.currentScript.dataset.mode ?? "production";
const configUrl = document.currentScript.dataset.config;
const swUrl = document.currentScript.dataset.sw;
const appUrl = document.location.origin + document.location.pathname;
const appUrlDir = appUrl.substring(0, appUrl.lastIndexOf("/") + 1)  ;
const appUrlBase = appUrlDir.substring(0, appUrlDir.length - 1 - (document.location.pathname.endsWith("/") ? 1 : document.location.pathname.split("/").pop().length));
const bootstrapUrl = new URL(document.currentScript.src);
const bootstrapUrlDir = bootstrapUrl.href.substring(0, bootstrapUrl.href.lastIndexOf("/") + 1);

// utils
function stripJsonComments(s) {let o="",i=0,n=s.length;for(;i<n;){let c=s[i];if(c=='"'||c=="'"){let q=c;o+=c;i++;while(i<n){if(s[i]=="\\"){o+=s[i++]+s[i++];}else if(s[i]==q){o+=s[i++];break;}else{o+=s[i++];}}continue;}if(c=='/'&&s[i+1]=='/'){i+=2;while(i<n&&s[i]!="\n"&&s[i]!="\r")i++;continue;}if(c=='/'&&s[i+1]=='*'){i+=2;while(i<n&&!(s[i]=='*'&&s[i+1]=='/'))i++;i+=2;continue;}o+=c;i++;};return o;}
function combineUrls(a, b) {
    if (a.indexOf("?") != -1) a = a.substring(0, a.indexOf("?"));
    if (b.indexOf(":") != -1) return b;
    if (b.startsWith("/")) {
        if (a.indexOf("://") != -1) {
            let i = a.indexOf("/", a.indexOf("://") + 3);
            if (i != -1) a = a.substring(0, i);
            return a + b;
        }
        return b;
    } else if (b.startsWith("./") || b==".") {
        if (a.endsWith("/")) {
            a = a.substring(0, a.length - 1);
        } else if (a.length > 0) {
            a = a.substring(0, a.lastIndexOf("/"));
        }
        return a + b.substring(1);
    } else if (b.startsWith("../")) {
        if (a.endsWith("/")) {
            a = a.substring(0, a.length - 1);
        } else if (a.length > 0) {
            a = a.substring(0, a.lastIndexOf("/"));
        }
        let result = a + "/" + b;
        if (result.startsWith("/")) {
            const normalizedUrl = new URL(result, window.location.origin);
            result = normalizedUrl.pathname;
        } else {
            result = (new URL(result)).toString();
        }
        return result;
    } else {
        if (a.endsWith("/")) { 
            //empty
        } else if (a.indexOf("/") != -1) {
            a = a.substring(0, a.lastIndexOf("/") + 1);
        }
        return a + b;
    }
}
function normalizeUrls(key, obj, path) {
    if (typeof(obj) == "string") {
        if (obj.startsWith("url:")) {
            // url: are urls relative to internet, or origin
            obj = obj.substring(4).trim();
            if (obj.startsWith("/") || obj.startsWith("./") || obj.startsWith("../") || obj == ".") {
                obj = combineUrls(path, obj);
            }
        } else if (obj.startsWith("/")) {
            // relative to path (module root or xshell root)
            obj = path + obj;
            if (obj.startsWith(document.location.origin)) obj = obj.substring(document.location.origin.length);
        } else if (obj.startsWith("./") || obj.startsWith("../") || obj == ".") {
            // relative to path (module root or xshell root)
            obj = combineUrls(path + "/", obj);
            if (obj.startsWith(document.location.origin)) obj = obj.substring(document.location.origin.length);
        }
    } else if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = normalizeUrls(i, obj[i], path);
        }
    } else if (obj instanceof Object) {
        for (let subkey in obj) {
            obj[subkey] = normalizeUrls(subkey, obj[subkey], path);
        }
    }
    return obj;
}

// bootstrap methods
async function loadXShellConfig(config) {
    // load app config
    console.log("bootstrap: loading xshell config ...");
    const url = combineUrls(bootstrapUrlDir, "xshell/xshell.jsonc");
    const json = stripJsonComments(await (await fetch(url)).text());
    const xshellConfig = JSON.parse(json);
    normalizeUrls("", xshellConfig, "/xshell");
    for(let key in xshellConfig) {
        config[key] = xshellConfig[key];
    }
    return config;
}
async function loadAppConfig(config) {
    // load app config
    console.log("bootstrap: loading app config ...");
    const url = new URL(configUrl, document.baseURI).href;
    const json = stripJsonComments(await (await fetch(url)).text());
    const appConfig = JSON.parse(json);
    normalizeUrls("", appConfig, appUrlDir);
    for(var key in appConfig) {
        config[key] = appConfig[key];
    }
    config["app.base"] = appUrlBase;
    return config;
}
async function loadModulesConfig(config) {
    // load modules config
    let names = [];
    for(let key in config) {
        if (key.startsWith("modules.")) {
            let name = key.split(".")[1];
            if (!names.includes(name)) {
                names.push(name);
            }
        }
    }
    // load each module config
    let loadModuleTasks = [];
    for(let name of names) {
        const moduleSrc = config[`modules.${name}.src`];
        console.log("bootstrap: loading module config ...", name + " (" + moduleSrc + ")");
        loadModuleTasks.push(fetch(moduleSrc));
    }
    let results = await Promise.all(loadModuleTasks);
    // parse each module config
    for(let result of results) {
        let name = names[results.indexOf(result)];
        console.log("bootstrap: parsing module config ...", result.url);
        if (!result.ok) throw new Error(`Failed to load module: ${result.url}`);
        let json = await result.text();
        let moduleConfig = JSON.parse(stripJsonComments(json));
        // defaults
        moduleConfig[`name`] = `${name}`;
        moduleConfig[`icon`] = moduleConfig[`icon`] || "x-file";
        moduleConfig[`label`] = moduleConfig[`label`] || "";
        moduleConfig[`version`] = moduleConfig[`version`] || "";
        moduleConfig[`depends`] = moduleConfig[`depends`] || [];
        moduleConfig[`styles`] = moduleConfig[`styles`] || [];
        // normalize urls
        normalizeUrls("", moduleConfig, "/" + name);
        // merge module config into app config
        for(let key in moduleConfig) {
            let value = moduleConfig[key];
            if (key.startsWith("global.")){
                key = key.substring(key.indexOf(".")+1).replaceAll("{module}", name);
                config[key] = value.replaceAll("{module}", name);
            } else {
                config["modules." + name + "." + key] = value;
            }
        }
        // add resolvers
        config[`resolver.icon:${name}-{name}`] = `/${name}/icons/{name}.svg; handler=xshell/handler-icon; cache=true;`;
        config[`resolver.component:${name}-{name}`] = `/${name}/components/${name}-{name}.js; handler=xshell/handler-import; cache=true;`;
        config[`resolver.layout:${name}-layout-{name}`] = `/${name}/layouts/${name}-layout-{name}.js; handler=xshell/handler-import; cache=true;`;
        config[`resolver.page:/${name}/pages/{path}.html`] = `/${name}/pages/{path}.html; handler=xshell/handler-html; cache=true;`;                
        config[`resolver.module:/${name}/{path}.js`] = `/${name}/{path}.js; handler=xshell/handler-import; cache=true;`;
    }
    // log
    console.log("bootstrap: config", config);
    // return
    return config;
}
async function installServiceWorker(config) {
    console.log("bootstrap: installing service worker ...");
    const bootstrapUrlRaw = bootstrapUrl.toString();
    const realSwUrl = bootstrapUrlRaw.substring(0, bootstrapUrlRaw.lastIndexOf("/")) + "/xshell/sw.js";
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) reg.update();
        });
    }
    const reg = await navigator.serviceWorker.register(swUrl + "?" + encodeURIComponent(realSwUrl), {
        scope: document.location.pathname
    });
    await navigator.serviceWorker.ready;
    console.log("bootstrap: service worker installed");
    // creates rules to send to service worker
    let xshellVersion = config["xshell.version"];
    let rules = [];
    rules.push({ src: combineUrls(appUrl, "xshell"), dst: combineUrls(bootstrapUrlDir, "xshell"), version: xshellVersion, name:"xshell", exceptions:[combineUrls(bootstrapUrlDir, "xshell/xshell.json")]});
    for(var key in config) {
        if (key.startsWith("modules.") && key.endsWith(".src")) {
            const moduleName = key.split(".")[1];
            const moduleSrc = config[key];
            const moduleSrcDir = moduleSrc.substring(0, moduleSrc.lastIndexOf("/"));
            const moduleVersion = config[`modules.${moduleName}.version`];
            rules.push({ src: combineUrls(appUrl, moduleName), dst: moduleSrcDir, version: moduleVersion, name: moduleName, exceptions: [moduleSrc]});
        }
    }
    // send config to service worker
    reg.active.postMessage({ type: "init", payload: {
        mode: mode,
        rules: rules
    } });
    // wait for ready message from service worker
    return new Promise(resolve => {
        navigator.serviceWorker.addEventListener("message", e => {
            if (e.data?.type === "ready") {
                console.log("bootstrap: service worker ready");
                resolve();
            }
        });
    });
}
async function loadXShell() {
    console.log("bootstrap: loading xshell ...");
    return (await import("xshell")).default;
}
async function bootstrap() {
    let config = {};
    // load xshell config
    config = await loadXShellConfig(config);
    // load app config
    config = await loadAppConfig(config);
    // load modules config
    config = await loadModulesConfig(config);
    // installServiceWorker
    await installServiceWorker(config);
    // create importmap
    let imports = {};
    for (let key in config) {
        if (key.startsWith("resolver.import:")) {
            let importName = key.substring(key.indexOf(":") + 1);
            let importSrc = config[key];
            imports[importName] = (importSrc.indexOf(":")!=-1 ? importSrc : appUrlDir + importSrc.substring(1));
        }
    }
    const importMap = document.createElement("script");
    importMap.type = "importmap";
    importMap.textContent = JSON.stringify({ imports }, null, 2);
    document.head.appendChild(importMap);
    // load xshell
    let xshell = await loadXShell();
    // init xshell
    await xshell.init(config);
}

// exec bootstrap
bootstrap();

