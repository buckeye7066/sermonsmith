function Protect-OwnerDirectory {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not [IO.Path]::IsPathRooted($Path)) { throw 'An absolute private directory is required' }
  $full=[IO.Path]::GetFullPath($Path).TrimEnd('\')
  $forbidden=@([IO.Path]::GetPathRoot($full).TrimEnd('\'),$env:USERPROFILE,$env:SystemRoot,$env:ProgramFiles,${env:ProgramFiles(x86)},(Split-Path $env:USERPROFILE -Parent)) | Where-Object { $_ }
  if ($forbidden -contains $full) { throw 'A dedicated private subdirectory is required' }
  if (-not (Test-Path -LiteralPath $full)) { New-Item -ItemType Directory -Path $full | Out-Null }
  $items=[Collections.Generic.List[IO.FileSystemInfo]]::new()
  $pending=[Collections.Generic.Stack[string]]::new();$pending.Push($full)
  while ($pending.Count -gt 0) {
    $entry=Get-Item -LiteralPath $pending.Pop() -Force
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Private directories cannot contain symbolic links or junctions' }
    $items.Add($entry)
    if ($entry.PSIsContainer) { foreach($child in Get-ChildItem -LiteralPath $entry.FullName -Force) { $pending.Push($child.FullName) } }
  }
  $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
  foreach($entry in $items) {
    if ($entry.PSIsContainer) {
      $acl=[Security.AccessControl.DirectorySecurity]::new()
      $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit),[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
    } else {
      $acl=[Security.AccessControl.FileSecurity]::new()
      $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)
    }
    $acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $entry.FullName -AclObject $acl
  }
}

function Copy-OwnerRuntime {
  param([Parameter(Mandatory=$true)][string]$SourceRoot,[Parameter(Mandatory=$true)][string]$Destination)
  $files=@('tools/owner-ai/manage.ps1','tools/owner-ai/installHelpers.ps1','tools/owner-ai/bridge.mjs','tools/owner-ai/officialCli.mjs','tools/owner-ai/codexAppServer.mjs','packages/shared/api/index.js')
  foreach($name in $files) { if(-not(Test-Path -LiteralPath (Join-Path $SourceRoot $name) -PathType Leaf)){throw ('Missing owner runtime source: '+$name)} }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  foreach($name in $files) {
    $source=Join-Path $SourceRoot $name;$target=Join-Path $Destination $name
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    if([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($target)) { Copy-Item -LiteralPath $source -Destination $target -Force }
  }
  foreach($name in @('manage.ps1','installHelpers.ps1')) {
    $source=Join-Path $SourceRoot ('tools/owner-ai/'+$name);$target=Join-Path $Destination $name
    if([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($target)) { Copy-Item -LiteralPath $source -Destination $target -Force }
  }
  Set-Content -LiteralPath (Join-Path $Destination 'package.json') -Value '{"type":"module","private":true}' -Encoding UTF8
}

# Validate length without decrypting the token or touching an installed runtime.
function Assert-OwnerBridgeToken {
  param([Security.SecureString]$Token,[Parameter(Mandatory=$true)][string]$SourceRoot)
  $module=[Uri][IO.Path]::GetFullPath((Join-Path $SourceRoot 'packages/shared/api/index.js'))
  $raw=& node.exe --input-type=module -e 'const m=await import(process.argv[1]);console.log(JSON.stringify(m.OWNER_WORKER_TOKEN_LIMITS))' $module.AbsoluteUri
  if($LASTEXITCODE -ne 0){throw 'Bridge token policy unavailable'}
  $limits=$raw | ConvertFrom-Json
  if($limits.min -ne 32 -or $limits.max -lt $limits.min -or ($limits.max + 7) -ne $limits.headerMax){throw 'Bridge token policy invalid'}
  if($null -eq $Token -or $Token.Length -lt $limits.min -or $Token.Length -gt $limits.max){
    throw ('Bridge token length must be between '+$limits.min+' and '+$limits.max)
  }
}
