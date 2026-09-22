# scripts/download-images.ps1
# Ejecuta: powershell -ExecutionPolicy Bypass -File scripts\download-images.ps1
# O desde el directorio: .\scripts\download-images.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Split-Path -Parent $PSScriptRoot
$AssetsDir = Join-Path $Root "public\assets"
New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null

$Base = "https://apartamentyliberta.pl"

# Mapeo de imágenes: destino_relativo -> URL_origen
$Images = [ordered]@{
    # Branding
    "branding\logo.png"                              = "$Base/wp-content/uploads/2020/04/Apartamenty-na-Mazurach-na-jeziorem-Liberta.png"
    "branding\welcome-pl.png"                        = "$Base/wp-content/uploads/2020/05/zapraszamy-na-Mazury.png"
    "branding\welcome-en.png"                        = "$Base/wp-content/uploads/2020/10/welcome.png"
    "branding\welcome-de.png"                        = "$Base/wp-content/uploads/2020/08/podpisDE.png"
    "branding\podpis.png"                            = "$Base/wp-content/uploads/2020/05/podpis.png"
    "branding\icon-pinezka.png"                       = "$Base/wp-content/uploads/2020/04/pinezka.png"
    "branding\icon-telefon.png"                      = "$Base/wp-content/uploads/2020/04/telefon.png"
    # Social
    "social\facebook.png"                            = "$Base/wp-content/uploads/2020/04/facebook.png"
    "social\instagram.png"                           = "$Base/wp-content/uploads/2020/04/instagram.png"
    "social\youtube.png"                             = "$Base/wp-content/uploads/2020/04/youtube.png"
    # Hero / Editorial
    "hero\hero-beach.jpg"                            = "$Base/wp-content/uploads/2020/05/pi%C4%99kna-pla%C5%BCa-na-Mazurach.jpg"
    "hero\hero-apartments.jpg"                       = "$Base/wp-content/uploads/2020/05/luksusowe-apartamenty-nad-jeziorem.jpg"
    "hero\hero-lake.jpg"                             = "$Base/wp-content/uploads/2020/05/Widok-na-Jezioro-Szel%C4%85g-Wielki-z-aartament%C3%B3w-na-Mazurach..jpg"
    "editorial\atrakcje.jpg"                         = "$Base/wp-content/uploads/2020/05/atrakcje-na-Mazurach.jpg"
    "editorial\mapa-dojazdu.jpg"                     = "$Base/wp-content/uploads/2020/04/mapa-dojazdu-do-Apartament%C3%B3w-na-Mazurach-Liberta.jpg"
    # Apartments (galería)
    "apartments\liberta-i\salon-parter.jpg"          = "$Base/wp-content/uploads/2020/05/klimatyczny-salon-na-parterze-w-apartamentach-na-Mazurach.jpg"
    "apartments\liberta-i\salon-aneks-1.jpg"         = "$Base/wp-content/uploads/2020/05/salon-z-aneksem-w-apartamencie-na-Mazurach.jpg"
    "apartments\liberta-i\salon-aneks-2.jpg"         = "$Base/wp-content/uploads/2020/05/salon-z-aneksem.jpg"
    "apartments\liberta-i\kuchnia.jpg"               = "$Base/wp-content/uploads/2020/05/aneks-kuchenny-w-apartamencie-Liberta.jpg"
    "apartments\liberta-i\sypialnia-parter.jpg"      = "$Base/wp-content/uploads/2020/05/sypialnia-dwuosobowa-na-parterze-a-apartamencie-nad-jeziorem.jpg"
    "apartments\liberta-i\luksus.jpg"                = "$Base/wp-content/uploads/2020/05/Luksus-w-apartamentach-Liberta.jpg"
    "apartments\liberta-i\lazienka-parter-1.jpg"     = "$Base/wp-content/uploads/2020/05/nowoczesna-%C5%82azienka-na-parterze-w-apartamentach-na-Mazurach.jpg"
    "apartments\liberta-i\lazienka-parter-2.jpg"     = "$Base/wp-content/uploads/2020/05/%C5%82azienka-na-parterze-w-apartamencie-nad-jeziorem.jpg"
    "apartments\liberta-i\lazienka.jpg"              = "$Base/wp-content/uploads/2020/05/%C5%82azienka-w-apartamentach-na-Mazurach.jpg"
    "apartments\liberta-i\sypialnia-pietro-1.jpg"    = "$Base/wp-content/uploads/2020/05/g%C5%82%C3%B3wna-sypialnia-dwuosobowa-na-pi%C4%99trze-apartamentu-nad-jeziorem.jpg"
    "apartments\liberta-i\sypialnia-pietro-2.jpg"    = "$Base/wp-content/uploads/2020/05/sypialnia-dwuosobowa-na-pi%C4%99trze-apartamentu-na-Mazurach.jpg"
    "apartments\liberta-i\sypialnia-pietro-3.jpg"    = "$Base/wp-content/uploads/2020/05/sypialnia-z-pojedynczymi-%C5%82%C3%B3%C5%BCkami-na-pi%C4%99trze-apartamentu-na-Mazurach.jpg"
    "apartments\liberta-i\sypialnia-pietro-4.jpg"    = "$Base/wp-content/uploads/2020/05/sypialnia-z-pojedynczymi-%C5%82%C3%B3%C5%BCkami-na-pi%C4%99trze-apartamentu-nad-jeziorem.jpg"
    "apartments\liberta-i\lozko-detal.jpg"           = "$Base/wp-content/uploads/2020/05/pojedyncze-%C5%82%C3%B3%C5%BCko-w-sypialni-dwuosobowej-na-pi%C4%99trze-apartamentu-Liberta.jpg"
    "apartments\liberta-i\bania-goralska.jpg"        = "$Base/wp-content/uploads/2020/05/tradycyjna-g%C3%B3ralska-bania-w-apartamencie-na-Mazurach.jpg"
    "apartments\liberta-i\taras.jpg"                  = "$Base/wp-content/uploads/2020/05/taras-apartamentu-nad-jeziorem.jpg"
    "apartments\liberta-i\exterior-dzien.jpg"         = "$Base/wp-content/uploads/2020/05/apartamenty-nad-jeziorem.jpg"
    "apartments\liberta-i\exterior-noc.jpg"          = "$Base/wp-content/uploads/2020/05/apartamenty-na-Mazurach-noc%C4%85.jpg"
    # Festival SUP
    "events\festiwal-sup-2026.jpg"                   = "$Base/wp-content/uploads/2026/05/1000060081.jpg"
}

# Replicar galería en liberta-ii, iii, iv (mismo set — el sitio actual lo hace así)
# Cuando el cliente entregue fotos únicas por apartamento, actualizar aquí
$GalleryKeys = @("salon-parter.jpg", "salon-aneks-1.jpg", "salon-aneks-2.jpg", "kuchnia.jpg", "sypialnia-parter.jpg", "luksus.jpg", "lazienka-parter-1.jpg", "lazienka-parter-2.jpg", "lazienka.jpg", "sypialnia-pietro-1.jpg", "sypialnia-pietro-2.jpg", "sypialnia-pietro-3.jpg", "sypialnia-pietro-4.jpg", "lozko-detal.jpg", "bania-goralska.jpg", "taras.jpg", "exterior-dzien.jpg", "exterior-noc.jpg")
$RomanMap = @{ 1 = "i"; 2 = "ii"; 3 = "iii"; 4 = "iv" }

foreach ($apt in 2..4) {
    $slug = $RomanMap[$apt]
    foreach ($key in $GalleryKeys) {
        $srcKey = "apartments\liberta-i\$key"
        $newKey = "apartments\liberta-$slug\$key"
        $Images[$newKey] = $Images[$srcKey]
    }
}

# Descargar con progreso
$Total = $Images.Count
$Current = 0
$Ok = 0
$Fail = 0
$FailedUrls = @()

foreach ($key in $Images.Keys) {
    $Current++
    $url = $Images[$key]
    $dest = Join-Path $AssetsDir $key
    $destDir = Split-Path -Parent $dest
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    if (Test-Path $dest) {
        Write-Host "[$Current/$Total] SKIP $key"
        $Ok++
        continue
    }

    try {
        Write-Host "[$Current/$Total] GET  $key" -NoNewline
        $ProgressPreference = "Continue"  # Habilitar progress bar
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop | Out-Null
        $ProgressPreference = "SilentlyContinue"

        $size = (Get-Item $dest).Length
        $sizeKB = [math]::Round($size / 1024, 1)
        Write-Host "`r[$Current/$Total] OK   $key ($sizeKB KB)" -ForegroundColor Green
        $Ok++
    } catch {
        Write-Host "`r[$Current/$Total] FAIL $key - $($_.Exception.Message)" -ForegroundColor Red
        $Fail++
        $FailedUrls += $key
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Resultado:" -ForegroundColor Cyan
Write-Host "  OK:    $Ok / $Total" -ForegroundColor Green
Write-Host "  FAIL:  $Fail / $Total" -ForegroundColor $(if ($Fail -gt 0) { "Red" } else { "Gray" })
Write-Host "======================================" -ForegroundColor Cyan

if ($Fail -gt 0) {
    Write-Host ""
    Write-Host "Imagenes que fallaron:" -ForegroundColor Yellow
    $FailedUrls | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
}

Write-Host ""
Write-Host "OK. Ahora ejecuta: npm run dev" -ForegroundColor Green
