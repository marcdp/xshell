using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using DProjects.XShell.Services;

namespace DProjects.XShell.Test {

    public sealed class BootstrapFilesBuilderTests {

        // methods
        [Fact]
        public void Build_AppParams_RoundTripsSpecialCharactersWithoutInjectingMarkup() {
            var parameters = new Dictionary<string, string> {
                ["a"] = "123",
                ["ampersand"] = "x&y",
                ["equals"] = "x=y",
                ["plus"] = "x+y",
                ["space"] = "x y",
                ["percent"] = "50%",
                ["quote"] = "\"quoted\"",
                ["unicode"] = "España ✓",
                ["España ✓"] = "value",
                ["a&b"] = "value",
                ["injection"] = "value\" data-injected=\"true"
            };

            var index = BuildIndex(parameters);
            var appParamsTag = GetAppParamsTag(index);
            var serializedParams = WebUtility.HtmlDecode(GetContentAttribute(appParamsTag));

            Assert.Equal(parameters, ParseUrlSearchParams(serializedParams));
            Assert.Contains("&amp;", appParamsTag);
            Assert.Equal(4, appParamsTag.Count(character => character == '\"'));
            Assert.DoesNotContain("data-injected=\"true\"", appParamsTag);
        }
        [Fact]
        public void Build_AppParams_EmptyParamsProducesEmptyContentAttribute() {
            var index = BuildIndex([]);

            Assert.Equal("", GetContentAttribute(GetAppParamsTag(index)));
        }
        [Fact]
        public async Task GeneratedIndex_ResolvesExactXShellVersion() {
            using var result = await RunGeneratedIndexAsync("module:xshell:0.9.0", """{"0.9.0":{"url":"published-old/manifest.json"},"0.9.10":{"url":"published-new/manifest.json"}}""");
            Assert.True(result.RootElement.GetProperty("ok").GetBoolean());
            var xshell = result.RootElement.GetProperty("started").GetProperty("xshell");
            Assert.Equal("0.9.0", xshell.GetProperty("version").GetString());
            Assert.False(xshell.TryGetProperty("hash", out _));
            Assert.Equal(0, xshell.GetProperty("sourceIndex").GetInt32());
            Assert.Contains("/first/xshell/published-old/", xshell.GetProperty("baseUrl").GetString());
            Assert.Contains("/first/xshell/published-old/manifest.json", xshell.GetProperty("manifestUrl").GetString());
        }
        [Fact]
        public async Task GeneratedIndex_WildcardUsesNumericStableVersionFromFirstSuitableSource() {
            using var result = await RunGeneratedIndexAsync("module:xshell:*", """{"0.9.9":{"url":"nine/manifest.json"},"0.9.10":{"url":"ten/manifest.json","dependencies":{"x":"module:x:*"}},"0.9.11-rc.1":{"url":"preview/manifest.json"},"bad":{"url":"malformed/manifest.json"}}""",
                """{"9.0.0":{"url":"later/manifest.json"}}""");
            Assert.True(result.RootElement.GetProperty("ok").GetBoolean());
            var started = result.RootElement.GetProperty("started");
            var xshell = started.GetProperty("xshell");
            Assert.Equal("0.9.10", xshell.GetProperty("version").GetString());
            Assert.False(xshell.TryGetProperty("hash", out _));
            Assert.Equal(0, xshell.GetProperty("sourceIndex").GetInt32());
            Assert.Equal("module:x:*", xshell.GetProperty("dependencies").GetProperty("x").GetString());
            var app = started.GetProperty("app");
            Assert.Equal(0, app.GetProperty("sourceIndex").GetInt32());
            Assert.Equal("1.0.0", app.GetProperty("version").GetString());
            Assert.False(app.TryGetProperty("hash", out _));
            Assert.Equal("module:xshell:*", app.GetProperty("dependencies").GetProperty("xshell").GetString());
            Assert.Contains("/first/app/app-package/", app.GetProperty("baseUrl").GetString());
            Assert.Equal(2, started.GetProperty("sources").GetArrayLength());
        }
        [Fact]
        public async Task GeneratedIndex_FallsBackToNextSource() {
            using var result = await RunGeneratedIndexAsync("module:xshell:*", """{"0.9.10-rc.1":{"url":"preview/manifest.json"}}""",
                """{"0.9.9":{"url":"fallback/manifest.json"}}""");
            Assert.True(result.RootElement.GetProperty("ok").GetBoolean());
            var xshell = result.RootElement.GetProperty("started").GetProperty("xshell");
            Assert.Equal("0.9.9", xshell.GetProperty("version").GetString());
            Assert.Equal(1, xshell.GetProperty("sourceIndex").GetInt32());
            Assert.Contains("/second/xshell/fallback/", xshell.GetProperty("baseUrl").GetString());
        }
        [Fact]
        public async Task GeneratedIndex_RejectsUnsupportedVersionExpression() {
            using var result = await RunGeneratedIndexAsync("module:xshell:^0.9", """{"0.9.0":{"url":"dev/manifest.json"}}""");
            Assert.False(result.RootElement.GetProperty("ok").GetBoolean());
            Assert.Contains("Unsupported module reference", result.RootElement.GetProperty("error").GetString());
        }
        [Theory]
        [InlineData(null)]
        [InlineData("ftp://cdn.example.test/module/manifest.json")]
        [InlineData("https://cdn.example.test/module/other.json")]
        [InlineData("package/manifest.json?cache=1")]
        [InlineData("package/manifest.json#section")]
        [InlineData("http://[invalid")]
        public async Task GeneratedIndex_RejectsMissingOrInvalidManifestUrl(string? url) {
            var versions = url == null ? """{"0.9.0":{}}""" : "{\"0.9.0\":{\"url\":" + JsonSerializer.Serialize(url) + "}}";
            using var result = await RunGeneratedIndexAsync("module:xshell:0.9.0", versions);
            Assert.False(result.RootElement.GetProperty("ok").GetBoolean());
            Assert.Contains("Cannot resolve", result.RootElement.GetProperty("error").GetString());
        }
        [Fact]
        public async Task GeneratedIndex_DoesNotFallBackToObsoletePathProperty() {
            using var result = await RunGeneratedIndexAsync("module:xshell:0.9.0", """{"0.9.0":{"path":"legacy/"}}""");

            Assert.False(result.RootElement.GetProperty("ok").GetBoolean());
            Assert.Contains("Cannot resolve", result.RootElement.GetProperty("error").GetString());
        }
        [Fact]
        public void GeneratedIndex_UsesEntryUrlForRelativeAndAbsoluteHttpsManifests() {
            var index = new BootstrapFilesBuilder().Build(new Extensions.Configuration(), "Development")["/index.js"];

            Assert.Contains("new URL(entry.url, indexUrl)", index);
            Assert.Contains("new URL(\".\", manifestUrl)", index);
            Assert.DoesNotContain("entry.hash", index);
            Assert.DoesNotContain("entry.path", index);
            var indexUrl = new Uri("https://index.example.test/xshell/index.json");
            Assert.Equal("https://index.example.test/xshell/0.9.0.dev/manifest.json", new Uri(indexUrl, "0.9.0.dev/manifest.json").ToString());
            Assert.Equal("https://cdn.example.test/xshell/0.9.0.dev/manifest.json", new Uri(indexUrl, "https://cdn.example.test/xshell/0.9.0.dev/manifest.json").ToString());
        }

        // methods (private)
        private static string BuildIndex(Dictionary<string, string> parameters) {
            return new BootstrapFilesBuilder().Build(new Extensions.Configuration {
                App = new Extensions.AppConfig { Params = parameters }
            }, "Development")["/index.html"];
        }
        private static async Task<JsonDocument> RunGeneratedIndexAsync(string xshellReference, string firstVersions, string? secondVersions = null) {
            var directory = Path.Combine(Path.GetTempPath(), "DProjects.XShell.Test", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(directory);
            try {
                File.WriteAllText(Path.Combine(directory, "package.json"), """{"type":"module"}""");
                File.WriteAllText(Path.Combine(directory, "index.mjs"), new BootstrapFilesBuilder().Build(new Extensions.Configuration(), "Development")["/index.js"]);
                var indexes = new Dictionary<string, JsonElement> {
                    ["first/app/index.json"] = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(new {
                        module = "app", versions = new Dictionary<string, object> {
                            ["1.0.0"] = new { url = "app-package/manifest.json", dependencies = new Dictionary<string, string> { ["xshell"] = xshellReference } }
                        }
                    })),
                    ["first/xshell/index.json"] = JsonSerializer.Deserialize<JsonElement>($$"""{"module":"xshell","versions":{{firstVersions}}}""")
                };
                if (secondVersions != null) indexes["second/xshell/index.json"] = JsonSerializer.Deserialize<JsonElement>($$"""{"module":"xshell","versions":{{secondVersions}}}""");
                foreach (var (source, versions) in new[] { ("first", firstVersions), ("second", secondVersions) }) {
                    if (versions == null) continue;
                    using var entries = JsonDocument.Parse(versions);
                    foreach (var entry in entries.RootElement.EnumerateObject()) {
                        if (!entry.Value.TryGetProperty("url", out var urlValue) || urlValue.GetString() is not string url) continue;
                        if (!url.EndsWith("/manifest.json") || url.StartsWith('/') || url.Contains("..", StringComparison.Ordinal) || url.IndexOfAny(['?', '#', '\\']) >= 0) continue;
                        var bootstrapDirectory = Path.Combine(directory, source, "xshell", url[..^"manifest.json".Length].Replace('/', Path.DirectorySeparatorChar));
                        Directory.CreateDirectory(bootstrapDirectory);
                        File.WriteAllText(Path.Combine(bootstrapDirectory, "bootstrap.js"), "export async function start(value) { globalThis.started = value; }");
                    }
                }
                File.WriteAllText(Path.Combine(directory, "input.json"), JsonSerializer.Serialize(new { indexes }));
                File.WriteAllText(Path.Combine(directory, "harness.mjs"), """
                    import { readFileSync } from 'node:fs';
                    const { indexes } = JSON.parse(readFileSync(new URL('./input.json', import.meta.url)));
                    const sources = ['first/{module}/index.json', 'second/{module}/index.json'];
                    globalThis.document = {
                        baseURI: new URL('./', import.meta.url).href,
                        querySelector: () => ({ content: 'module:app:1.0.0' }),
                        querySelectorAll: () => sources.map(content => ({ content }))
                    };
                    globalThis.fetch = async url => {
                        const key = new URL(url).pathname.split('/').slice(-3).join('/');
                        return { ok: key in indexes, json: async () => indexes[key] };
                    };
                    try {
                        await import('./index.mjs');
                        console.log(JSON.stringify({ ok: true, started: globalThis.started }));
                    } catch (error) {
                        console.log(JSON.stringify({ ok: false, error: String(error) }));
                    }
                    """);
                using var process = NodeTestRuntime.Start(Path.Combine(directory, "harness.mjs"));
                var output = await process.StandardOutput.ReadToEndAsync(TestContext.Current.CancellationToken);
                var error = await process.StandardError.ReadToEndAsync(TestContext.Current.CancellationToken);
                await process.WaitForExitAsync(TestContext.Current.CancellationToken);
                Assert.Equal(0, process.ExitCode);
                Assert.True(!string.IsNullOrWhiteSpace(output), error);
                return JsonDocument.Parse(output);
            } finally {
                if (Directory.Exists(directory)) Directory.Delete(directory, true);
            }
        }
        private static string GetAppParamsTag(string index) {
            return Regex.Match(index, "<meta name=\"xshell:app.params\"[^>]*>").Value;
        }
        private static string GetContentAttribute(string tag) {
            return Regex.Match(tag, "content=\"(?<value>[^\"]*)\"").Groups["value"].Value;
        }
        private static Dictionary<string, string> ParseUrlSearchParams(string serializedParams) {
            return serializedParams.Split('&', StringSplitOptions.RemoveEmptyEntries).ToDictionary(
                pair => DecodeUrlSearchParam(pair.Split('=', 2)[0]),
                pair => DecodeUrlSearchParam(pair.Split('=', 2).ElementAtOrDefault(1) ?? ""));
        }
        private static string DecodeUrlSearchParam(string value) {
            return Uri.UnescapeDataString(value.Replace("+", " "));
        }
    }
}
