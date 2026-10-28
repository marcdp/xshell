using System.Text.RegularExpressions;
using DProjects.XShell.Services.XTemplate;

namespace DProjects.XShell.Test;

public sealed class Demo2TemplatesTests {
    [Fact]
    public void AllCookbookTemplatesCompile() {
        var root = Path.Combine(AppContext.BaseDirectory, "Resources", "DProjects.XShell", "x-demo");
        Assert.True(Directory.Exists(root), $"Missing cookbook resources: {root}");
        var compiled = 0;

        foreach (var file in Directory.EnumerateFiles(root, "*.js", SearchOption.AllDirectories)) {
            var source = File.ReadAllText(file);
            var match = Regex.Match(source, "template:\\s*`([^`]*)`", RegexOptions.Singleline);
            if (!match.Success) continue;
            Compile(match.Groups[1].Value, file);
            compiled++;
        }

        foreach (var file in Directory.EnumerateFiles(root, "*.html", SearchOption.AllDirectories)) {
            var source = File.ReadAllText(file);
            var match = Regex.Match(source, "<template>(.*?)</template>", RegexOptions.Singleline);
            Assert.True(match.Success, $"Missing template in {file}");
            Compile(match.Groups[1].Value, file);
            compiled++;
        }
        Assert.True(compiled >= 50, $"Expected cookbook templates, compiled {compiled}");
    }

    private static void Compile(string template, string file) {
        try {
            new XTemplateCompiler().Compile(template);
        } catch (Exception error) {
            throw new InvalidOperationException($"X Template compilation failed for {file}", error);
        }
    }
}
