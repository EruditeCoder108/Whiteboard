const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const masters = path.resolve(process.argv[2] || '../art-masters');
const out = path.resolve(__dirname, '../src/renderer/src/assets/art');
const svg = s => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">${s}</svg>`);
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const sources=JSON.parse(fs.readFileSync(path.join(masters,'sheet-sources.json'),'utf8'));
  const entries=sources.filter(e=>e.name!=='paper-blank').map(e=>({...e,master:e.name}));
  for(const name of ['paper-squared','paper-graph','paper-ruled','paper-fourline','paper-hindi','pdf-worksheet']) {
    const existing=entries.findIndex(e=>e.name===name); if(existing>=0)entries.splice(existing,1);
    entries.push({...sources.find(e=>e.name==='paper-blank'),name,master:'paper-blank'});
  }
  for(const [name,master]of [['redo','undo'],['page-next','page-back']])entries.push({...sources.find(e=>e.name===master),name,master,mirror:true});
  const records=[];
  const only=process.argv[3];
  for(const e of entries.filter(e=>!only||e.name===only)) {
    const isReplacement=['dice','spotlight'].includes(e.name);
    let input=path.join(masters,isReplacement?e.name+'-replacement.png':e.master+'.png');
    const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(const x of [0,info.width-1])for(const y of [0,info.height-1])if(data[(y*info.width+x)*4+3]!==0)throw Error(e.name+': nontransparent corner');
    let buf=await sharp(input).resize(1024,1024,{fit:'contain',background:'#00000000'}).png().toBuffer();
    let edited=e.edited;
    if(e.name.startsWith('subject-')&&['subject-english','subject-hindi'].includes(e.name)) {
      const glyph=e.name==='subject-hindi'?'अ':'A';
      const fontfile=e.name==='subject-hindi'?'C:/Windows/Fonts/Nirmala.ttc':'C:/Windows/Fonts/segoeui.ttf';
      const letter=await sharp({text:{text:glyph,font:e.name==='subject-hindi'?'Nirmala UI 440':'Segoe UI 440',fontfile,rgba:true}}).png().toBuffer();
      const m=await sharp(letter).metadata();
      const tinted=await sharp(letter).negate({alpha:false}).tint('#f4e5cb').png().toBuffer();
      buf=await sharp(buf).composite([{input:svg('<rect x="145" y="150" width="730" height="720" rx="20" fill="#2d383c"/>')},{input:tinted,left:Math.floor((1024-m.width)/2),top:Math.floor((1024-m.height)/2)}]).png().toBuffer();
      edited+=' Generated glyph covered; exact '+glyph+' composited using '+fontfile.split('/').pop()+'.';
    }
    if(e.master==='paper-blank') {
      let lines=''; const line=(x,y,x2,y2,c='#5584ab',dash=false)=>{lines+=`<path d="M${x} ${y}L${x2} ${y2}" fill="none" stroke="${c}" stroke-width="5" ${dash?'stroke-dasharray="14 12"':''}/>`};
      if(e.name==='paper-squared'||e.name==='paper-graph') {
        const step=e.name==='paper-graph'?32:100;
        for(let a=220;a<830;a+=step){line(190,a,825,a);line(a,205,a,840)}
      } else if(e.name==='paper-fourline') {
        for(let y=240;y<800;y+=210)for(let i=0;i<4;i++)line(190,y+i*36,825,y+i*36,i===2?'#c15e60':'#5584ab');
      } else if(e.name==='paper-hindi') {
        for(let y=240;y<800;y+=200){line(190,y,825,y,'#c15e60');line(190,y+90,825,y+90,'#5584ab',true)}
      } else {for(let y=250;y<840;y+=100)line(190,y,825,y,e.name==='pdf-worksheet'?'#93999c':'#5584ab')}
      const clipped=await sharp(svg(lines)).composite([{input:buf,blend:'dest-in'}]).png().toBuffer();
      buf=await sharp(buf).composite([{input:clipped}]).png().toBuffer();edited+=' Exact preview guides composited in code.';
    }
    if(e.mirror){buf=await sharp(buf).flop().png().toBuffer();edited+=' Mirrored horizontally.'}
    const wide=/^(empty-|welcome-)/.test(e.name);
    // Alpha trim, then a consistent transparent margin, at the committed output size.
    let image=sharp(buf).trim({background:'#00000000',threshold:0});
    const target=wide?[640,360]:[192,192];
    const inner=await image.resize(target[0]-16,target[1]-16,{fit:'inside'}).png().toBuffer();
    const im=await sharp(inner).metadata();
    const file=path.join(out,e.name+'.webp');
    await sharp({create:{width:target[0],height:target[1],channels:4,background:'#00000000'}}).composite([{input:inner,left:Math.floor((target[0]-im.width)/2),top:Math.floor((target[1]-im.height)/2)}]).webp({quality:82,alphaQuality:100,effort:6}).toFile(file);
    if(fs.statSync(file).size>30000&&!wide)throw Error(e.name+': icon exceeds 30 KB');
    const replacement=isReplacement?JSON.parse(fs.readFileSync(path.join(masters,e.name+'-replacement.json'),'utf8')):null;
    records.push(`### ${e.name}.webp\n- Tool: ${replacement?.tool||e.tool}\n- Date: 2026-11-01\n- Source: ${replacement?'New replacement generated in this session':e.source+'; crop '+e.rect.join(', ')+'; SHA-256 '+e.sourceSha256}\n- Prompt: ${replacement?replacement.prompt:'Original generation prompt not supplied by owner. Subject brief: '+e.name+'. Shared direction: familiar front-facing classroom objects, bold silhouette, minimal detail, warm matte colours, transparent background.'}\n- Edited: ${edited}${replacement?' Replaces the supplied picture after visual review.':''}\n`);
  }
  const sourceFile=path.join(out,'SOURCES.md');
  let document='# Artwork sources\n\nOwner supplied ten ChatGPT-generated transparent sheets on 1 November 2026 and explicitly authorised cropping, corrections and use in this GPL-3.0 app. No Note 3 assets were used. Original sheets and 1024px padded masters are outside the repository. Original prompts for supplied sheets are unknown, so subject briefs below are not claimed as their actual prompts. T and Σ were checked visually. New-feature art is intentionally reserved for the lead.\n\n'+records.join('\n');
  if(only) document=fs.readFileSync(sourceFile,'utf8').replace(/\r\n/g,'\n').replace(new RegExp('### '+only+'\\.webp\\n[\\s\\S]*?(?=\\n### |$)'),records[0]);
  document=document.replace(' Replaces the supplied picture after visual review.',' Replaces the supplied picture after visual review.');
  fs.writeFileSync(sourceFile,document.replace(/\r?\n/g,'\r\n'));
  const files=fs.readdirSync(out).filter(n=>n.endsWith('.webp'));const bytes=files.reduce((s,n)=>s+fs.statSync(path.join(out,n)).size,0);
  if(bytes>=3000000)throw Error('Art exceeds 3 MB');console.log(files.length+' images, '+bytes+' bytes');
}
main().catch(e=>{console.error(e);process.exitCode=1});
