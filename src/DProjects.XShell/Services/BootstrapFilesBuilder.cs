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
            var moduleSourcesJavascriptArray = string.Join(",\n", config.Sources.Select(s => $"\"{EncodeAttribute(s)}\""));

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
                const sources = [{{moduleSourcesJavascriptArray}}];
                // importScripts({JsonSerializer.Serialize(xshellBaseUrl + "/sw.js")}); 
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
