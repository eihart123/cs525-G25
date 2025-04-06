# Run from the cs525-baseline directory

npm run build

# Start 5 devices (10-14)
# 10..14 | ForEach-Object {
#     Write-Host "Starting sensor $_..."
#     $env:DEVICE_ID = "$_"
#     Start-Process node -ArgumentList "dist/esm/SensorDeviceNode.js" -NoNewWindow
#     # Reset the environment variable if needed
#     # $env:DEVICE_ID = $null
# }

10..14 | ForEach-Object {
  Write-Host "Starting sensor $_..."
  $deviceId = $_
  $command = "set DEVICE_ID=$deviceId && node dist/esm/SensorDeviceNode.js -- --storage-clear"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $command -NoNewWindow
}
