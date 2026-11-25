$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$iconPaths = @(git -C $repositoryRoot ls-files --cached --others --exclude-standard -- "src/DProjects.XShell/**/icons/*.svg")
$failures = [System.Collections.Generic.List[string]]::new()

foreach ($iconPath in $iconPaths) {
    $absolutePath = Join-Path $repositoryRoot $iconPath
    $text = Get-Content -LiteralPath $absolutePath -Raw
    try { [xml]$document = $text } catch { $failures.Add("$iconPath is not valid XML: $($_.Exception.Message)"); continue }
    $root = $document.DocumentElement
    if ($root.LocalName -ne "svg") { $failures.Add("$iconPath does not have an svg root element") }
    if ($root.GetAttribute("viewBox") -notmatch "^\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s*$") { $failures.Add("$iconPath has an invalid viewBox") }
    if ($text -match "<style(?:\s|>)" -or $text -match "\sstyle\s*=") { $failures.Add("$iconPath contains inline CSS") }
    if ($text -match "<script(?:\s|>)" -or $text -match "\son[a-z]+\s*=") { $failures.Add("$iconPath contains executable content") }
    if ($text -match "\b(?:href|xlink:href)\s*=" -or $text -match "url\s*\(") { $failures.Add("$iconPath contains a resource reference") }
    if ($root.ChildNodes.Count -eq 0 -and (Split-Path -Leaf $iconPath) -ne "x-empty.svg") { $failures.Add("$iconPath has no geometry") }
}

$originalPaths = @(git -C $repositoryRoot ls-tree -r --name-only main -- "src/DProjects.XShell" | Where-Object { $_ -match "/icons/[^/]+\.svg$" })
$missingOriginalPaths = @($originalPaths | Where-Object { $_ -notin $iconPaths })
if ($missingOriginalPaths) { $failures.Add("Original icon files are missing: $($missingOriginalPaths -join ', ')") }

$resourceText = Get-ChildItem -LiteralPath (Join-Path $repositoryRoot "src/DProjects.XShell/Resources/DProjects.XShell") -Recurse -File | Where-Object { $_.Extension -in ".js", ".json", ".jsonc", ".md", ".html" } | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }
$referencedNames = [regex]::Matches(($resourceText -join "`n"), '(?:icon|appIcon)\s*[:=]\s*["'']([a-zA-Z0-9_-]+)["'']') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$availableNames = $iconPaths | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_) } | Sort-Object -Unique
$unresolved = @($referencedNames | Where-Object { $_ -like "x-*" -and $_ -notin $availableNames })
if ($unresolved) { $failures.Add("Referenced icon names are unresolved: $($unresolved -join ', ')") }

if ($failures.Count) { $failures | ForEach-Object { Write-Error $_ }; exit 1 }
Write-Output "Validated $($iconPaths.Count) SVG icons: XML, viewBox, CSP-safe markup, local resources, geometry, filename inventory, and static icon references."
