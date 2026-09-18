import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const norm=s=>String(s??'').replace(/\s+/g,' ').trim();
const xmlEscape=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m]));
const safeName=s=>String(s||'report').replace(/[^a-z0-9._-]+/gi,'_');

function detectFields(text){
  const t=String(text||'');
  const find=(patterns)=>{for(const p of patterns){const m=t.match(p);if(m?.[1])return norm(m[1]);}return '';};
  return {
    visit:find([/(?:IMV|Visit)\s*(?:#|No\.?|№)?\s*[:\-]?\s*(\d{1,3})/i,/номер\s+визита\s*[:\-]?\s*(\d{1,3})/i]),
    site:find([/(?:Site|Center)\s*(?:#|No\.?|№)?\s*[:\-]?\s*([A-Za-z0-9_-]+)/i,/(?:сайт|центр)\s*(?:№)?\s*[:\-]?\s*([A-Za-z0-9_-]+)/i]),
    dates:find([/(?:Visit dates?|Dates?)\s*[:\-]\s*([^\n\r]{5,40})/i,/(?:даты? визита|даты?)\s*[:\-]\s*([^\n\r]{5,40})/i]),
    monitor:find([/(?:Monitor|CRA)\s*[:\-]\s*([^\n\r]{2,80})/i,/(?:монитор)\s*[:\-]\s*([^\n\r]{2,80})/i])
  };
}

function textOf(node){return [...node.getElementsByTagNameNS('*','t')].map(x=>x.textContent||'').join('').trim();}

async function importDocx(file){
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const xmlFile=zip.file('word/document.xml');
  if(!xmlFile)throw new Error('This Word file does not contain word/document.xml');
  const xml=await xmlFile.async('text');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  const blocks=[];
  [...doc.getElementsByTagNameNS('*','p')].forEach(p=>{const t=textOf(p);if(t)blocks.push(t);});
  const text=blocks.join('\n');
  return {...detectFields(text),summary:text,source:file.name,sourceType:'Word'};
}

async function importExcel(file){
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array',cellDates:false});
  const lines=[];
  for(const name of wb.SheetNames){
    const ws=wb.Sheets[name];
    const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    for(const row of aoa){const vals=row.map(norm).filter(Boolean);if(vals.length)lines.push(vals.join(' | '));}
  }
  const text=lines.join('\n');
  return {...detectFields(text),summary:text,source:file.name,sourceType:'Excel'};
}

export async function importReportFile(file){
  const name=String(file?.name||'').toLowerCase();
  if(name.endsWith('.docx'))return importDocx(file);
  if(name.endsWith('.xlsx')||name.endsWith('.xls'))return importExcel(file);
  throw new Error('Supported report imports: .docx, .xlsx and .xls');
}

function reportRows(job){
  return [
    ['Protocol','CL04041383'],
    ['Site',job.site||''],
    ['Visit / IMV',job.visit||''],
    ['Visit dates',job.dates||''],
    ['Monitor',job.monitor||''],
    ['Source',job.source||''],
    ['Summary',job.summary||'']
  ];
}

export function exportReportExcel(job){
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(reportRows(job));
  ws['!cols']=[{wch:18},{wch:100}];
  XLSX.utils.book_append_sheet(wb,ws,'Monitoring Report');
  XLSX.writeFile(wb,`CL04041383_Site_${safeName(job.site||'NA')}_IMV_${safeName(job.visit||'NA')}.xlsx`);
}

function wp(text,{bold=false,size=22,align='left'}={}){
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

export async function exportReportWord(job){
  const zip=new JSZip();
  const summary=String(job.summary||'').split(/\r?\n/).filter(Boolean).map(x=>wp(x,{size:20})).join('');
  const body=[
    wp('Interim Monitoring Visit Report',{bold:true,size:34,align:'center'}),
    wp('Protocol CL04041383',{bold:true,size:22,align:'center'}),
    wp(`Site: ${job.site||'—'}`,{bold:true}),
    wp(`IMV / Visit: ${job.visit||'—'}`),
    wp(`Visit dates: ${job.dates||'—'}`),
    wp(`Monitor: ${job.monitor||'—'}`),
    job.source?wp(`Imported source: ${job.source}`,{size:18}):'',
    wp('Summary',{bold:true,size:26}),
    summary||wp('No summary entered.',{size:20})
  ].join('');
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml',documentXml);
  const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  downloadBlob(blob,`CL04041383_Site_${safeName(job.site||'NA')}_IMV_${safeName(job.visit||'NA')}.docx`);
}

export function exportReportPdf(job){
  const pdf=new jsPDF({unit:'mm',format:'a4'});
  let y=18;
  pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text('Interim Monitoring Visit Report',20,y);y+=9;
  pdf.setFontSize(11);pdf.text('Protocol CL04041383',20,y);y+=9;
  pdf.setFont('helvetica','normal');
  for(const line of [`Site: ${job.site||'—'}`,`IMV / Visit: ${job.visit||'—'}`,`Visit dates: ${job.dates||'—'}`,`Monitor: ${job.monitor||'—'}`]){pdf.text(line,20,y);y+=6;}
  y+=3;pdf.setFont('helvetica','bold');pdf.text('Summary',20,y);y+=7;pdf.setFont('helvetica','normal');
  const lines=pdf.splitTextToSize(String(job.summary||'No summary entered.'),170);
  for(const line of lines){if(y>282){pdf.addPage();y=18;}pdf.text(line,20,y);y+=5;}
  pdf.save(`CL04041383_Site_${safeName(job.site||'NA')}_IMV_${safeName(job.visit||'NA')}.pdf`);
}

function downloadBlob(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=safeName(name);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
