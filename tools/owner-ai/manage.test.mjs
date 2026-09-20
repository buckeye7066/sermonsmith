import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=fileURLToPath(new URL('./manage.ps1',import.meta.url));
test('installer never overwrites PowerShell automatic HOME',()=>{
  assert.doesNotMatch(readFileSync(script,'utf8'),/\$home\s*=/i);
});
test('Windows installer validates the origin before any task or credential changes',{skip:process.platform!=='win32'},()=>{
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-File',script,'-Action','Install','-Url','http://example.invalid','-CodexHome','C:\\OwnerFixture'],{encoding:'utf8',windowsHide:true,timeout:10000});
  assert.notEqual(p.status,0);assert.match(p.stdout+p.stderr,/HTTPS origin is required/);
  assert.doesNotMatch(p.stdout+p.stderr,/Cannot overwrite variable HOME/);
});

test('installed task uses a stable runtime copy, not a disposable Git worktree',()=>{
  const source=readFileSync(script,'utf8');
  assert.match(source,/Join-Path \$bridgeHome 'manage\.ps1'/);
  assert.match(source,/Copy-OwnerRuntime/);
});


test('Windows installer protects pre-existing credential files and installs shared transport without requiring the Git checkout', {skip:process.platform!=='win32'},()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const helper=fileURLToPath(new URL('./installHelpers.ps1',import.meta.url));
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const command=`$ErrorActionPreference='Stop'; . ${quote(helper)}; $dir=Join-Path ([IO.Path]::GetTempPath()) ('sermon-installer-'+[guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $dir | Out-Null; try { $credentials=Join-Path $dir 'private-codex'; New-Item -ItemType Directory $credentials | Out-Null; Set-Content (Join-Path $credentials 'auth.json') '{"fixture":true}'; & icacls.exe $credentials /grant '*S-1-1-0:(OI)(CI)R' | Out-Null; Protect-OwnerDirectory -Path $credentials; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; foreach($p in @($credentials,(Join-Path $credentials 'auth.json'))){$acl=Get-Acl $p;if(-not $acl.AreAccessRulesProtected){throw 'Inheritance remains enabled'};foreach($rule in $acl.Access){if($rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -ne $sid){throw 'Foreign principal retains access'}}}; $runtime=Join-Path $dir 'installed'; Copy-OwnerRuntime -SourceRoot ${quote(root)} -Destination $runtime; $bridge=Join-Path $runtime 'tools\\owner-ai\\bridge.mjs'; & node.exe --input-type=module -e 'import(process.argv[1])' ([Uri]$bridge).AbsoluteUri; if($LASTEXITCODE -ne 0){throw 'Installed import failed'}; Write-Output 'installed-import-ok'; Write-Output 'private-acl-ok'; } finally {Remove-Item -LiteralPath $dir -Recurse -Force}`;
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:20000});
  assert.equal(p.status,0,p.stdout+p.stderr);assert.match(p.stdout,/installed-import-ok/);assert.match(p.stdout,/private-acl-ok/);
});

for(const size of [31,32,1017,1018,1024])test(`installer validates synthetic token length ${size} using the shared public policy`,{skip:process.platform!=='win32'},()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url));
 const helper=fileURLToPath(new URL('./installHelpers.ps1',import.meta.url));
 const quote=value=>"'"+value.replaceAll("'","''")+"'";
 const command=`$ErrorActionPreference='Stop'; . ${quote(helper)}; $fixture=ConvertTo-SecureString ('x' * ${size}) -AsPlainText -Force; Assert-OwnerBridgeToken -Token $fixture -SourceRoot ${quote(root)}; Write-Output 'token-policy-ok'`;
 const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:10000});
 if(size>=32&&size<=1017){assert.equal(p.status,0,p.stdout+p.stderr);assert.match(p.stdout,/token-policy-ok/);}
 else{assert.notEqual(p.status,0);assert.match(p.stdout+p.stderr,/Bridge token length/);}
});
