using System.Text.Json;

using DProjects.XShell.Services;

namespace DProjects.XShell.Test {
    public sealed class RepositoryIndexBuilderTests {
        [Fact]
        public async Task EmptyRepository_ProducesEmptyModules() {
            using var files = new Files();
            Directory.CreateDirectory(files.Root);

            using var index = JsonDocument.Parse(await new RepositoryIndexBuilder().BuildAsync(files.Root, TestContext.Current.CancellationToken));

            Assert.Empty(index.RootElement.GetProperty("modules").EnumerateObject());
        }
        [Fact]
        public async Task Builder_IncludesSortedModulesAndFramework() {
            using var files = new Files();
            files.Write("x-demo/manifest.jsonc", "{ \"modules\": { \"x-demo\": { \"version\": \"1.2.3\" } } }");
            files.Write("x-filesystem/manifest.json", "{ \"modules\": { \"x-filesystem\": { \"version\": \"2.1.0\" } } }");
            files.Write("xshell/manifest.jsonc", "{ \"xshell\": { \"version\": \"0.9.0\" } }");

            using var index = JsonDocument.Parse(await new RepositoryIndexBuilder().BuildAsync(files.Root, TestContext.Current.CancellationToken));
            var modules = index.RootElement.GetProperty("modules");

            Assert.Equal(["x-demo", "x-filesystem", "xshell"], modules.EnumerateObject().Select(item => item.Name));
            Assert.Equal("x-demo/index.json", modules.GetProperty("x-demo").GetProperty("url").GetString());
            Assert.Equal("1.2.3", modules.GetProperty("x-demo").GetProperty("latest").GetString());
            Assert.Equal("2.1.0", modules.GetProperty("x-filesystem").GetProperty("latest").GetString());
            Assert.Equal("0.9.0", modules.GetProperty("xshell").GetProperty("latest").GetString());
        }
        [Fact]
        public async Task PrereleaseOnlyModule_OmitsLatest() {
            using var files = new Files();
            files.Write("demo/manifest.jsonc", "{ \"modules\": { \"demo\": { \"version\": \"1.0.0-rc.1\" } } }");

            using var index = JsonDocument.Parse(await new RepositoryIndexBuilder().BuildAsync(files.Root, TestContext.Current.CancellationToken));
            var demo = index.RootElement.GetProperty("modules").GetProperty("demo");

            Assert.Equal("demo/index.json", demo.GetProperty("url").GetString());
            Assert.False(demo.TryGetProperty("latest", out _));
        }
        [Fact]
        public void CreateJson_UsesHighestStableVersion() {
            using var index = JsonDocument.Parse(RepositoryIndexBuilder.CreateJson([
                new RepositoryIndexBuilder.ModuleInfo("demo", "1.0.0-rc.1"),
                new RepositoryIndexBuilder.ModuleInfo("demo", "1.2.0"),
                new RepositoryIndexBuilder.ModuleInfo("demo", "1.10.0"),
                new RepositoryIndexBuilder.ModuleInfo("demo", "2.0.0-beta.1")
            ]));

            Assert.Equal("1.10.0", index.RootElement.GetProperty("modules").GetProperty("demo").GetProperty("latest").GetString());
        }
        [Fact]
        public async Task Builder_IgnoresDirectoriesWithoutManifestOrValidId() {
            using var files = new Files();
            Directory.CreateDirectory(files.PathFor("empty"));
            files.Write("Demo/manifest.jsonc", "{ \"modules\": { \"Demo\": { \"version\": \"1.0.0\" } } }");
            files.Write("demo/manifest.jsonc", "{ \"modules\": { \"demo\": { \"version\": \"1.0.0\" } } }");

            using var index = JsonDocument.Parse(await new RepositoryIndexBuilder().BuildAsync(files.Root, TestContext.Current.CancellationToken));

            Assert.Equal(["demo"], index.RootElement.GetProperty("modules").EnumerateObject().Select(item => item.Name));
        }
        [Theory]
        [InlineData("{ invalid", "invalid JSON")]
        [InlineData("{ \"modules\": { \"wrong\": { \"version\": \"1.0.0\" } } }", "directory name")]
        public async Task Builder_RejectsMalformedManifest(string manifest, string message) {
            using var files = new Files();
            files.Write("demo/manifest.jsonc", manifest);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new RepositoryIndexBuilder().BuildAsync(files.Root, TestContext.Current.CancellationToken));

            Assert.Contains(message, exception.Message);
        }
        [Fact]
        public async Task Builder_RejectsAmbiguousManifestFormats() {
            using var files = new Files();
            const string manifest = "{ \"modules\": { \"demo\": { \"version\": \"1.0.0\" } } }";
            files.Write("demo/manifest.json", manifest);
            files.Write("demo/manifest.jsonc", manifest);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                new RepositoryIndexBuilder().BuildAsync(files.Root, TestContext.Current.CancellationToken));

            Assert.Contains("both manifest.json and manifest.jsonc", exception.Message);
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
