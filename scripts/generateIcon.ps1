Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outIco = Join-Path $root 'build\app.ico'
$tmpDir = Join-Path $env:TEMP 'qiandian-icon'
if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
New-Item -ItemType Directory -Path $tmpDir | Out-Null

$bgColor = [System.Drawing.Color]::FromArgb(255, 0xD6, 0x53, 0x2E)
$fgColor = [System.Drawing.Color]::FromArgb(255, 0xFF, 0xF6, 0xE8)
$fontFamilyCandidates = @('Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', 'STSong', 'PMingLiU', 'Microsoft YaHei')

function Get-Font([single]$size) {
    foreach ($name in $fontFamilyCandidates) {
        try {
            $font = New-Object System.Drawing.Font($name, $size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
            if ($font.Name -eq $name -or $font.FontFamily.Name -eq $name) {
                return $font
            }
            $font.Dispose()
        } catch {
            continue
        }
    }
    return New-Object System.Drawing.Font('Arial', $size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-RoundedRectPath([System.Drawing.RectangleF]$rect, [single]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    if ($diameter -le 0) {
        $path.AddRectangle($rect)
        return $path
    }
    $arc = New-Object System.Drawing.RectangleF($rect.X, $rect.Y, $diameter, $diameter)
    $path.AddArc($arc, 180, 90)
    $arc.X = $rect.Right - $diameter
    $path.AddArc($arc, 270, 90)
    $arc.Y = $rect.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    $arc.X = $rect.X
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconPng([int]$size, [string]$pngPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $radius = [Math]::Max(2.0, [single]($size * 0.16))
    $rect = New-Object System.Drawing.RectangleF(0.0, 0.0, [single]$size, [single]$size)
    $path = New-RoundedRectPath $rect $radius
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()

    $fontSize = [single]($size * 0.72)
    $font = Get-Font $fontSize
    $textBrush = New-Object System.Drawing.SolidBrush($fgColor)
    $typographic = [System.Drawing.StringFormat]::GenericTypographic

    $qianChar = [string][char]0x5343
    $em = [single]$font.FontFamily.GetEmHeight([System.Drawing.FontStyle]::Bold)
    $ascent = [single]$font.FontFamily.GetCellAscent([System.Drawing.FontStyle]::Bold)
    $descent = [single]$font.FontFamily.GetCellDescent([System.Drawing.FontStyle]::Bold)
    $charHeight = ($ascent + $descent) / $em * $fontSize
    $measured = $g.MeasureString($qianChar, $font, [int]$size, $typographic)
    $textX = ([single]$size - $measured.Width) / 2.0
    $textY = ([single]$size - $charHeight) / 2.0
    $g.DrawString($qianChar, $font, $textBrush, $textX, $textY, $typographic)

    $font.Dispose()
    $textBrush.Dispose()
    $g.Dispose()

    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngPaths = @{}
foreach ($size in $sizes) {
    $pngPath = Join-Path $tmpDir ("icon-$size.png")
    New-IconPng -size $size -pngPath $pngPath
    $pngPaths[$size] = $pngPath
}

$ms = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($ms)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$sizes.Count)

$dataOffset = 6 + ($sizes.Count * 16)
$pngBytes = @{}
foreach ($size in $sizes) {
    $bytes = [System.IO.File]::ReadAllBytes($pngPaths[$size])
    $pngBytes[$size] = $bytes
}

foreach ($size in $sizes) {
    $bytes = $pngBytes[$size]
    $wByte = if ($size -ge 256) { [byte]0 } else { [byte]$size }
    $hByte = $wByte
    $writer.Write([byte]$wByte)
    $writer.Write([byte]$hByte)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$bytes.Length)
    $writer.Write([UInt32]$dataOffset)
    $dataOffset += $bytes.Length
}

foreach ($size in $sizes) {
    $writer.Write($pngBytes[$size])
}

$writer.Flush()
$icoBytes = $ms.ToArray()
$writer.Dispose()
$ms.Dispose()

$backup = "$outIco.bak"
if ((Test-Path $outIco) -and -not (Test-Path $backup)) {
    Copy-Item $outIco $backup
}
[System.IO.File]::WriteAllBytes($outIco, $icoBytes)

Write-Output "wrote $outIco with $($sizes.Count) sizes ($($icoBytes.Length) bytes)"
Remove-Item -Recurse -Force $tmpDir
