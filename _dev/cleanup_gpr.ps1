$folder = 'C:\_myProjects\GPRTool\GPRTool Projects'
$files = Get-ChildItem $folder -Filter '*.gpr' | Where-Object { $_.Length -lt 1024 }
foreach ($f in $files) {
    Write-Host "Deleting: $($f.Name) ($($f.Length) bytes)"
    Remove-Item $f.FullName
}
Write-Host "Done. Removed $($files.Count) corrupt file(s)."
