using System.Net;
using System.Text.Json;

namespace DProjects.XShell.Services {

    internal sealed class BootstrapFilesBuilder {

        // methods
        internal Dictionary<string, string> Build(Extensions.Configuration config, string environment) {
            var result = new Dictionary<string, string>();

            // prepare params
            var appParams = string.Join("&", config.App.Params.Select(kv => Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value)));
            var moduleSources = config.Sources.Select(s => $"<meta name=\"xshell:source\" content=\"{EncodeAttribute(s)}\">").ToArray();

            // index
            result["/index.html"] = $"""
                <!DOCTYPE html>
                <html lang="en">
                <head>

                    <!-- html -->
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta name="description" content="{EncodeAttribute(config.App.Description)}">
                    <meta http-equiv="Content-Security-Policy" content="{EncodeAttribute(config.Server.ContentSecurityPolicy)}">

                    <!-- XShell application -->
                    <meta name="xshell:app.basePath"       content="{EncodeAttribute(config.App.BasePath)}">
                    <meta name="xshell:app.module"         content="{EncodeAttribute(config.App.Module)}">
                    <meta name="xshell:app.params"         content="{EncodeAttribute(appParams)}">

                    <!-- XShell environment -->
                    <meta name="xshell:xshell.environment" content="{EncodeAttribute(environment)}">
                    <meta name="xshell:xshell.temp.url"    content="{EncodeAttribute(config.Temp.BasePath)}">

                    <!-- XShell module package sources -->
                    {string.Join("\n", moduleSources)}
                        
                    <!-- index -->
                    <script type="module" src="{EncodeAttribute(config.App.BasePath + "/index.js")}" ></script>

                </head>
                <body>
                </body>
                </html>
                """;

            // sw.js
            result["/sw.js"] = $$"""
                // Service Worker entry point
                // importScripts({JsonSerializer.Serialize(xshellBaseUrl + "/sw.js")}); 
                """;

            // index.js
            result["/index.js"] = $$"""
                // App entry point
                const meta = name => document.querySelector(`meta[name="${name}"]`)?.content;
                const sources = [...document.querySelectorAll('meta[name="xshell:source"]')].map(e => e.content);
                const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
                const compareVersions = (left, right) => {
                    const a = left.match(stableVersion).slice(1).map(BigInt);
                    const b = right.match(stableVersion).slice(1).map(BigInt);
                    for (let i = 0; i < 3; i++) {
                        if (a[i] !== b[i]) return a[i] > b[i] ? -1 : 1;
                    }
                    return 0;
                };
                function resolvePackageBaseUrl(path, indexUrl) {
                    // validate the package-relative directory supplied by the repository index
                    if (typeof path !== "string" || !path.endsWith("/") || path.startsWith("/") || path.includes("\\") || /[?#]/.test(path)) {
                        throw new Error("Module index entry path must be a relative directory path ending in '/'.");
                    }
                    for (const segment of path.split("/")) {
                        let decoded;
                        try {
                            decoded = decodeURIComponent(segment);
                        } catch {
                            throw new Error("Module index entry path contains invalid percent-encoding.");
                        }
                        if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
                            throw new Error("Module index entry path must not contain traversal.");
                        }
                    }

                    // ensure URL resolution remains within the originating repository index directory
                    const indexDirectoryUrl = new URL("./", indexUrl);
                    const baseUrl = new URL(path, indexUrl);
                    if (baseUrl.origin !== indexDirectoryUrl.origin || !baseUrl.href.startsWith(indexDirectoryUrl.href)) {
                        throw new Error("Module index entry path must resolve within the index directory.");
                    }
                    return baseUrl.href;
                }
                async function resolve(reference) {
                    const match = /^module:([a-z][a-z0-9]*(?:-[a-z0-9]+)*):(.+)$/.exec(reference ?? "");
                    if (!match || (match[2] !== "*" && !stableVersion.test(match[2]))) {
                        throw new Error(`Unsupported module reference (expected an exact version or *): ${reference}`);
                    }

                    const [, name, requestedVersion] = match;

                    for (const [sourceIndex, source] of sources.entries()) {
                        try {
                            const indexUrl = new URL(source.replace("{module}", name), document.baseURI);
                            const response = await fetch(indexUrl);
                            if (!response.ok) continue;

                            const index = await response.json();
                            if (index.module !== name) continue;

                            const version = requestedVersion === "*"
                                ? Object.keys(index.versions ?? {}).filter(value => stableVersion.test(value) && index.versions[value]?.hash).sort(compareVersions)[0]
                                : requestedVersion;
                            const entry = version && index.versions?.[version];
                            if (!entry?.hash || !entry?.path) continue;

                            return {
                                name, version, hash: entry.hash, sourceIndex,
                                dependencies: entry.dependencies ?? {},
                                baseUrl: resolvePackageBaseUrl(entry.path, indexUrl)
                            };
                        } catch (error) {
                            console.warn(`Source unavailable: ${source}`, error);
                        }
                    }

                    throw new Error(`Cannot resolve ${reference}`);
                }

                const app = await resolve(meta("xshell:app.module"));
                const xshellRef = app.dependencies.xshell;
                if (!xshellRef) throw new Error(`Module '${app.name}' must depend on xshell.`);

                const xshell = await resolve(xshellRef);
                const bootstrap = await import(new URL("bootstrap.js", xshell.baseUrl).href);

                await bootstrap.start({ app, xshell, sources });

                """;

            // return
            return result;
        }

        // private methods
        private static string EncodeAttribute(string value) {
            return WebUtility.HtmlEncode(value);
        }
    }
}
