import {test,expect} from '@playwright/test';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6tQAAAAASUVORK5CYII=','base64');
async function fixture(page,owner=false){
 const events=[],saved=[];
 const user={id:owner?'owner':'reader',email:'fixture@example.invalid',full_name:'Fixture User',role:'user',onboarding_completed:true,last_seen_version:'2025-11-19'};
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/auth/session'||path==='/api/auth/me')return reply(user);
  if(path==='/api/advertisements/capabilities')return reply({canManage:owner});
  if(path==='/api/advertisements/owner/list')return reply(saved.map((r,i)=>({...r,id:String(i),stats:{impressions:0,clicks:0,viewers:0},daily:[]})));
  if(path==='/api/advertisements/owner'&&req.method()==='POST'){saved.push(req.postDataJSON());return reply({id:String(saved.length)});}
  if(path==='/api/advertisements')return reply([{id:'first',advertiser:'Example sponsor',headline:'First creative',body:'First copy',creative:'One',seconds:3,ticket:'test-ticket-1'},{id:'second',advertiser:'Example sponsor',headline:'Second creative',body:'Second copy',creative:'Two',seconds:3,ticket:'test-ticket-2'}]);
  if(path.endsWith('/image'))return route.fulfill({status:200,contentType:'image/png',body:png});
  if(path.endsWith('/events')){events.push(req.postDataJSON());return reply({counted:true});}
  if(path==='/api/auth/maintenance')return reply({active:false});
  if(path.includes('/api/ai/'))return reply({reference:'John 3:16',text:'Scripture fixture',reflection:'Reflection'});
  return reply([]);
 });
 return {events,saved};
}
test('mobile Safari and Android profiles: reader sees rotating advertisements without owner controls',async({page})=>{
 const {events}=await fixture(page);
 await page.goto('/Home');
 const slot=page.getByRole('complementary',{name:'Advertisement',exact:true});
 await slot.scrollIntoViewIfNeeded();await expect(slot).toBeVisible();
 await expect(slot.getByText('First creative')).toBeVisible();
 await expect.poll(()=>events.length).toBeGreaterThan(0);
 expect(events[0]).toMatchObject({kind:'impression',ticket:'test-ticket-1'});
 const count=events.length;
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 // Observe longer than a slide duration to prove hidden tabs neither rotate nor count.
 await page.waitForTimeout(3500);
 expect(events).toHaveLength(count);await expect(slot.getByText('First creative')).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(slot.getByText('Second creative')).toBeVisible({timeout:6000});
 await page.emulateMedia({media:'print'});await expect(slot).toBeHidden();await page.emulateMedia({media:'screen'});
 await page.goto('/Settings');await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Advertisement management'})).toHaveCount(0);
});
test('mobile Safari and Android profiles: owner uploads separate creatives and run settings fit the viewport',async({page})=>{
 const {saved}=await fixture(page,true);
 await page.goto('/Settings');
 const manager=page.getByRole('region',{name:'Advertisement management'});
 await manager.scrollIntoViewIfNeeded();await expect(manager).toBeVisible();
 await manager.getByLabel('advertiser',{exact:true}).fill('Example sponsor');
 await manager.getByLabel('headline',{exact:true}).fill('Sponsor message');
 await manager.getByLabel('Advertiser web address').fill('https://example.com');
 await manager.locator('input[type=file]').setInputFiles([{name:'one.png',mimeType:'image/png',buffer:png},{name:'two.png',mimeType:'image/png',buffer:png}]);
 await manager.getByLabel('Purchased run').selectOption('2w');
 await manager.getByLabel('Published during purchased dates').check();
 await manager.getByRole('button',{name:'Add creatives'}).click();
 await expect.poll(()=>saved.length).toBe(2);
 expect(saved.map(r=>r.creative)).toEqual(['one.png','two.png']);
 expect(saved.every(r=>r.duration==='2w'&&r.active&&r.seconds===15)).toBe(true);
 await manager.screenshot({path:test.info().outputPath('owner-advertisements.png')});
 const bounds=await manager.boundingBox();expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width+1);
});

test('failed image never creates a billable impression',async({page})=>{
 const {events}=await fixture(page);
 await page.route('**/api/advertisements/*/image',route=>route.fulfill({status:200,contentType:'image/png',body:'not an image'}));
 await page.goto('/Home');
 const slot=page.getByRole('complementary',{name:'Advertisement',exact:true});
 await slot.scrollIntoViewIfNeeded();await expect(slot).toBeVisible();
 await expect(slot.getByText('Second creative')).toBeVisible({timeout:6000});
 expect(events).toHaveLength(0);
});
