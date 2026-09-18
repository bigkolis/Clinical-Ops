import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const PROTOCOL='CL04041109';
const PRODUCT='Placebo';
const FOOTER='Только для клинических исследований';

const norm=s=>String(s??'').replace(/\s+/g,' ').trim();
const uniq=a=>[...new Set(a.map(norm).filter(Boolean))];
const xmlEscape=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m]));
const safeName=s=>String(s||'labels').replace(/[^a-z0-9._-]+/gi,'_');

function candidateHeaderIndex(headers){
  const patterns=[
    /kit\s*(label|number|no|id)/i,
    /(individual|randomization)\s*(number|no|id)/i,
    /label\s*(number|no|id)?/i,
    /(номер|код).*(набора|этикетки|индивидуаль)/i
  ];
  for(const p of patterns){const i=headers.findIndex(h=>p.test(norm(h))); if(i>=0)return i;}
  return -1;
}

function plausibleToken(v){
  const s=norm(v);
  if(!s||s.length>32||/\s/.test(s))return false;
  if(/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(s))return false;
  if(/^CL\d{6,}$/i.test(s))return false;
  if(/^(placebo|batch|manufactured|manufacturing|expiry|exp|mfg|subcutaneous|protocol|visit|site)$/i.test(s))return false;
  if(!/^[A-Za-zА-Яа-я0-9_-]+$/.test(s))return false;
  return /\d/.test(s);
}

function extractFromRows(rows){
  if(!rows.length)return [];
  const headers=Object.keys(rows[0]||{});
  const idx=candidateHeaderIndex(headers);
  if(idx>=0){
    const key=headers[idx];
    return uniq(rows.map(r=>r[key]).filter(v=>norm(v)));
  }
  const candidates=[];
  for(const r of rows) for(const v of Object.values(r)) if(plausibleToken(v)) candidates.push(norm(v));
  const counts=new Map(); candidates.forEach(x=>counts.set(x,(counts.get(x)||0)+1));
  return uniq(candidates.filter(x=>(counts.get(x)||0)<=3));
}

async function importExcel(file){
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array',cellDates:false});
  const ids=[];
  for(const sheetName of wb.SheetNames){
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
    ids.push(...extractFromRows(rows));
  }
  return uniq(ids);
}

function textOf(node){
  return [...node.getElementsByTagNameNS('*','t')].map(x=>x.textContent||'').join('').trim();
}

async function importDocx(file){
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const xmlFile=zip.file('word/document.xml');
  if(!xmlFile)throw new Error('This Word file does not contain word/document.xml');
  const xml=await xmlFile.async('text');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  const tableRows=[...doc.getElementsByTagNameNS('*','tr')].map(tr=>[...tr.getElementsByTagNameNS('*','tc')].map(textOf));
  if(tableRows.length){
    const headers=tableRows[0]||[];
    const idx=candidateHeaderIndex(headers);
    if(idx>=0)return uniq(tableRows.slice(1).map(r=>r[idx]).filter(Boolean));
  }
  const chunks=[];
  [...doc.getElementsByTagNameNS('*','p')].forEach(p=>{const t=textOf(p); if(t)chunks.push(t);});
  tableRows.flat().forEach(t=>{if(t)chunks.push(t);});
  const candidates=chunks.flatMap(t=>t.split(/[\s,;|]+/)).map(norm).filter(plausibleToken);
  const counts=new Map(); candidates.forEach(x=>counts.set(x,(counts.get(x)||0)+1));
  return uniq(candidates.filter(x=>(counts.get(x)||0)<=3));
}

export async function importLabelFile(file){
  const name=String(file?.name||'').toLowerCase();
  let ids=[];
  if(name.endsWith('.xlsx')||name.endsWith('.xls')) ids=await importExcel(file);
  else if(name.endsWith('.docx')) ids=await importDocx(file);
  else throw new Error('Supported label imports: .xlsx, .xls and .docx');
  return {ids:uniq(ids),source:file.name};
}

export function exportLabelExcel(job){
  if(!job.ids?.length)throw new Error('No label IDs loaded');
  const wb=XLSX.utils.book_new();
  let aoa;
  if(job.layout==='80x60'){
    aoa=[['Protocol','Product','Batch','Manufactured','Expiry','Layout',...Array.from({length:10},(_,i)=>`Label ${i+1}`)]];
    for(let i=0;i<job.ids.length;i+=10) aoa.push([PROTOCOL,PRODUCT,job.batch,job.mfg,job.exp,'80×60 mm',...job.ids.slice(i,i+10)]);
  }else{
    aoa=[['Protocol','Product','Batch','Manufactured','Expiry','Layout','Label ID'],...job.ids.map(id=>[PROTOCOL,PRODUCT,job.batch,job.mfg,job.exp,'20×40 mm',id])];
  }
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:15},{wch:12},{wch:12},{wch:14},{wch:14},{wch:12},...Array.from({length:10},()=>({wch:14}))];
  XLSX.utils.book_append_sheet(wb,ws,'Labels');
  XLSX.writeFile(wb,`Clinical_Ops_Labels_${job.layout}.xlsx`);
}

function wp(text,{bold=false,size=16,align='center'}={}){
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}
function tableXml(ids){
  const cells=[...ids]; while(cells.length<10)cells.push('');
  const rows=[];
  for(let i=0;i<10;i+=2){rows.push(`<w:tr>${[cells[i],cells[i+1]].map(x=>`<w:tc><w:tcPr><w:tcW w:w="2100" w:type="dxa"/></w:tcPr>${wp(x,{bold:true,size:18})}</w:tc>`).join('')}</w:tr>`);}
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>${rows.join('')}</w:tbl>`;
}
function wordPage(group,job){
  const meta=`Batch ${job.batch} · Mfg ${job.mfg} · Exp ${job.exp}`;
  if(job.layout==='80x60') return `${wp(`${PROTOCOL} · ${PRODUCT}`,{bold:true,size:20})}${wp(meta,{size:14})}${tableXml(group)}${wp(FOOTER,{size:12})}`;
  return `${wp(`${PROTOCOL} · ${PRODUCT}`,{bold:true,size:16})}${wp(meta,{size:9})}${wp(group[0]||'',{bold:true,size:26})}${wp(FOOTER,{size:8})}`;
}

export async function exportLabelWord(job){
  if(!job.ids?.length)throw new Error('No label IDs loaded');
  const zip=new JSZip();
  const groups=job.layout==='80x60'?Array.from({length:Math.ceil(job.ids.length/10)},(_,i)=>job.ids.slice(i*10,i*10+10)):job.ids.map(x=>[x]);
  const page=job.layout==='80x60'?{w:4535,h:3402,m:170}:{w:2268,h:1134,m:55};
  const body=groups.map((g,i)=>wordPage(g,job)+(i<groups.length-1?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'')).join('');
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="${page.w}" w:h="${page.h}"/><w:pgMar w:top="${page.m}" w:right="${page.m}" w:bottom="${page.m}" w:left="${page.m}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml',documentXml);
  const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  downloadBlob(blob,`Clinical_Ops_Labels_${job.layout}.docx`);
}

function drawCanvas(group,job){
  const mm=12, w=job.layout==='80x60'?80:40, h=job.layout==='80x60'?60:20;
  const c=document.createElement('canvas'); c.width=w*mm; c.height=h*mm;
  const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.strokeStyle='#111'; x.lineWidth=2; x.strokeRect(2,2,c.width-4,c.height-4); x.fillStyle='#111'; x.textAlign='center'; x.textBaseline='middle';
  if(job.layout==='80x60'){
    x.font='bold 28px Arial, sans-serif'; x.fillText(`${PROTOCOL} · ${PRODUCT}`,c.width/2,34);
    x.font='18px Arial, sans-serif'; x.fillText(`Batch ${job.batch} · Mfg ${job.mfg} · Exp ${job.exp}`,c.width/2,66);
    const vals=[...group]; while(vals.length<10)vals.push('');
    x.font='bold 26px Arial, sans-serif';
    vals.forEach((v,i)=>{const col=i%2,row=Math.floor(i/2); x.fillText(v,(col+.5)*c.width/2,120+row*88);});
    x.font='16px Arial, sans-serif'; x.fillText(FOOTER,c.width/2,c.height-25);
  }else{
    x.font='bold 16px Arial, sans-serif'; x.fillText(`${PROTOCOL} · ${PRODUCT}`,c.width/2,20);
    x.font='11px Arial, sans-serif'; x.fillText(`Batch ${job.batch} · ${job.mfg} · ${job.exp}`,c.width/2,43);
    x.font='bold 34px Arial, sans-serif'; x.fillText(group[0]||'',c.width/2,c.height/2+8);
    x.font='10px Arial, sans-serif'; x.fillText(FOOTER,c.width/2,c.height-14);
  }
  return c;
}

export function exportLabelPdf(job){
  if(!job.ids?.length)throw new Error('No label IDs loaded');
  const w=job.layout==='80x60'?80:40,h=job.layout==='80x60'?60:20;
  const orientation=w>=h?'landscape':'portrait';
  const pdf=new jsPDF({orientation,unit:'mm',format:[w,h],compress:true});
  const groups=job.layout==='80x60'?Array.from({length:Math.ceil(job.ids.length/10)},(_,i)=>job.ids.slice(i*10,i*10+10)):job.ids.map(x=>[x]);
  groups.forEach((g,i)=>{if(i)pdf.addPage([w,h],orientation); const canvas=drawCanvas(g,job); pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,w,h,undefined,'FAST');});
  pdf.save(`Clinical_Ops_Labels_${job.layout}.pdf`);
}

function downloadBlob(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=safeName(name); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
