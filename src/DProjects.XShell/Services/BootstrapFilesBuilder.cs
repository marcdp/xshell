using System.Net;
using System.Text.Json;

namespace DProjects.XShell.Services {

    internal sealed class BootstrapFilesBuilder {

        // methods
        internal Dictionary<string, string> Build(Extensions.Configuration config, string environment, string bootstrapPath) {
            var result = new Dictionary<string, string>();

            // scan bootstrap path for files
            foreach(var file in Directory.EnumerateFiles(bootstrapPath, "*", SearchOption.AllDirectories)) {
                var relativePath = "/" + Path.GetRelativePath(bootstrapPath, file).Replace("\\", "/");
                var content = File.ReadAllText(file);
                if (relativePath.Equals("/index.html")) {
                    content = ReplacePlaceHolders(content, config, environment);
                }
                result[relativePath] = content;
            }

            // return
            return result;
        }

        // private methods        
        private string ReplacePlaceHolders(string content, Extensions.Configuration config, string environment) {
            content = content.Replace("{config.App.Description}", EncodeAttribute(config.App.Description));
            content = content.Replace("{config.Server.ContentSecurityPolicy}", EncodeAttribute(config.Server.ContentSecurityPolicy));
            content = content.Replace("{config.App.BasePath}", EncodeAttribute(config.App.BasePath));
            content = content.Replace("{config.App.Module}", EncodeAttribute(config.App.Module));
            content = content.Replace("{config.App.Params}", string.Join("&", config.App.Params.Select(kv => Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value))));
            content = content.Replace("{environment}", EncodeAttribute(environment));
            content = content.Replace("{config.Temp.BasePath}", EncodeAttribute(config.Temp.BasePath));
            content = content.Replace("{config.App.Sources}", string.Join("\n", config.App.Sources.Select(s => $"<meta name=\"xshell:app.source\" content=\"{EncodeAttribute(s)}\">")));

            return content;
        }
        private string EncodeAttribute(string value) {
            return WebUtility.HtmlEncode(value);
        }
    }
}
