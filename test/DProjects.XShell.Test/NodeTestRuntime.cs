using System.ComponentModel;
using System.Diagnostics;
using System.Text;

namespace DProjects.XShell.Test;

internal static class NodeTestRuntime {

    // methods
    public static Process Start(string modulePath) {
        var configuredExecutable = Environment.GetEnvironmentVariable("XSHELL_NODE_EXE");
        var executable = string.IsNullOrWhiteSpace(configuredExecutable) ? "node" : configuredExecutable;
        var startInfo = new ProcessStartInfo(executable) {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            UseShellExecute = false
        };
        startInfo.ArgumentList.Add(modulePath);
        try {
            return Process.Start(startInfo) ?? throw new InvalidOperationException($"Node.js process '{executable}' did not start.");
        } catch (Win32Exception exception) {
            throw new InvalidOperationException(
                $"Unable to start Node.js using '{executable}'. Install Node.js and add it to PATH, or set XSHELL_NODE_EXE to the Node.js executable path.",
                exception);
        }
    }
}
