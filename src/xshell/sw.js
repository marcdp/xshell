// vars
let config = {
    mode: "",
    rules: []
};


// events
self.addEventListener("install", () => {
    console.log("sw: installing ...");
});
self.addEventListener("activate", () => {
    console.log("sw: activated");
});
self.addEventListener("message", async (event) => {
    console.log("sw: received message:", event.data);
    if (event.data.type == "init") {
        config = event.data.payload;
        for(const client of await self.clients.matchAll()) {
            client.postMessage({type: "ready"});
        }    
    }
});
self.addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});


// methods
async function handleRequest(request) {

    // if request is outside scope, just fetch
    if (!request.url.startsWith(self.registration.scope)) {
        return fetch(request, { cache: "no-store" });
    }    

    // if no rules, just fetch
    if (config.rules.length == 0) {
        return fetch(request, { cache: "no-store" });
    }

    // determine the rule to use
    let rule = null;
    for(let targetRule of config.rules) {
        if (request.url.startsWith(targetRule.src)) {
            // check exceptions
            let isException = false;
            for(let exception of targetRule.exceptions) {
                if (request.url.startsWith(exception)) {
                    isException = true;
                    break;
                }
            }
            if (isException) {
                break;
            }
            // matched rule
            rule = targetRule;
            break;
        }
    }
    if (!rule) {
        // no matching rule, just fetch
        return fetch(request, { cache: "no-store" });
    }

    // check cache
    //const cache = await caches.open(rule.src + ".v" + rule.version);
    //if (config.mode == "production") {
    //    const cached = await cache.match(request);
    //    if (cached) {
    //        return cached;
    //    }
    //}

    // url to fetch
    let url = new URL(request.url.replace(rule.src, rule.dst));

    // read commands __xshell__ 
    let commands = [];
    const keysToDelete = [];
    for (const [key, value] of url.searchParams.entries()) {
        if (key.startsWith("__xshell__")){
            let keyParts = key.split("__");
            let command = keyParts[2];
            let args = keyParts.slice(3);
            commands.push({ command, args, value });
            keysToDelete.push(key);
        }
    }
    for (const k of keysToDelete) url.searchParams.delete(k);

    // fetch the real file
    //const path = request.url.substring(rule.src.length);
    //const dstUrl = rule.dst + path;
    const response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
        mode: "same-origin",
        credentials: "same-origin",
        redirect: "manual"   // IMPORTANT: prevents redirects from rewriting module identity
    });

    // headers (remove redirect-related headers that could leak the /src/... URL)
    const headers = new Headers(response.headers);
    headers.delete("Location");
    headers.delete("Content-Location");

    // process commands __xshell__ 
    for (const cmd of commands) {
        if (cmd.command === "replace" && cmd.args.length === 1) {
            // ex: ...?__xshell__replace__XXXX=1234
            const searchValue = cmd.args[0];
            const replaceValue = cmd.value;
            let text = await response.text();
            text = text.split(searchValue).join(replaceValue);
            return new Response(text, {
                status: response.status,
                headers: headers
            });
        }
    }

    // body
    const body = response.body;

    // add to cache
    //if (config.mode == "production" && response.ok && response.type === "basic") {
    //    try {
    //        cache.put(request, response.clone());
    //    } catch (cacheErr) {
    //        console.warn("[SW] Cache error:", cacheErr);
    //    }
    //}

    // return the response
    return new Response(body, {
        status: response.status,
        headers: headers
    });
}
