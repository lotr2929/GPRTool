Add-Type -AssemblyName System.IO.Compression.FileSystem
$folder = 'C:\_myProjects\GPRTool\GPRTool Projects'
Get-ChildItem $folder -Filter '*.gpr' | ForEach-Object {
    $name = $_.Name
    $size = [math]::Round($_.Length / 1KB, 1)
    Write-Host "=== $name === ${size}KB"
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName)
        foreach ($entry in $zip.Entries) {
            $kb = [math]::Round($entry.Length / 1KB, 1)
            Write-Host "  $($entry.FullName) ${kb}KB"
        }
        $zip.Dispose()
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)"
    }
}
