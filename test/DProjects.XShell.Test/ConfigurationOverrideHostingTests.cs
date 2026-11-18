using DProjects.XShell.Commands;
using Microsoft.AspNetCore.Builder;

namespace DProjects.XShell.Test {

    public sealed class ConfigurationOverrideHostingTests {

        [Theory]
        [InlineData("app.environment")]
        [InlineData("app.params.mode")]
        public async Task UseXShell_RejectsReservedAppOverridesBeforeGeneratingBootstrapHtml(string path) {
            var builder = WebApplication.CreateBuilder();
            await using var app = builder.Build();
            var config = CreateValidConfiguration(new Dictionary<string, string> { [path] = "value" });

            var exception = Assert.Throws<ArgumentException>(() => app.UseXShell(config));

            Assert.Contains($"configuration override '{path}' is reserved", exception.Message, StringComparison.Ordinal);
        }

        [Fact]
        public async Task UseXShell_AcceptsOrdinaryOverridesAtTheHostBoundary() {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Development" });
            await using var app = builder.Build();
            var config = CreateValidConfiguration(new Dictionary<string, string> { ["services.navigation.options.mode"] = "\"hash\"" });

            var exception = Record.Exception(() => app.UseXShell(config));

            Assert.Null(exception);
        }

        [Fact]
        public void ServerConfiguration_PreservesOverridesForHostBoundaryValidation() {
            var overrides = new Dictionary<string, string> { ["app.environment"] = "Development" };

            var config = new Server { Override = overrides }.BuildConfiguration();

            Assert.Same(overrides, config.Overrides);
        }

        private static Extensions.Configuration CreateValidConfiguration(Dictionary<string, string> overrides) {
            return new Extensions.Configuration {
                App = new Extensions.AppConfig { Module = "module:x-demo:0.9.0" },
                Temp = new Extensions.TempConfig { Path = Path.GetTempPath() },
                Overrides = overrides
            };
        }
    }
}
