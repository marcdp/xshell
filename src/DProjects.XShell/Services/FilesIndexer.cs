using System.Security.Cryptography;

namespace DProjects.XShell.Services {

    internal sealed record FileIndexItem(string Path, long Size, string Hash);

    internal sealed class FilesIndexer {

        // methods
        public Task<IReadOnlyList<FileIndexItem>> CreateAsync(string path) {
            return CreateAsync(path, CancellationToken.None);
        }
        public Task<IReadOnlyList<FileIndexItem>> CreateAsync(string path, CancellationToken cancellationToken) {
            return CreateAsync(path, cancellationToken, null);
        }
        public async Task<IReadOnlyList<FileIndexItem>> CreateAsync(string path, CancellationToken cancellationToken,
            IReadOnlySet<string>? excludedPaths, bool skipLinks = false) {
            // scan
            var files = new List<FileIndexItem>();
            var entries = skipLinks
                ? Directory.EnumerateFiles(path, "*", new EnumerationOptions { RecurseSubdirectories = true, AttributesToSkip = FileAttributes.ReparsePoint })
                : Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories);
            foreach (var file in entries) {
                cancellationToken.ThrowIfCancellationRequested();
                var relativePath = "/" + Path.GetRelativePath(path, file).Replace('\\', '/');
                if ((excludedPaths?.Contains(relativePath) ?? false) || IsDescriptor(relativePath)) {
                    continue;
                }
                await using var stream = File.OpenRead(file);
                var hash = await SHA256.HashDataAsync(stream, cancellationToken);
                files.Add(new FileIndexItem(
                    relativePath,
                    new FileInfo(file).Length,
                    Convert.ToHexString(hash).ToLowerInvariant()
                ));
            }
            // sort
            files.Sort((a, b) => StringComparer.Ordinal.Compare(a.Path, b.Path));
            // return
            return files;
        }

        // methods (private)
        private static bool IsDescriptor(string path) {
            return path.Equals("/" + ManifestFileNames.Json, StringComparison.OrdinalIgnoreCase) ||
                path.Equals("/" + ManifestFileNames.Jsonc, StringComparison.OrdinalIgnoreCase);
        }
    }
}
