$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$width = 1700
$height = 1040
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bg = [System.Drawing.Color]::FromArgb(245, 247, 252)
$g.Clear($bg)

$fontTitle = New-Object System.Drawing.Font("Segoe UI", 24, [System.Drawing.FontStyle]::Bold)
$fontH1 = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$fontH2 = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$fontBody = New-Object System.Drawing.Font("Segoe UI", 11)
$fontSmall = New-Object System.Drawing.Font("Segoe UI", 10)

$brushBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 33, 56))
$brushPanel = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$brushSidebar = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 34, 65))
$brushAccent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 152, 219))
$brushAccent2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 204, 113))
$brushWarn = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(231, 76, 60))
$brushText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, 34, 49))
$brushMuted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(120, 130, 150))

$penBlue = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(17, 64, 122), 2)
$penSoft = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 200, 225), 2)

$g.FillRectangle($brushBg, 0, 0, $width, 72)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 220, 80, 90))), 0, 0, $width, 8)
$g.DrawString("VTC PLATFORM - Gesamt-Admin & Driver Hub", $fontTitle, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(236, 244, 255))), 20, 16)
$g.DrawString("ETS2 / ATS • Speditionen • Logbuch • Dispatch • Live-Map • Ranglisten", $fontBody, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(170, 200, 255))), 24, 52)

$g.FillRectangle($brushSidebar, 20, 100, 240, 900)
$g.DrawString("Menü", $fontH2, [System.Drawing.Brushes]::White, 40, 128)

$items = @("Home Dashboard", "Speditions-Management", "Fahrtenbuch", "Disposition", "Live-Map", "Ranglisten", "Profil / Awards")
$y = 170
foreach ($it in $items) {
  $itemBrush = if ($it -eq "Home Dashboard") { $brushAccent } else { New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 53, 94)) }
  $g.FillRectangle($itemBrush, 30, $y, 212, 40)
  $g.DrawString($it, $fontBody, [System.Drawing.Brushes]::White, 50, $y + 11)
  $y += 56
}

$panelX = 280
$panelY = 96
$panelW = 1380
$panelH = 940
$g.FillRectangle($brushPanel, $panelX, $panelY, $panelW, $panelH)
$g.DrawRectangle($penSoft, $panelX, $panelY, $panelW, $panelH)

$y = 132
$x = 320
$cards = @("Gesamt-Kilometer", "Offene Aufträge", "Aktive Fahrer", "Convoys jetzt")
$values = @("1.248.000 km", "18", "34", "2 aktiv")

for ($i = 0; $i -lt $cards.Length; $i++) {
  $cx = $x + ($i * 320)
  $g.FillRectangle($brushPanel, $cx, $y, 280, 130)
  $g.DrawRectangle($penBlue, $cx, $y, 280, 130)
  $g.DrawString($cards[$i], $fontH2, $brushText, $cx + 16, $y + 16)
  $g.DrawString($values[$i], $fontTitle, $brushAccent, $cx + 16, $y + 62)
  if ($i -eq 0) {
    $g.FillRectangle($brushAccent2, $cx + 16, $y + 105, 248, 10)
    $g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(39,174,96))), $cx + 16, $y + 105, 248, 10)
  }
}

$g.FillRectangle($brushPanel, 320, 284, 840, 320)
$g.DrawRectangle($penBlue, 320, 284, 840, 320)
$g.DrawString("Speditionen verwalten", $fontH2, $brushText, 344, 304)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 236, 250))), 344, 336, 260, 70)
$g.DrawString("Neue Firma gründen", $fontBody, $brushText, 364, 354)
$g.DrawString("Name, Tag, Beschreibung", $fontSmall, $brushMuted, 364, 374)
$g.DrawRectangle($penSoft, 344, 336, 260, 70)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 236, 255))), 616, 336, 250, 70)
$g.DrawString("Mitgliedschaft", $fontBody, $brushText, 636, 354)
$g.DrawString("Beitritt via Anfrage + Rollen", $fontSmall, $brushMuted, 636, 374)
$g.DrawRectangle($penSoft, 616, 336, 250, 70)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(222, 246, 222))), 888, 336, 250, 70)
$g.DrawString("Rollen", $fontBody, $brushText, 908, 354)
$g.DrawString("Owner / Dispatcher / Driver", $fontSmall, $brushMuted, 908, 374)
$g.DrawRectangle($penSoft, 888, 336, 250, 70)
$g.DrawString("Wall & Mitgliederübersicht", $fontBody, $brushText, 344, 438)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::WhiteSmoke)), 344, 458, 796, 130)
$g.DrawRectangle($penSoft, 344, 458, 796, 130)
$g.DrawString("» 2 neue Bewerbungen · 1 angenommene, 1 ausstehend", $fontSmall, $brushMuted, 356, 482)
$g.DrawString("» Fahrer: NightRider, DieselLena, HornHunter", $fontSmall, $brushMuted, 356, 504)
$g.DrawString("» Letzte Log-Eintragsquote: 98.4%", $fontSmall, $brushMuted, 356, 526)

$g.FillRectangle($brushPanel, 1180, 284, 440, 330)
$g.DrawRectangle($penBlue, 1180, 284, 440, 330)
$g.DrawString("Live-Map (Aktive Fahrer)", $fontH2, $brushText, 1204, 304)
$g.DrawString("ETS2 & ATS", $fontBody, $brushMuted, 1204, 332)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(228, 236, 255))), 1210, 352, 380, 250)
$g.DrawRectangle((New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(108, 122, 159))), 1210, 352, 380, 250)
$g.DrawLine($penSoft, 1210, 600, 1590, 450)
$g.DrawLine($penSoft, 1210, 550, 1360, 450)
$g.DrawLine($penSoft, 1360, 450, 1450, 610)
$g.DrawLine($penSoft, 1450, 610, 1590, 500)
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 204, 113))), 1370, 425, 18, 18)
$g.DrawString("F", $fontBody, [System.Drawing.Brushes]::White, 1375, 430)
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 152, 219))), 1410, 600, 18, 18)
$g.DrawString("F", $fontBody, [System.Drawing.Brushes]::White, 1415, 605)
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(155, 89, 182))), 1280, 540, 18, 18)
$g.DrawString("D", $fontBody, [System.Drawing.Brushes]::White, 1285, 545)

$g.DrawString("Dispatch", $fontBody, $brushText, 320, 620)
$g.FillRectangle($brushPanel, 320, 650, 840, 220)
$g.DrawRectangle($penBlue, 320, 650, 840, 220)
$g.DrawString("Fahrtenbuch / Trips", $fontH2, $brushText, 344, 670)
$g.DrawRectangle($penSoft, 350, 700, 250, 90)
$g.DrawString("Submit-Endpoint", $fontBody, $brushMuted, 370, 722)
$g.DrawString("/logbook/submit", $fontBody, $brushAccent, 370, 742)
$g.DrawRectangle($penSoft, 620, 700, 250, 90)
$g.DrawString("Trip-Klassifizierung", $fontBody, $brushMuted, 640, 722)
$g.DrawString("Real / Race / Invalid", $fontBody, $brushWarn, 640, 742)
$g.DrawRectangle($penSoft, 890, 700, 250, 90)
$g.DrawString("Punktelogik", $fontBody, $brushMuted, 910, 722)
$g.DrawString("Score + Firma-Stats", $fontBody, $brushText, 910, 742)

$g.DrawString("Ranglisten", $fontH2, $brushText, 1184, 650)
$g.FillRectangle($brushPanel, 1180, 680, 440, 190)
$g.DrawRectangle($penBlue, 1180, 680, 440, 190)
$g.DrawString("Top Spieler", $fontBody, $brushText, 1204, 705)
$g.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 228))), 1210, 730, 390, 120)
$g.DrawString("1. NightRider (ETS2)  - 2.300km", $fontSmall, $brushText, 1222, 748)
$g.DrawString("2. DieselLena (ATS)   - 1.980km", $fontSmall, $brushText, 1222, 774)
$g.DrawString("3. HornHunter (both)- 1.760km", $fontSmall, $brushText, 1222, 800)
$g.DrawString("4. RustRacer         - 1.640km", $fontSmall, $brushText, 1222, 826)
$g.DrawString("5. FreightBoss       - 1.580km", $fontSmall, $brushText, 1222, 852)

$g.DrawString("Erwartetes Gesamtbild einer fertig ausgebauten VTC Plattform", $fontSmall, $brushMuted, 320, 960)

$output = "C:\Users\jrike\Documents\Neues Projekt\Spark Projekt\backend\vtc-platform-complete-preview.png"
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bitmap.Dispose()

Write-Output $output
