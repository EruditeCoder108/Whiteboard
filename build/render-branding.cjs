// Render editable HTML branding templates. No live application/profile is loaded.
const {app,BrowserWindow,screen}=require('electron')
const fs=require('node:fs')
const path=require('node:path')
const root=path.join(__dirname,'..'),work=path.join(root,'.work')
fs.mkdirSync(work,{recursive:true})
app.commandLine.appendSwitch('force-device-scale-factor','1')
app.setPath('userData',fs.mkdtempSync(path.join(work,'branding-profile-')))
app.on('window-all-closed',()=>{})
app.whenReady().then(async()=>{
  const outside=Math.max(...screen.getAllDisplays().map(d=>d.bounds.x+d.bounds.width))+200
  const targets=[
    {source:'docs/assets/readme/cover.template.html',output:'docs/assets/readme/cover.png',width:1440,height:480},
    {source:'docs/assets/social/repo-card.template.html',output:'docs/assets/social/repo-card.png',width:1280,height:640,guides:'docs/assets/social/repo-card-guides.png'}
  ]
  for(const t of targets){
    const win=new BrowserWindow({x:outside,y:40,width:t.width,height:t.height,useContentSize:true,show:false,frame:false,focusable:false,skipTaskbar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}})
    win.setIgnoreMouseEvents(true);win.showInactive()
    await win.loadFile(path.join(root,t.source))
    await win.webContents.executeJavaScript('Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.decode())])')
    await new Promise(r=>setTimeout(r,180))
    const capture=async output=>{
      const image=await win.capturePage(undefined,{stayAwake:true}),size=image.getSize()
      if(size.width!==t.width||size.height!==t.height)throw new Error('Unexpected branding export dimensions: '+JSON.stringify(size))
      fs.writeFileSync(path.join(root,output),image.toPNG());console.log(output+' '+size.width+'x'+size.height)
    }
    await capture(t.output)
    if(t.guides){await win.webContents.executeJavaScript('document.body.classList.add("guides")');await new Promise(r=>setTimeout(r,100));await capture(t.guides)}
    win.destroy()
  }
  app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
