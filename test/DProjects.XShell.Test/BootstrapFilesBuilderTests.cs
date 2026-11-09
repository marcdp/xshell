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
            using var result = await RunGeneratedIndexAsync("module:xshell:0.9.0", """{"0.9.0":{"hash":"old","path":"published-old/"},"0.9.10":{"hash":"new","path":"published-new/"}}""");
            Assert.True(result.RootElement.GetProperty("ok").GetBoolean());
            var xshell = result.RootElement.GetProperty("started").GetProperty("xshell");
            Assert.Equal("0.9.0", xshell.GetProperty("version").GetString());
            Assert.Equal("old", xshell.GetProperty("hash").GetString());
            Assert.Equal(0, xshell.GetProperty("sourceIndex").GetInt32());
            Assert.Contains("/first/xshell/published-old/", xshell.GetProperty("baseUrl").GetString());
        }
        [Fact]
        public async Task GeneratedIndex_WildcardUsesNumericStableVersionFromFirstSuitableSource() {
            using var result = await RunGeneratedIndexAsync("module:xshell:*", """{"0.9.9":{"hash":"nine","path":"nine/"},"0.9.10":{"hash":"ten","path":"ten/","dependencies":{"x":"module:x:*"}},"0.9.11-rc.1":{"hash":"preview","path":"preview/"},"bad":{"hash":"malformed","path":"malformed/"}}""",
                """{"9.0.0":{"hash":"later-source","path":"later/"}}""");
            Assert.True(result.RootElement.GetProperty("ok").GetBoolean());
            var started = result.RootElement.GetProperty("started");
            var xshell = started.GetProperty("xshell");
            Assert.Equal("0.9.10", xshell.GetProperty("version").GetString());
            Assert.Equal("ten", xshell.GetProperty("hash").GetString());
            Assert.Equal(0, xshell.GetProperty("sourceIndex").GetInt32());
            Assert.Equal("module:x:*", xshell.GetProperty("dependencies").GetProperty("x").GetString());
            var app = started.GetProperty("app");
            Assert.Equal(0, app.GetProperty("sourceIndex").GetInt32());
            Assert.Equal("1.0.0", app.GetProperty("version").GetString());
            Assert.Equal("root", app.GetProperty("hash").GetString());
            Assert.Equal("module:xshell:*", app.GetProperty("dependencies").GetProperty("xshell").GetString());
            Assert.Contains("/first/app/app-package/", app.GetProperty("baseUrl").GetString());
            Assert.Equal(2, started.GetProperty("sources").GetArrayLength());
        }
        [Fact]
        public async Task GeneratedIndex_FallsBackToNextSource() {
            using var result = await RunGeneratedIndexAsync("module:xshell:*", """{"0.9.10-rc.1":{"hash":"preview","path":"preview/"}}""",
                """{"0.9.9":{"hash":"fallback","path":"fallback/"}}""");
            Assert.True(result.RootElement.GetProperty("ok").GetBoolean());
            var xshell = result.RootElement.GetProperty("started").GetProperty("xshell");
            Assert.Equal("0.9.9", xshell.GetProperty("version").GetString());
            Assert.Equal(1, xshell.GetProperty("sourceIndex").GetInt32());
            Assert.Contains("/second/xshell/fallback/", xshell.GetProperty("baseUrl").GetString());
        }
        [Fact]
        public async Task GeneratedIndex_RejectsUnsupportedVersionExpression() {
            using var result = await RunGeneratedIndexAsync("module:xshell:^0.9", """{"0.9.0":{"hash":"dev","path":"dev/"}}""");
            Assert.False(result.RootElement.GetProperty("ok").GetBoolean());
            Assert.Contains("Unsupported module reference", result.RootElement.GetProperty("error").GetString());
        }
        [Theory]
        [InlineData(null)]
        [InlineData("https://example.test/packages/")]
        [InlineData("../packages/")]
        [InlineData("packages/?query")]
        [InlineData("packages/#fragment")]
        [InlineData("packages")]
        public async Task GeneratedIndex_RejectsMissingOrInvalidPackagePath(string? path) {
            var pathProperty = path == null ? "" : $$",\"path\":\"{{path}}\"";
            using var result = await RunGeneratedIndexAsync("module:xshell:0.9.0", $$"""{"0.9.0":{"hash":"dev"{{pathProperty}}}}""");
            Assert.False(result.RootElement.GetProperty("ok").GetBoolean());
            Assert.Contains("Cannot resolve", result.RootElement.GetProperty("error").GetString());
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
                            ["1.0.0"] = new { hash = "root", path = "app-package/", dependencies = new Dictionary<string, string> { ["xshell"] = xshellReference } }
                        }
                    })),
                    ["first/xshell/index.json"] = JsonSerializer.Deserialize<JsonElement>($$"""{"module":"xshell","versions":{{firstVersions}}}""")
                };
                if (secondVersions != null) indexes["second/xshell/index.json"] = JsonSerializer.Deserialize<JsonElement>($$"""{"module":"xshell","versions":{{secondVersions}}}""");
                foreach (var (source, versions) in new[] { ("first", firstVersions), ("second", secondVersions) }) {
                    if (versions == null) continue;
                    using var entries = JsonDocument.Parse(versions);
                    foreach (var entry in entries.RootElement.EnumerateObject()) {
                        if (!entry.Value.TryGetProperty("hash", out var hash)) continue;
                        if (!entry.Value.TryGetProperty("path", out var pathValue) || pathValue.GetString() is not string path) continue;
                        if (!path.EndsWith('/') || path.StartsWith('/') || path.Contains("..", StringComparison.Ordinal) || path.IndexOfAny(['?', '#', '\\']) >= 0) continue;
                        var bootstrapDirectory = Path.Combine(directory, source, "xshell", path.TrimEnd('/').Replace('/', Path.DirectorySeparatorChar));
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
