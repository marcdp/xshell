// vars
let config = {
    mode: "",
    rules: []
};


// events
self.addEventListener("install", () => {
    console.log("sw: installing ...");
    self.skipWaiting(); // to remove in production
});
self.addEventListener("activate", (event) => {
    console.log("sw: activated");
    event.waitUntil(clients.claim()); // to remove in production
});
self.addEventListener("message", event => {
    console.log("sw: received message:", event.data);
    if (event.data.type == "init") {
        config = event.data.payload;
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
                    return;
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
        debugger;
        console.log("[SW] No matching rule for ------------------------------------  ", request.url);
        return fetch(request, { cache: "no-store" });
    }
    // check cache
    const cache = await caches.open(rule.src + ".v" + rule.version);
    if (config.mode == "production") {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
    }

    // fetch remote resource
    var path = request.url.substring(rule.src.length);
    var dstUrl = rule.dst + path;
    //debugger;
    let response = await fetch(dstUrl, { cache: "no-store" });

    // add to cache
    if (config.mode == "production" && response.ok && response.type === "basic") {
        try {
            cache.put(request, response.clone());
        } catch (cacheErr) {
            console.warn("[SW] Cache error:", cacheErr);
        }
    }
    
    // return response
    return response;
}
