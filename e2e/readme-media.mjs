// Documentation capture only: synthetic content and an isolated profile.
// Build first. ffmpeg encodes the numbered PNG frames into a GitHub-friendly GIF.
import { launch, fw, appDir } from './lib.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const assets = join(appDir, 'docs/assets/readme'), frames = join(appDir, '.work/readme-frames')
mkdirSync(assets, {recursive:true}); mkdirSync(frames, {recursive:true})
const {app,page}=await launch({inputIsolated:true})
const writePng = (name, data) => writeFileSync(name,Buffer.from(data.replace(/^data:image\/png;base64,/,''),'base64'))
try {
  await app.evaluate(({BrowserWindow}) => {const w=BrowserWindow.getAllWindows()[0];w.setSize(1280,800);w.hide()})
  await page.route(/^https?:\/\//, route=>route.abort())
  await fw(page,w=>{
    w.S.radialEnabled.value=false;w.board.setColor('#fbfcff');w.board.setPaper('none')
    w.board.setView({x:0,y:0,zoom:1});w.board.setTool('select')
    let n=0
    const add=it=>w.board.commitAdd({...it,id:`readme-sample-${++n}`,w:it.w??1,c:it.c??'#17263e'})
    const text=(value,p,size,color='#17263e',bold=false)=>add({t:'t',text:value,p,fontSize:size,bold,textColor:color,note:false})
    text('A little sketch. A clearer idea.',[120,115,1150,174],43,'#17263e',true)
    text('A board for the way you think, teach and explain.',[122,187,1100,222],21,'#61708a')
    for(const [i,title,body,color,fill] of [[0,'Observe','Notice the pattern.','#4466dd','#edf1ff'],[1,'Predict','Try a different idea.','#127e84','#e8f5f2'],[2,'Explain','Make it click.','#9a6428','#fff4dd']]){
      const x=120+i*350
      add({t:'h',k:'rect',p:[x,300,x+270,460],radius:18,fill,c:color,w:1.5})
      text(title,[x+24,329,x+245,367],29,color,true)
      text(body,[x+24,386,x+248,423],19,'#526178')
      if(i<2)add({t:'h',k:'arrow',p:[x+285,380,x+332,380],c:'#94a4bb',w:2.5})
    }
    const points=[]
    for(let i=0;i<78;i++)points.push(125+i*3.1,258+Math.sin(i*.12)*3.3,0.35+0.4*Math.sin(i/77*Math.PI))
    add({t:'s',p:points,w:5,c:'#5269ee',m:false,v:true})
    text('Draw naturally. Keep everything editable.',[122,540,1110,585],28,'#17263e',true)
    text('Pen · mouse · touch     /     Undo · save · record · replay',[123,595,1120,633],18,'#61708a')
    w.board.setSelection([]);w.board.refresh(null)
  })
  const screenshot=await app.evaluate(async({BrowserWindow,screen})=>{
    const win=BrowserWindow.getAllWindows()[0],outside=Math.max(...screen.getAllDisplays().map(d=>d.bounds.x+d.bounds.width))+200
    win.setPosition(outside,40);win.setFocusable(false);win.setIgnoreMouseEvents(true);win.showInactive()
    await new Promise(r=>setTimeout(r,220))
    const result=(await win.capturePage(undefined,{stayAwake:true})).toPNG().toString('base64');win.hide();return result
  })
  writePng(join(assets,'whiteboard.png'),screenshot)
  const sequence=[['flux-studio',4.8,40],['indicator-studio',16,50],['heart-studio',2.0,30]]
  let index=0
  for(const [model,duration,count] of sequence){
    for(let frame=0;frame<count;frame++){
      const time=duration*frame/(count-1)
      const image=await fw(page,(w,{model,time})=>{
        const m=w.science.models.find(m=>m.id===model),c=document.createElement('canvas');c.width=960;c.height=614
        const ctx=c.getContext('2d');ctx.fillStyle='#102733';ctx.fillRect(0,0,c.width,c.height);ctx.save();ctx.scale(.96,.96)
        w.science.paintLab(ctx,{t:'l',id:'readme-demo',model,labVersion:1,modelVersion:1,p:[0,0,1000,640],w:1,c:'#007c88',params:{...m.defaults},frozenTime:0,theme:'blueprint',reveal:{graphs:true,vectors:true,trajectory:true,strobes:true,energy:true,equations:true,compare:false}},time)
        ctx.restore();return c.toDataURL()
      },{model,time})
      writePng(join(frames,`${String(index++).padStart(4,'0')}.png`),image)
      if(frame===Math.floor(count*.55))writePng(join(assets,`${model}.png`),image)
    }
  }
  console.log(JSON.stringify({frames:index,source:'native paintLab renderer',profile:'disposable',network:'blocked',assets:'docs/assets/readme'},null,2))
}finally{await app.close()}
