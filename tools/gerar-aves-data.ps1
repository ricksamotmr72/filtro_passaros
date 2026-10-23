# Gera assets/data/aves-data.js a partir dos PNGs em assets/images/.
#
# Cada foto vira duas imagens JPEG 800x800 embutidas como data URL:
#   rgb  - cor da ave composta sobre preto
#   mask - canal alfa (transparência) em tons de cinza
# O navegador junta as duas ao carregar (js/assets.js). Embutir as fotos evita o bloqueio de
# segurança do canvas ao abrir o index.html direto do disco (botão "Capturar Foto").
#
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File tools\gerar-aves-data.ps1
#
# Ao trocar uma foto, mantenha o mesmo nome de arquivo, o formato quadrado e o fundo transparente,
# e meça de novo os olhos e o contorno do bico em js/config.js (coordenadas em pixels da foto original).

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$birds = [ordered]@{
  woodpecker = 'pica-pau.png'
  toucan     = 'tucano.png'
  beijaflor  = 'beija-flor.png'
}
$size = 800

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
function Encode-Jpeg($bmp, $quality) {
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, $codec, $ep)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  return , $bytes
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('// Fotos das aves (geradas por tools/gerar-aves-data.ps1 a partir de assets/images/*.png, 800x800).')
[void]$sb.AppendLine('// rgb: cor composta sobre preto; mask: canal alfa em tons de cinza. Embutidas como data URL para o')
[void]$sb.AppendLine('// canvas não ficar "tainted" ao abrir o HTML direto do disco. Não edite à mão.')
[void]$sb.AppendLine('window.BIRD_IMAGES = {')

foreach ($key in $birds.Keys) {
  $path = Join-Path $root "assets\images\$($birds[$key])"
  $src = [System.Drawing.Image]::FromFile($path)

  $rgb = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($rgb)
  $g.Clear([System.Drawing.Color]::Black)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()

  # Alpha -> gray: R = G = B = A, output alpha forced to 1
  $mask = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($mask)
  $g.Clear([System.Drawing.Color]::Black)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $cm = New-Object System.Drawing.Imaging.ColorMatrix
  $cm.Matrix00 = 0; $cm.Matrix11 = 0; $cm.Matrix22 = 0
  $cm.Matrix30 = 1; $cm.Matrix31 = 1; $cm.Matrix32 = 1; $cm.Matrix33 = 0; $cm.Matrix43 = 1
  $ia = New-Object System.Drawing.Imaging.ImageAttributes
  $ia.SetColorMatrix($cm)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $size, $size), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)
  $g.Dispose()

  $a = Encode-Jpeg $rgb 88
  $b = Encode-Jpeg $mask 90
  Write-Host ("{0,-11} cor {1,4} KB   máscara {2,3} KB" -f $key, [math]::Round($a.Length / 1024), [math]::Round($b.Length / 1024))

  [void]$sb.AppendLine("  ${key}: {")
  [void]$sb.AppendLine("    rgb: 'data:image/jpeg;base64,$([Convert]::ToBase64String($a))',")
  [void]$sb.AppendLine("    mask: 'data:image/jpeg;base64,$([Convert]::ToBase64String($b))'")
  [void]$sb.AppendLine('  },')

  $rgb.Dispose(); $mask.Dispose(); $src.Dispose()
}
[void]$sb.AppendLine('};')

$out = Join-Path $root 'assets\data\aves-data.js'
[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host "Gerado: $out"
