# Cria uma tarefa no Agendador do Windows que roda a coleta diária.
# Uso (PowerShell):  .\scripts\agendar_diario.ps1 -Hora "06:30"
param([string]$Hora = "06:30", [string]$Nome = "BID Scraper Diario")
$raiz = Split-Path -Parent $PSScriptRoot
$acao = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$raiz\scripts\bid.bat`" diario" -WorkingDirectory $raiz
$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
$conf = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName $Nome -Action $acao -Trigger $gatilho -Settings $conf -Force | Out-Null
Write-Host "Tarefa '$Nome' criada para rodar todo dia as $Hora (StartWhenAvailable: roda assim que o PC ligar se perder o horario)."
