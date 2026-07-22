Write-Host "Starting simple HTTP server on port 8000..."
if (Get-Command python -ErrorAction SilentlyContinue) {
  python -m http.server 8000
} else {
  Write-Host "Python not found. Install Python 3 or run: npx serve -l 8000" -ForegroundColor Yellow
}
