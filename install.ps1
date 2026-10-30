# 自动追加配置的脚本
$patchPath = "$HOME\.dsh\profiles\web\cordis.patch.yml"
$content = Get-Content $patchPath -Raw
if ($content -notmatch "id: compaction-basic") {
    $appendText = @"

- id: compaction-basic
  disabled: true
- id: compaction-pro
  name: '@GZT2023/dsh-compaction-pro'
  config:
    faithful: true
    recursive: true
    summaryLanguage: auto
    thresholdRatio: 0.8
    retainRatio: 0.16
    maxTokens: 8192
    chunkMessages: 40
    auto: true
"@
    Add-Content -Path $patchPath -Value $appendText -Encoding UTF8
    Write-Host "? 配置追加成功！" -ForegroundColor Green
} else {
    Write-Host "?? 配置已存在，无需重复添加" -ForegroundColor Yellow
}