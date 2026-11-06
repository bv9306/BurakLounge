async function createMenuPDF(){
const b=document.querySelector('#download-pdf'),msg=document.querySelector('#pdf-message');b.disabled=true;
try{
msg.textContent=' Güncel lakaplar alınıyor…';await loadNicknames();
if(!window.jspdf)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='jspdf.min.js';s.onload=resolve;s.onerror=reject;document.head.append(s)});
const font=await fetch('assets/menu-font.ttf').then(r=>{if(!r.ok)throw Error('Yazı tipi yüklenemedi');return r.arrayBuffer()});let bin='';for(const v of new Uint8Array(font))bin+=String.fromCharCode(v);
const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});pdf.addFileToVFS('Menu.ttf',btoa(bin));pdf.addFont('Menu.ttf','Menu','normal');pdf.setFont('Menu');
const gold=[203,166,100],ink=[239,229,209];
function text(t,x,y,size=11,color=ink){pdf.setFontSize(size);pdf.setTextColor(...color);pdf.text(t,x,y)}
function base(page){pdf.setFillColor(15,14,13);pdf.rect(0,0,210,297,'F');text('BURAK & YONCA',12,15,12,gold);text('THE HOUSE BAR',12,22,7);pdf.setDrawColor(...gold);pdf.line(12,27,198,27);text('İyi sohbet. İyi karışım. Bizim masa.',12,285,7);text(String(page).padStart(2,'0'),189,285,8,gold)}
base(1);text('Gece bizim,',20,95,32);text('bar açık.',20,115,32,gold);text('KOKTEYL DEFTERİ',20,143,11);text(`${recipes.length} servis · Orijinal isimler ve masanın lakapları`,20,155,9);text('Güncel menü ve siparişler:',20,225,9);pdf.setFontSize(8);pdf.textWithLink('bv9306.github.io/BurakLounge',20,233,{url:'https://bv9306.github.io/BurakLounge/'});text('Tat profilleri 0–5 arası tahminidir.',20,252,8);
for(let i=0;i<recipes.length;i++){
if(i%4===0){pdf.addPage();base(2+Math.floor(i/4))}
const r=recipes[i],x=12+(i%2)*95,y=34+Math.floor((i%4)/2)*122;
msg.textContent=` PDF hazırlanıyor: ${i+1}/${recipes.length}`;
const src=cocktailPhotos[r.n];
if(src){
try{
const img=await new Promise((resolve,reject)=>{let im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=()=>reject(Error('görsel'));im.src=src});
const c=document.createElement('canvas');c.width=c.height=640;let ctx=c.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,640,640);pdf.addImage(c.toDataURL('image/jpeg',.86),'JPEG',x+5,y,76,76);
}catch(err){pdf.setFillColor(32,26,20);pdf.rect(x+5,y,76,76,'F')}
}else{pdf.setFillColor(32,26,20);pdf.rect(x+5,y,76,76,'F');pdf.setFillColor(203,166,100);pdf.circle(x+43,y+34,16,'F')}
text(r.n,x,y+83,10,gold);pdf.setFontSize(10);let lines=pdf.splitTextToSize(nicknames[r.n]?'“'+nicknames[r.n]+'”':'',86);text(lines,x,y+90,10);text(r.cat,x,y+109,7);const t=tasteProfile(r);text(`Tatlı ${t[0]} · Ekşi ${t[1]} · Bitter ${t[2]} · Gövde ${t[3]}`,x,y+115,6.5);
await new Promise(resolve=>setTimeout(resolve,0));
}
pdf.save('Burak-Yonca-Bar-Menusu.pdf');msg.textContent=' PDF hazır. İndirmeler klasörünü kontrol et.';
}catch(e){msg.textContent=' PDF oluşturulamadı: '+(e.message||'Tekrar dene.')}finally{b.disabled=false}
}
document.querySelector('#download-pdf').onclick=createMenuPDF;
