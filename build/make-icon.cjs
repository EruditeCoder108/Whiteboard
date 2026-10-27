// Export the image-generated mark based on the user's reference to platform icon sizes.
// Run: npm run icon. This helper never loads the live whiteboard.
const {app,nativeImage}=require('electron')
const fs=require('node:fs')
const path=require('node:path')
const root=path.join(__dirname,'..'),work=path.join(root,'.work')
fs.mkdirSync(work,{recursive:true})
app.setPath('userData',fs.mkdtempSync(path.join(work,'icon-profile-')))
app.whenReady().then(()=>{
  const source=path.join(root,'docs/assets/brand/floating-whiteboard-logo.png')
  const image=nativeImage.createFromPath(source)
  if(image.isEmpty())throw new Error('Missing brand master: docs/assets/brand/floating-whiteboard-logo.png')
  for(const size of [512,256,64]){
    const png=image.resize({width:size,height:size,quality:'best'}).toPNG()
    fs.writeFileSync(path.join(root,'docs/assets/brand/floating-whiteboard-logo-'+size+'.png'),png)
    if(size===512)fs.writeFileSync(path.join(__dirname,'icon.png'),png)
  }
  console.log('Exported transparent icons at 512, 256 and 64 px; updated build/icon.png')
  app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
