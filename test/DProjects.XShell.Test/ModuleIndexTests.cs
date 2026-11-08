using System.Text.Json;
using DProjects.XShell.Services;

namespace DProjects.XShell.Test {
    public sealed class ModuleIndexTests {
        [Theory]
        [InlineData("manifest.json")]
        [InlineData("manifest.jsonc")]
        public async Task Builder_PreservesDirectDependenciesAndHash(string fileName) {
            using var files = new Files();
            files.Write("demo/" + fileName, """
                // direct dependencies only
                { "modules": {
                    "demo": { "version": "0.9.0", "dependencies": { "xshell": "module:xshell:*", "x": "module:x:^1" } },
                    "x": { "configUrl": "url:../x/manifest.jsonc" }
                }, }
                """);

            using var index = JsonDocument.Parse(await new ModuleIndexBuilder().BuildAsync(files.PathFor("demo/" + fileName), "dev", TestContext.Current.CancellationToken));

            Assert.Equal("demo", index.RootElement.GetProperty("module").GetString());
            var generation = index.RootElement.GetProperty("versions").GetProperty("0.9.0");
            Assert.Equal("dev", generation.GetProperty("hash").GetString());
            Assert.Equal("module:xshell:*", generation.GetProperty("dependencies").GetProperty("xshell").GetString());
            Assert.Equal("module:x:^1", generation.GetProperty("dependencies").GetProperty("x").GetString());
            Assert.Equal(2, generation.GetProperty("dependencies").EnumerateObject().Count());
        }
        [Fact]
        public async Task Builder_FrameworkAndEmptyDependencies() {
            using var files = new Files();
            files.Write("xshell/manifest.jsonc", "{ \"xshell\": { \"version\": \"0.9.0\" } }");
            using var index = JsonDocument.Parse(await new ModuleIndexBuilder().BuildAsync(files.PathFor("xshell/manifest.jsonc"), "dev", TestContext.Current.CancellationToken));
            Assert.Equal("xshell", index.RootElement.GetProperty("module").GetString());
            Assert.Empty(index.RootElement.GetProperty("versions").GetProperty("0.9.0").GetProperty("dependencies").EnumerateObject());
        }
        [Fact]
        public async Task Builder_FrameworkPreservesDirectDependencies() {
            using var files = new Files();
            files.Write("xshell/manifest.json", "{ \"xshell\": { \"version\": \"1.0.0-rc.1\", \"dependencies\": { \"tools\": \"module:tools:*\" } } }");
            using var index = JsonDocument.Parse(await new ModuleIndexBuilder().BuildAsync(files.PathFor("xshell/manifest.json"), "dev", TestContext.Current.CancellationToken));
            Assert.Equal("module:tools:*", index.RootElement.GetProperty("versions").GetProperty("1.0.0-rc.1").GetProperty("dependencies").GetProperty("tools").GetString());
        }
        [Theory]
        [InlineData("{ \"modules\": { \"demo\": {} } }", "semantic version")]
        [InlineData("{ \"modules\": { \"demo\": { \"version\": \"bad\" } } }", "semantic version")]
        [InlineData("{ \"modules\": { \"demo\": { \"version\": \"0.9.0\" }, \"other\": {} } }", "exactly one")]
        [InlineData("{ \"modules\": { \"other\": { \"version\": \"0.9.0\" } } }", "directory name")]
        [InlineData("{ \"modules\": { \"demo\": { \"version\": \"0.9.0\", \"dependencies\": [] } } }", "dependencies")]
        public async Task Builder_RejectsInvalidManifest(string source, string message) {
            using var files = new Files();
            files.Write("demo/manifest.json", source);
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => new ModuleIndexBuilder().BuildAsync(files.PathFor("demo/manifest.json"), "dev", TestContext.Current.CancellationToken));
            Assert.Contains(message, exception.Message);
        }
        [Fact]
        public async Task Builder_RejectsAmbiguousFormats() {
            using var files = new Files();
            const string source = "{ \"modules\": { \"demo\": { \"version\": \"0.9.0\" } } }";
            files.Write("demo/manifest.json", source);
            files.Write("demo/manifest.jsonc", source);
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => new ModuleIndexBuilder().BuildAsync(files.PathFor("demo/manifest.json"), "dev", TestContext.Current.CancellationToken));
            Assert.Contains("both manifest.json and manifest.jsonc", exception.Message);
        }
        [Theory]
        [InlineData("x")]
        [InlineData("x-demo")]
        [InlineData("x-filesystem")]
        [InlineData("xshell-docs")]
        public async Task Builder_AcceptsCanonicalModuleIds(string id) {
            using var files = new Files();
            files.Write(id + "/manifest.jsonc", $$"""{ "modules": { "{{id}}": { "version": "0.9.0" } } }""");
            using var index = JsonDocument.Parse(await new ModuleIndexBuilder().BuildAsync(files.PathFor(id + "/manifest.jsonc"), "dev", TestContext.Current.CancellationToken));
            Assert.Equal(id, index.RootElement.GetProperty("module").GetString());
        }
        [Theory]
        [InlineData("Demo")]
        [InlineData("demo_one")]
        [InlineData("1demo")]
        [InlineData("demo--one")]
        [InlineData("demo.one")]
        [InlineData("xshell")]
        public async Task Builder_RejectsNoncanonicalLocalIds(string id) {
            using var files = new Files();
            files.Write(id + "/manifest.jsonc", $$"""{ "modules": { "{{id}}": { "version": "0.9.0" } } }""");
            await Assert.ThrowsAsync<InvalidOperationException>(() => new ModuleIndexBuilder().BuildAsync(files.PathFor(id + "/manifest.jsonc"), "dev", TestContext.Current.CancellationToken));
        }
        [Theory]
        [InlineData("Demo")]
        [InlineData("demo_one")]
        [InlineData("1demo")]
        [InlineData("demo--one")]
        public async Task Builder_RejectsNoncanonicalDependencyIds(string id) {
            using var files = new Files();
            files.Write("demo/manifest.jsonc", $$"""{ "modules": { "demo": { "version": "0.9.0", "dependencies": { "{{id}}": "module:x:*" } } } }""");
            await Assert.ThrowsAsync<InvalidOperationException>(() => new ModuleIndexBuilder().BuildAsync(files.PathFor("demo/manifest.jsonc"), "dev", TestContext.Current.CancellationToken));
        }
        private sealed class Files : IDisposable {
            public string Root { get; } = Path.Combine(Path.GetTempPath(), "DProjects.XShell.Test", Guid.NewGuid().ToString("N"));
            public string PathFor(string name) => Path.Combine(Root, name.Replace('/', Path.DirectorySeparatorChar));
            public void Write(string name, string content) {
                var path = PathFor(name);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                File.WriteAllText(path, content);
            }
            public void Dispose() { if (Directory.Exists(Root)) Directory.Delete(Root, true); }
        }
    }
}
