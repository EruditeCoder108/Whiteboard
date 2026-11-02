// Exploratory audit of the real app. Evidence stays outside the repository.
// Build first, then: node e2e/tools-audit.mjs [board|laptop] [1280|1366|1920] [light|dark]
import { launch, fw, gesture } from './lib.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve('../audit-shots')
mkdirSync(root, { recursive: true })
const layouts = process.argv[2] ? [process.argv[2]] : ['board', 'laptop']
const sizes = process.argv[3] ? [Number(process.argv[3])] : [1280, 1366, 1920]
const themes = process.argv[4] ? [process.argv[4]] : ['light', 'dark']
const heights = { 1280: 720, 1366: 768, 1920: 1080 }
const onlyParts=process.env.FW_AUDIT_PARTS?.split(',')
const sheets = ['props', 'shapes', 'paper', 'settings', 'help', 'maths', 'export', 'lessons', 'new-lesson', 'shelf', 'scale', 'periodic', 'table', 'inputs', 'templates', 'zones', 'poll', 'agent', 'replay', 'science', 'equation', 'graph', 'recovery']
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

for (const layout of layouts) for (const width of sizes) for (const theme of themes) {
  const id = `${layout}-${width}-${theme}`, folder = join(root, id)
  mkdirSync(folder, { recursive: true })
  const evidence = onlyParts?JSON.parse(readFileSync(join(folder,'coverage.json'),'utf8')):{ id, viewport: [width, heights[width]], sheets: [], subjects: [], tiles: [], parts: [], errors: [], findings: [] }
  const { app, page, logs, userData } = await launch({ layout, inputIsolated: true })
  page.setDefaultTimeout(3500)
  const shot = async name => { await page.evaluate(()=>scrollTo(0,0));const file = join(folder, `${slug(name)}.png`); await page.screenshot({ path: file }); return file }
  const setPopover = async name => { await fw(page, (w, n) => { w.S.popover.value = n }, name); await page.waitForTimeout(65) }
  const scan = () => page.evaluate(() => {
    const out = []
    for (const box of document.querySelectorAll('.popover,.chooser-card,.agent-panel,.replay-panel,.board-sheet,.apparatus-tray,.selection-tools,.class-tool,.calculator,.scale-sheet,.periodic-sheet')) {
      const r = box.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) out.push({ type: 'panel-outside', cls: box.className, rect: [r.x,r.y,r.width,r.height] })
      if (box.scrollWidth > box.clientWidth + 2) out.push({ type: 'horizontal-overflow', cls: box.className, width: [box.scrollWidth, box.clientWidth] })
    }
    for (const el of document.querySelectorAll('.ui button span,.ui .pop-title,.ui .pop-sub,.ui .part-tile span')) {
      const r = el.getBoundingClientRect(), text = el.textContent.trim()
      if (r.width && r.height && text && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.push({ type:'text-clipped', text })
    }
    return out
  })
  const saveEvidence = () => writeFileSync(join(folder, 'coverage.json'), JSON.stringify({ ...evidence, logs, userData }, null, 2))
  const closeTools = async () => {
    await page.keyboard.press('Escape')
    const cancelCapture=page.locator('.capture-shade').getByRole('button',{name:'Cancel',exact:true})
    if(await cancelCapture.isVisible().catch(()=>false)) await cancelCapture.click()
    for (const name of ['Close apparatus','Close the calculator','Close timer','Close the clock','Close the magnifier','Close the name picker','Close the dice','Close the scoreboard']) {
      const button = page.getByRole('button', { name, exact: true })
      if (await button.isVisible().catch(() => false)) await button.click().catch(() => {})
    }
    await fw(page,w => { w.S.zones.value=0; w.S.uiHidden.value=false; w.S.passthrough.value=false; w.S.popover.value=null; w.board.setSelection([]) })
  }
  const openTray = async subject => {
    await closeTools()
    if (layout === 'board') { await setPopover('board-menu'); await page.getByRole('button', {name:'Apparatus',exact:true}).click() }
    else { await setPopover('insert'); await page.getByRole('button', {name:/^Apparatus/}).click() }
    await page.locator('.tray-tabs').getByRole('tab',{name:subject,exact:true}).click()
  }
  try {
    await app.evaluate(({BrowserWindow},s)=>{const w=BrowserWindow.getAllWindows()[0];w.setFullScreen(false);w.setBounds({x:4000,y:40,width:s[0],height:s[1]})}, evidence.viewport)
    await page.setViewportSize({width,height:heights[width]})
    await fw(page,(w,a)=>{w.S.uiTheme.value=a.theme;w.board.convertTo('notebook');w.board.setSurface({color:a.theme==='dark'?'#22423a':'#ffffff',texture:a.theme==='dark'?'chalk':'none'},false);w.board.setTool('select')},{theme})
    await page.waitForTimeout(150)
    evidence.actualViewport = await page.evaluate(()=>[innerWidth,innerHeight])
    await shot('start')

    // Open every More tile in the real board menu. Native file pickers receive a fixture,
    // while minimise/exit are intercepted in the throw-away app so the audit can continue.
    if (layout === 'board'&&!onlyParts) {
      await setPopover('board-menu')
      const tiles = await page.locator('.board-sheet .tile').allTextContents()
      await shot('more')
      for (const label of tiles.map(x=>x.trim())) {
        await closeTools(); await setPopover('board-menu')
        const result = { label }
        try {
          const chooserLabels=['Picture','PDF / worksheet','PowerPoint','Video / audio']
          if (chooserLabels.includes(label)) {
            const chooser = page.waitForEvent('filechooser').catch(()=>null)
            await page.getByRole('button',{name:label,exact:true}).click()
            const picker=await chooser
            if(!picker) throw new Error('File chooser did not open')
            await picker.setFiles([])
            result.result='file chooser opened and cancelled'
          } else if (label === 'Save a copy…') {
            await app.evaluate(({dialog},p)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:p})},join(userData,'audit-copy.wbd'))
            await page.getByRole('button',{name:label,exact:true}).click()
            result.result='save dialog accepted in temporary profile'
          } else if (label === 'Exit' || label === 'Minimise') {
            await app.evaluate(({BrowserWindow},what)=>{const w=BrowserWindow.getAllWindows()[0];w['auditOriginal'+what]=w[what].bind(w);w[what]=()=>{}},label==='Exit'?'close':'minimize')
            await page.getByRole('button',{name:label,exact:true}).click()
            result.result='window action invoked (intercepted in audit)'
          } else {
            await page.getByRole('button',{name:label,exact:true}).click()
            await page.waitForTimeout(90)
            result.result='opened'; result.scan=await scan(); result.screenshot=await shot(`tile-${label}`)
          }
        } catch(e) { result.error=String(e).slice(0,500) }
        evidence.tiles.push(result); saveEvidence()
        // Layout/conversion/overlay actions are restored for the next tile.
        await fw(page,(w,l)=>{w.S.layout.value=l;w.S.bgAlpha.value=100;w.S.preparing.value=false;w.S.uiHidden.value=false;w.board.convertTo('notebook')},layout)
      }
    }

    for (const name of onlyParts?[]:[layout==='board'?'board-menu':'menu',...(layout==='laptop'?['insert','present']:['pages','subjects']),...sheets]) {
      await closeTools(); await setPopover(name)
      evidence.sheets.push({ name, scan: await scan(), screenshot: await shot(`sheet-${name}`), text: (await page.locator('.ui').allTextContents()).join(' ').slice(0,1200) })
    }
    if (layout==='board'&&!onlyParts) for (const name of ['Maths','Physics','Chemistry','Biology','English','Hindi']) {
      await setPopover('subjects'); await page.getByRole('tab',{name,exact:true}).click()
      evidence.subjects.push({name,tools:await page.locator('.subjects-sheet .tile').allTextContents(),scan:await scan(),screenshot:await shot(`subject-${name}`)})
    }

    // All cupboard parts, through the actual Take out and Settings buttons.
    for (const subject of ['Physics','Chemistry','Biology']) {
      await openTray(subject)
      const buttons = await page.locator('.part-tile').evaluateAll(bs=>bs.map(b=>b.getAttribute('aria-label')))
      evidence[`${subject.toLowerCase()}Count`] = buttons.length
      await shot(`cupboard-${subject}`)
      for (const label of buttons.filter(label=>!onlyParts||evidence.parts.some(p=>p.label===label&&onlyParts.includes(p.kind)))) {
        const result = { subject, label, settingActions: [], controlActions: [], settingWarnings: [] }
        try {
          await fw(page,w=>{w.board.doc.replaceAll([]);w.board.setSelection([]);w.board.refresh(null);w.board.setTool('select')})
          if (!(await page.locator('.apparatus-tray').isVisible())) await openTray(subject)
          await page.getByRole('button',{name:label,exact:true}).click()
          await page.getByRole('button',{name:'Close apparatus',exact:true}).click()
          const meta=await fw(page,w=>{
            const it=w.board.doc.items.find(i=>i.t==='a'),p=w.apparatus.partOf(it.kind),v=w.board.view,r=w.board.visibleRect()
            // Centre the real inserted part in the free teaching area; this is fixture setup.
            const k=Math.min(1,(r[3]-r[1])*.5/p.h,(r[2]-r[0])*.55/p.w),cx=(r[0]+r[2])/2,cy=r[1]+(r[3]-r[1])*.51
            const moved={...it,p:[cx-p.w*k/2,cy-p.h*k/2,cx+p.w*k/2,cy+p.h*k/2]}
            w.board.doc.replaceAll([moved]);w.board.setSelection([]);w.board.refresh(null)
            return {kind:p.kind,name:p.name,w:p.w,h:p.h,params:{...moved.params},settings:p.settings?.map(s=>({key:s.key,label:s.label,min:s.min,max:s.max,step:s.step,toggle:s.toggle,choices:s.choices})),controls:p.controls?.map(t=>({name:t.name,drag:!!t.drag,tap:!!t.tap}))}
          })
          Object.assign(result,meta)
          const local = (x,y)=>fw(page,(w,a)=>{const it=w.board.doc.items.find(i=>i.t==='a'),p=w.apparatus.partOf(it.kind),v=w.board.view;return[(it.p[0]+a[0]/p.w*(it.p[2]-it.p[0])-v.x)*v.zoom,(it.p[1]+a[1]/p.h*(it.p[3]-it.p[1])-v.y)*v.zoom]},[x,y])
          result.screenshot=await shot(`part-${meta.kind}`)
          for(let i=0;i<(meta.controls?.length??0);i++) {
            const ctrl=meta.controls[i], xy=await fw(page,(w,i)=>{const it=w.board.doc.items.find(x=>x.t==='a');return w.apparatus.partOf(it.kind).controls[i].at(it.params)},i)
            const a=await local(...xy), before=await fw(page,w=>({...w.board.doc.items.find(i=>i.t==='a').params}))
            if(ctrl.drag) await gesture(page,[a,[a[0]+24,a[1]+30]],{gap:0})
            else await gesture(page,[a],{gap:0})
            await page.waitForTimeout(45)
            const after=await fw(page,w=>({...w.board.doc.items.find(i=>i.t==='a').params}))
            result.controlActions.push({name:ctrl.name,before,after})
            if(width===1280) await shot(`control-${meta.kind}-${i}`)
            await fw(page,w=>{w.board.undo();w.board.setSelection([])})
          }
          for(let i=0;i<(meta.settings?.length??0);i++) {
            const setting=meta.settings[i]
            const values=setting.choices?setting.choices.map((_,j)=>j):setting.toggle?[1,0]:[setting.min,setting.max]
            for(const value of values) {
              await fw(page,w=>{w.board.setSelection(w.board.doc.items.filter(i=>i.t==='a'))})
              const options=page.locator('.part-options')
              if(!(await options.isVisible())) await page.getByRole('button',{name:'Change its settings',exact:true}).click()
              if(setting.choices) await options.getByRole('button',{name:setting.choices[value],exact:true}).click()
              else if(setting.toggle) { const toggle=options.locator('label').filter({hasText:setting.label}).getByRole('switch'); const on=await toggle.getAttribute('aria-checked');if((on==='true')!==!!value){try{await toggle.click({timeout:900})}catch(e){result.settingWarnings.push({key:setting.key,error:String(e).slice(0,600),screenshot:await shot(`blocked-${meta.kind}-${setting.key}`)});await toggle.focus();await toggle.press('Space')}} }
              else { const slider=options.getByRole('slider',{name:setting.label,exact:true});await slider.fill(String(value));await slider.dispatchEvent('change') }
              await page.waitForTimeout(20)
              result.settingActions.push({key:setting.key,value,params:await fw(page,w=>({...w.board.doc.items.find(i=>i.t==='a').params})),scan:await scan()})
              // Every selected state is captured for biological labels, liquids and extreme scales.
              if(width===1280) await shot(`state-${meta.kind}-${setting.key}-${value}`)
            }
          }
          await page.keyboard.press('Escape')
          await fw(page,w=>{w.board.setSelection(w.board.doc.items.filter(i=>i.t==='a'))})
          // Drag the selected object's empty upper-left margin, then its corner and rotation grip.
          const beforeMove=await fw(page,w=>w.board.doc.items.find(i=>i.t==='a').p)
          await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown')
          result.moved=await fw(page,(w,p)=>w.board.doc.items.find(i=>i.t==='a').p.join()!==p.join(),beforeMove)
          await fw(page,w=>{w.board.setSelection(w.board.doc.items.filter(i=>i.t==='a'))})
          const corner=await local(meta.w,meta.h),beforeResize=await fw(page,w=>w.board.doc.items.find(i=>i.t==='a').p)
          await gesture(page,[corner,[corner[0]+24,corner[1]+12]],{gap:0,shift:true})
          result.resized=await fw(page,(w,p)=>{const q=w.board.doc.items.find(i=>i.t==='a').p;return Math.abs((q[2]-q[0])-(p[2]-p[0]))>.1},beforeResize)
          await fw(page,w=>{w.board.setSelection(w.board.doc.items.filter(i=>i.t==='a'))})
          const top=await local(meta.w/2,0)
          await gesture(page,[[top[0],top[1]-28],[top[0]+50,top[1]-3]],{gap:0})
          result.rotated=await fw(page,w=>Math.abs(w.board.doc.items.find(i=>i.t==='a').angle??0)>.01)
          await fw(page,w=>w.board.undo())
          result.undoAngle=await fw(page,w=>w.board.doc.items.find(i=>i.t==='a').angle??0)
          result.finalScreenshot=await shot(`manipulated-${meta.kind}`)
          result.roundTrip=await fw(page,w=>{const stable=(v,key)=>Array.isArray(v)?v.map(x=>key==='p'&&typeof x==='number'?Math.round(x*100)/100:stable(x)):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,stable(v[k],k)])):v;const json=w.board.serialize(),before=JSON.stringify(stable(w.board.doc.items));w.board.load(json,{undoable:false});const after=JSON.stringify(stable(w.board.doc.items));return {equal:before===after,...(before===after?{}:{before,after})}})
        } catch(e) { result.error=String(e).slice(0,700);await shot(`error-${result.kind??label}`).catch(()=>{}) }
        const existing=evidence.parts.findIndex(p=>p.label===result.label)
        if(existing>=0)evidence.parts[existing]=result;else evidence.parts.push(result)
        saveEvidence()
        console.log(`${id} ${evidence.parts.length} ${result.kind??label}${result.error?' ERROR '+result.error.slice(0,160):''}`)
      }
    }
    await closeTools()
    evidence.errors=logs.filter(x=>/pageerror|\[error\]/.test(x))
    evidence.completed=true
  } catch(e) { evidence.fatal=String(e); console.error(id,e) }
  finally { saveEvidence();await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())for(const what of ['close','minimize'])if(w['auditOriginal'+what])w[what]=w['auditOriginal'+what]}).catch(()=>{});await app.close().catch(()=>{}) }
  console.log(`${id}: ${evidence.parts.length} parts, ${evidence.sheets.length} sheets, ${evidence.tiles.length} tiles`)
}
process.exit(0)
