using DProjects.XShell.Services.XTemplate;

namespace DProjects.XShell.Test {

    public sealed class PublicApiTests {

        // methods
        [Fact]
        public void ExportedTypes_PreserveHostAndXTemplateApisWithoutImplementationTypes() {
            var assembly = typeof(Extensions).Assembly;
            var exportedNames = assembly.GetExportedTypes().Select(GetRequiredFullName).ToHashSet(StringComparer.Ordinal);

            Assert.Null(assembly.GetType("DProjects.XShell.Services.BoostrapFilesBuilder"));

            // keep host and documented renderer extension points available to applications
            Assert.Contains(GetRequiredFullName(typeof(Extensions)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Extensions.Configuration)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Extensions.AppConfig)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Extensions.TempConfig)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Extensions.XShellConfig)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Extensions.ResourcesConfig)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Extensions.ServerConfig)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Commands.Server)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Commands.Pack)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(Assembly)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(XTemplateRenderer)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(XTemplateRendererOptions)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(IXTemplateObjectAdapter)), exportedNames);
            Assert.Contains(GetRequiredFullName(typeof(XTemplateReflectionObjectAdapter)), exportedNames);

            // keep hosting and compiler implementation details out of the exported surface
            foreach (var name in new[] {
                "DProjects.XShell.Services.BoostrapFilesBuilder",
                "DProjects.XShell.Services.BoostrapFilesBuilder",
                "DProjects.XShell.Middlewares.ResourcesMiddleware",
                "DProjects.XShell.Middlewares.TempMiddleware",
                "DProjects.XShell.Services.FilesIndexer",
                "DProjects.XShell.Services.ModuleFileCompiler",
                "DProjects.XShell.Services.ModuleFileCompilerContext",
                "DProjects.XShell.Services.ModuleFileCompilerJs",
                "DProjects.XShell.Services.ModuleFileCompilerCss",
                "DProjects.XShell.Services.ModuleFileCompilerHtml",
                "DProjects.XShell.Services.ModuleFileCompilerHtmlSfc"
            }) {
                Assert.DoesNotContain(name, exportedNames);
            }
        }

        // methods (private)
        private static string GetRequiredFullName(Type type) {
            return type.FullName ?? throw new InvalidOperationException($"Type '{type}' does not have a full name.");
        }
    }
}
