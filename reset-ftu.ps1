# reset-ftu.ps1 — Resetea BrainTwo al estado new-user (FTU)
# Borra: localStorage, session storage y sesion de WhatsApp (auth)
# Uso: .\reset-ftu.ps1     (desde la raiz del proyecto)
# Despues de correrlo, abri la app con "npm run dev" y vas a ver la pantalla de bienvenida.

$userData = "$env:APPDATA\braintwo"

# Cerrar la app si esta corriendo (tray incluido)
taskkill /F /IM electron.exe /IM BrainTwo.exe 2>$null | Out-Null
Start-Sleep -Milliseconds 400

# Usar cmd /c rd que fuerza el borrado incluso cuando PowerShell falla por locks
foreach ($appFolder in @("braintwo", "BrainTwo")) {
    $userData = "$env:APPDATA\$appFolder"
    if (Test-Path $userData) {
        Write-Host "Limpiando datos de la app: $appFolder..."
        foreach ($folder in @("Local Storage", "Session Storage", "auth")) {
            $path = "$userData\$folder"
            if (Test-Path $path) {
                cmd /c "rd /s /q `"$path`"" 2>$null
                if (Test-Path $path) {
                    Write-Warning "No se pudo borrar: $folder en $appFolder (cerrá la app desde el tray y volvé a correr)"
                } else {
                    Write-Host "  OK: $folder borrado"
                }
            }
        }
        foreach ($file in @("braintwo.db", "braintwo.db-wal", "braintwo.db-shm", "embedding_version.txt")) {
            $path = "$userData\$file"
            if (Test-Path $path) {
                cmd /c "del /f /q `"$path`"" 2>$null
                if (Test-Path $path) {
                    Write-Warning "  No se pudo borrar el archivo: $file en $appFolder"
                } else {
                    Write-Host "  OK: $file borrado"
                }
            }
        }
    }
}

Write-Host ""
Write-Host "Listo. Corré 'npm run dev' para ver el FTU."
