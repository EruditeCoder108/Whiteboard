import { launch, check, summary, fw } from './lib.mjs'
import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
const shots=resolve('e2e/icon-shots');mkdirSync(shots,{recursive:true})
const loaded=async(page,selector)=>{
  await page.locator(selector).first().waitFor()
  await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].every(i=>i.complete&&i.naturalWidth>0),selector)
  return page.locator(selector).count()
}
for(const layout of ['board','laptop']){
 const {app,page,logs}=await launch({layout})
 try{
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setFullScreen(false);w.setBounds({x:4000,y:60,width:1366,height:768})})
  for(const [theme,color]of [['light','#ffffff'],['dark','#1d3b33']]){
   await fw(page,(w,{theme,color})=>{w.S.uiTheme.value=theme;w.board.setColor(color);w.board.setSurface({color,texture:theme==='dark'?'chalk':'none'},false);w.S.popover.value=null},{theme,color})
   await page.waitForTimeout(250)
   const bar=layout==='board'?'.boardbar':'.dock'
   check(`${layout} ${theme}: toolbar images loaded`,await loaded(page,bar+' img.art')>=8)
   check(`${layout} ${theme}: toolbar fits 1366`,await page.locator(bar).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}))
   check(`${layout} ${theme}: images do not intercept taps`,await page.locator(bar+' img.art').first().evaluate(e=>getComputedStyle(e).pointerEvents==='none'))
   await page.screenshot({path:join(shots,`${layout}-${theme}-toolbar.png`)})
   if(layout==='board'){
    await page.getByRole('button',{name:'More',exact:true}).click()
    check(`${theme}: More menu images loaded`,await loaded(page,'.board-sheet img.art')>=25)
    await page.screenshot({path:join(shots,`board-${theme}-more.png`)})
    await fw(page,w=>{w.S.popover.value='subjects'})
    check(`${theme}: subject pictures loaded`,await loaded(page,'.subjects-sheet img.art')>=15)
    await page.screenshot({path:join(shots,`board-${theme}-subjects.png`)})
    await fw(page,w=>{w.S.popover.value=null})
   }
  }
  check(`${layout}: no renderer errors`,!logs.some(l=>/pageerror|\[error\]/.test(l)),logs.join(' | '))
 }finally{await app.close().catch(()=>{})}
}
process.exit(summary()?1:0)
