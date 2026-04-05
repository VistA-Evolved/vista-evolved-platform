param(
    [string]$SourceDir = "c:\Users\kmoul\OneDrive\Documents\GitHub\VistA UX UI Design and Development Maps",
    [string]$TargetDir = "c:\Users\kmoul\OneDrive\Documents\GitHub\vista-evolved-platform\docs\specs"
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$ErrorActionPreference = "Continue"

function Convert-DocxToMarkdown {
    param([string]$DocxPath, [string]$OutputPath)
    
    $tempDir = Join-Path $env:TEMP ("docx_convert_" + [guid]::NewGuid().ToString("N").Substring(0,8))
    
    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($DocxPath, $tempDir)
        $docXmlPath = Join-Path $tempDir "word\document.xml"
        
        if (-not (Test-Path $docXmlPath)) {
            Write-Warning "No word/document.xml in $DocxPath"
            return $false
        }
        
        $xml = [xml](Get-Content $docXmlPath -Raw -Encoding UTF8)
        $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
        $ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
        
        $paragraphs = $xml.SelectNodes("//w:p", $ns)
        $mdLines = [System.Collections.Generic.List[string]]::new()
        $firstLine = $true
        
        foreach ($para in $paragraphs) {
            $styleNode = $para.SelectSingleNode(".//w:pPr/w:pStyle/@w:val", $ns)
            $style = if ($styleNode) { $styleNode.Value } else { "" }
            
            $runs = $para.SelectNodes(".//w:r", $ns)
            $textParts = @()
            foreach ($run in $runs) {
                $tNodes = $run.SelectNodes(".//w:t", $ns)
                foreach ($t in $tNodes) { $textParts += $t.'#text' }
            }
            $text = ($textParts -join '').Trim()
            
            if ([string]::IsNullOrWhiteSpace($text)) {
                $mdLines.Add("")
                continue
            }
            
            $heading = $false
            switch -Wildcard ($style) {
                "Heading1" { $mdLines.Add("# $text"); $heading = $true }
                "Heading2" { $mdLines.Add("## $text"); $heading = $true }
                "Heading3" { $mdLines.Add("### $text"); $heading = $true }
                "Heading4" { $mdLines.Add("#### $text"); $heading = $true }
                "Title"    { $mdLines.Add("# $text"); $heading = $true }
                "Subtitle" { $mdLines.Add("*$text*"); $heading = $true }
            }
            
            if (-not $heading) {
                if ($firstLine -and $text.Length -lt 80) {
                    $mdLines.Add("# $text")
                }
                elseif ($text -match '^\d+\.\d+\.\d+\s' -and $text.Length -lt 150) {
                    $mdLines.Add("#### $text")
                }
                elseif ($text -match '^\d+\.\d+\s' -and $text.Length -lt 150) {
                    $mdLines.Add("### $text")
                }
                elseif ($text -match '^\d+\.\s' -and $text.Length -lt 150 -and $text -notmatch '\.\s+\S.*\.\s') {
                    $mdLines.Add("## $text")
                }
                else {
                    $mdLines.Add($text)
                }
            }
            
            if (-not [string]::IsNullOrWhiteSpace($text)) { $firstLine = $false }
        }
        
        $content = $mdLines -join "`n"
        $content = $content -replace "`n{4,}", "`n`n`n"
        
        [System.IO.File]::WriteAllText($OutputPath, $content, [System.Text.UTF8Encoding]::new($false))
        return $true
    }
    catch {
        Write-Warning "Failed to convert $([System.IO.Path]::GetFileName($DocxPath)) : $_"
        return $false
    }
    finally {
        if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

if (-not (Test-Path $TargetDir)) { 
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null 
}

$docxFiles = Get-ChildItem -Path $SourceDir -Filter "*.docx" | Sort-Object Name
$total = $docxFiles.Count
$success = 0
$failed = 0

Write-Host "Converting $total .docx files to Markdown..."
Write-Host "Source: $SourceDir"
Write-Host "Target: $TargetDir"
Write-Host ""

foreach ($file in $docxFiles) {
    $safeName = $file.BaseName.Trim()
    $safeName = $safeName -replace '[<>:"/\\|?*]', ''
    $safeName = $safeName -replace '\s+', '-'
    $safeName = $safeName.ToLower()
    $outputPath = Join-Path $TargetDir "$safeName.md"
    
    Write-Host "  [$($success + $failed + 1)/$total] $($file.Name)" -NoNewline
    
    $result = Convert-DocxToMarkdown -DocxPath $file.FullName -OutputPath $outputPath
    
    if ($result) {
        $size = (Get-Item $outputPath).Length
        Write-Host " -> OK ($([math]::Round($size/1024, 1))KB)" -ForegroundColor Green
        $success++
    }
    else {
        Write-Host " -> FAILED" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Done: $success converted, $failed failed out of $total total."
