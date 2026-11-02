// Focused reproductions and real lesson-file round trips; build first.
import {launch,fw,gesture} from './lib.mjs'
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
const root=resolve('../audit-shots'),folder=join(root,'probes');mkdirSync(folder,{recursive:true})
const {app,page}=await launch({layout:'laptop',inputIsolated:true})
const findings=[]
const shot=async name=>{const path=join(folder,name+'.png');await page.screenshot({path});return path}
const reset=()=>fw(page,w=>{w.board.newLesson('notebook');w.board.setSurface({color:'#ffffff',texture:'none'},false);w.board.setTool('select')})
const put=(kind,x,y,params)=>fw(page,(w,a)=>{const p=w.apparatus.partOf(a.kind);const it=w.apparatus.newPart(p,a.x,a.y,1,a.params);w.board.insertSaved([it]);w.board.setSelection([])}, {kind,x,y,params})
const tapControl=async kind=>{const at=await fw(page,(w,k)=>{const it=w.board.doc.items.find(i=>i.kind===k),p=w.apparatus.partOf(k),[x,y]=p.controls[0].at(it.params),v=w.board.view;return[(it.p[0]+x/p.w*(it.p[2]-it.p[0])-v.x)*v.zoom,(it.p[1]+y/p.h*(it.p[3]-it.p[1])-v.y)*v.zoom]},kind);await gesture(page,[at])}
try{
 await page.setViewportSize({width:1280,height:720})
 await reset()
 await fw(page,w=>{const e=w.apparatus.EXAMPLES.find(x=>x.id==='titration');w.board.insertSaved(e.build());w.board.setSelection([])})
 await tapControl('burette');await page.waitForTimeout(1200);await tapControl('burette');await page.waitForTimeout(80)
 const before=await fw(page,w=>w.board.doc.items.filter(i=>i.params?.ml!==undefined).map(i=>({kind:i.kind,ml:i.params.ml,open:i.params.open})))
 await fw(page,w=>w.board.undo());await page.waitForTimeout(80)
 const after=await fw(page,w=>w.board.doc.items.filter(i=>i.params?.ml!==undefined).map(i=>({kind:i.kind,ml:i.params.ml,open:i.params.open})))
 findings.push({name:'undo-titration',before,after,screenshot:await shot('undo-titration')})
 await reset();await put('beaker',800,430,{ml:0,acid:0,base:0,showPh:1});await page.waitForTimeout(100)
 findings.push({name:'empty-vessel-ph',screenshot:await shot('empty-vessel-ph')})
 await reset();await put('burette',800,420,{ml:0,open:0});await page.waitForTimeout(100)
 findings.push({name:'empty-burette',screenshot:await shot('empty-burette')})
 await reset();await put('spring-balance',800,420,{g:1000});await page.waitForTimeout(100)
 findings.push({name:'spring-scale',screenshot:await shot('spring-scale')})
 await reset();await put('pendulum',800,420,{l:1,angle:30,on:1});await page.waitForTimeout(300)
 findings.push({name:'pendulum-envelope',screenshot:await shot('pendulum-envelope')})
 await reset();await put('bar-magnet',800,420,{field:1});await page.waitForTimeout(100)
 findings.push({name:'magnet-lines',screenshot:await shot('magnet-lines')})
 await reset();await put('force',800,420,{x:0,y:0});await page.waitForTimeout(100)
 findings.push({name:'zero-force',screenshot:await shot('zero-force')})
 await reset();await put('beaker',680,360,{ml:0});await put('balance',680,530);await page.waitForTimeout(100)
 findings.push({name:'balance-beaker',value:await fw(page,w=>w.apparatus.world.readingOf(w.board.doc.items.find(i=>i.kind==='balance')).value),screenshot:await shot('balance-beaker')})
 await reset();await put('measuring-cylinder',680,295,{ml:0});await put('balance',680,530);await page.waitForTimeout(100)
 findings.push({name:'balance-cylinder',value:await fw(page,w=>w.apparatus.world.readingOf(w.board.doc.items.find(i=>i.kind==='balance')).value),screenshot:await shot('balance-cylinder')})
 // Measure paint-time text in the part's own units, including the real canvas font metrics.
 const catalogue=[]
 for(const name of readdirSync(root).filter(x=>/^(board|laptop)-(1280|1366|1920)-(light|dark)$/.test(x))){
  try{const data=JSON.parse(readFileSync(join(root,name,'coverage.json')));for(const p of data.parts)if(p.kind&&!catalogue.some(x=>x.kind===p.kind))catalogue.push(p)}catch{}
 }
 const metrics=await fw(page,(w,parts)=>parts.map(info=>{
  const p=w.apparatus.partOf(info.kind),cv=document.createElement('canvas'),c=cv.getContext('2d'),labels=[],original=c.fillText.bind(c)
  c.fillText=(value,x,y,...rest)=>{const m=c.measureText(value),t=c.getTransform(),left=c.textAlign==='center'?x-m.width/2:c.textAlign==='right'||c.textAlign==='end'?x-m.width:x;labels.push({text:String(value),x:t.a*left+t.e,y:t.d*y+t.f,width:Math.abs(t.a)*m.width,height:Math.abs(t.d)*(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)});original(value,x,y,...rest)}
  p.paint(c,{...p.params},{time:0,volts:0,amps:0,dark:false},w.apparatus.newPart(p,0,0))
  return {kind:p.kind,w:p.w,h:p.h,outside:labels.filter(t=>t.x<-.5||t.x+t.width>p.w+.5||t.y-t.height/2<-.5||t.y+t.height/2>p.h+.5)}
 }),catalogue)
 writeFileSync(join(folder,'text-metrics.json'),JSON.stringify(metrics,null,2))
 // Read and reopen files from the isolated lesson library, one for every part and matrix cell.
 const disk=[]
 for(const name of readdirSync(root).filter(x=>!process.argv.includes('--findings-only')&&/^(board|laptop)-(1280|1366|1920)-(light|dark)$/.test(x))){
  let data;try{data=JSON.parse(readFileSync(join(root,name,'coverage.json')))}catch{continue}
  if(data.parts.length!==58)continue
  await page.setViewportSize({width:data.viewport[0],height:data.viewport[1]})
  await fw(page,(w,id)=>{const dark=id.endsWith('-dark');w.S.layout.value=id.startsWith('board-')?'board':'laptop';w.S.uiTheme.value=dark?'dark':'light';w.board.setSurface({color:dark?'#22423a':'#ffffff',texture:dark?'chalk':'none'},false)},name)
  for(const p of data.parts){
   const result=await fw(page,async(w,a)=>{
    const part=w.apparatus.partOf(a.kind),params=a.settingActions?.at(-1)?.params??a.params
    const it=w.apparatus.newPart(part,800,450,.8,params);it.angle=.35
    w.board.doc.replaceAll([it]);w.board.refresh(null)
    const json=w.board.serialize(),path=await window.api.lessons.create('Audit '+a.kind,'Science')
    const saved=await window.api.lessons.save(path,json),file=await window.api.lessons.open(path)
    if(!file)return {saved,opened:false}
    w.board.load(file.json,{undoable:false});const loaded=w.board.doc.items.find(i=>i.t==='a')
    return {saved,opened:true,kind:loaded?.kind,paramsEqual:JSON.stringify(loaded?.params)===JSON.stringify(it.params),geometryEqual:loaded?.p.every((v,i)=>Math.abs(v-it.p[i])<=.011)&&loaded?.angle===it.angle,angle:loaded?.angle}
   },p)
   disk.push({configuration:name,kind:p.kind,...result})
  }
 }
 writeFileSync(join(folder,'disk-round-trips.json'),JSON.stringify(disk,null,2))
 console.log('Disk round trips:',disk.length,'failed:',disk.filter(x=>!x.saved?.ok||!x.opened||!x.paramsEqual||!x.geometryEqual).length)
}finally{writeFileSync(join(folder,'findings.json'),JSON.stringify(findings,null,2));await app.close()}
process.exit(0)
