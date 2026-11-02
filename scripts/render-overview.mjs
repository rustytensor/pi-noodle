// Conceptual explanatory artwork, not live UI or provider/session data.
import { writeFileSync } from "node:fs";
const root = new URL("../docs/assets/", import.meta.url);
const C = { mint: "#7dd3c0", gold: "#ffd27a", pink: "#ff7a93", ink: "#edf1fa", muted: "#b8c2d8" };
const esc = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const text = (x,y,value,size=26,color=C.ink,anchor="start",weight=400) => `<text x="${x}" y="${y}" font-family="Verdana,Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${esc(value)}</text>`;
function card(id,x,y,w,h,label,lines,color,size=28,body=24) {
 const middle=x+w/2, titleY=y+44;
 return `<g data-card="${id}" data-box="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="#171c2b" stroke="${color}" stroke-opacity=".7" stroke-width="1.5"/>${text(middle,titleY,label,size,color,"middle",700)}${lines.map((line,i)=>text(middle,titleY+38+i*35,line,body,C.ink,"middle")).join("")}</g>`;
}
const arrow = (d,color="mint",both=false,dashed=false) => `<path d="${d}" fill="none" stroke="${C[color]}" stroke-width="2.5" ${dashed?'stroke-dasharray="7 6"':''} marker-end="url(#${color})" ${both?`marker-start="url(#${color})"`:''}/>`;
function svg(title,description,w,h,body) {
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title description"><title id="title">${esc(title)}</title><desc id="description">${esc(description)} Conceptual diagram, not a live UI.</desc><defs>${["mint","gold","pink"].map(c=>`<marker id="${c}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 0L10 5L0 10Z" fill="${C[c]}"/></marker>`).join("")}</defs><rect x="1" y="1" width="${w-2}" height="${h-2}" rx="20" fill="#0d111b" stroke="#30394c"/>${body}</svg>\n`;
}
function memory(compact) {
 const desc="Main Pi and the side chat save and recall from one local memory store. You review and edit curated notes. Memory starts on in trusted projects, is plaintext, and recalled facts can reach your active model.";
 if(compact)return svg("One memory, both conversations",desc,600,790,
  text(30,48,"One memory.",32,C.mint,"start",700)+text(30,88,"Both conversations.",32,C.ink,"start",700)+
  card("main",60,132,480,86,"Main Pi — your main task",[],C.mint,28)+arrow("M300 222V258","mint",true)+
  card("memory",60,264,480,126,"Shared local memory",["Saved notes + recent text"],C.gold,30,26)+arrow("M300 394V424","mint",true)+
  card("side",60,430,480,86,"Side chat — separate thread",[],C.mint,28)+
  card("editor",60,554,480,80,"You review and edit notes",[],C.pink,27)+
  text(300,681,"On in trusted projects.",26,C.mint,"middle")+text(300,721,"Local plaintext. Recalled facts",26,C.muted,"middle")+text(300,757,"can reach your active model.",26,C.muted,"middle"));
 return svg("One memory, both conversations",desc,960,408,
  text(36,49,"One memory, available in both conversations",30,C.ink,"start",700)+text(36,86,"Save useful facts once. Recall them when they help.",22,C.muted)+
  card("main",36,136,224,104,"Main Pi",["your main task"],C.mint,28,22)+
  card("memory",340,122,280,132,"Shared memory",["notes + recent text"],C.gold,28,22)+
  card("side",700,136,224,104,"Side chat",["separate thread"],C.mint,28,22)+
  arrow("M266 188H334","mint",true)+arrow("M626 188H694","mint",true)+
  card("editor",340,294,280,70,"Review and edit notes",[],C.pink,22)+arrow("M480 288V260","pink")+
  text(480,390,"On in trusted projects · plaintext · recall can reach your active model",20,C.muted,"middle"));
}
function encryption(compact) {
 const desc="Optional encryption protects only the active archive database, search index and SQLite journals. Shared memory, original Pi transcripts and retained plaintext copies are outside. Selected retrieved text can reach a model; model access is a separate opt-in.";
 if(compact)return svg("What archive encryption protects",desc,600,850,
  text(30,49,"Optional archive encryption",30,C.gold,"start",700)+text(30,91,"Archive + encryption start off",26,C.muted)+
  card("inside",30,124,540,180,"Inside the encrypted archive",["Database + search index","SQLite journals"],C.gold,28,26)+
  card("outside",30,342,540,210,"Outside this protection",["Shared memory","Original Pi transcripts","Retained plaintext copies"],C.pink,28,26)+
  card("read",30,592,540,112,"Unlock → read selected results",["Results can reach your model."],C.mint,26,26)+
  text(300,751,"Capture, encryption and model",26,C.muted,"middle")+text(300,787,"access are separate controls.",26,C.muted,"middle")+text(300,823,"Not end-to-end encryption.",26,C.gold,"middle"));
 return svg("What archive encryption protects",desc,960,500,
  text(36,49,"Optional archive encryption",30,C.gold,"start",700)+text(36,89,"Protect the archive on disk—not everything Pi stores.",22,C.muted)+
  card("inside",36,130,408,206,"Encrypted archive",["Database + search index","SQLite journals"],C.gold,28,23)+
  card("outside",516,130,408,206,"Outside this protection",["Shared memory","Original Pi transcripts","Retained plaintext copies"],C.pink,26,22)+
  arrow("M240 340V373","gold")+
  card("read",36,380,888,70,"Unlock → read results → active model / provider",[],C.mint,25)+
  text(480,480,"OFF by default · model access is separate · not end-to-end encryption",20,C.muted,"middle"));
}
function side(compact) {
 const desc="The main session supplies bounded context to a separate side conversation. Repo tools, Note main and Redirect start off. Enabled notes and separately reviewed redirects can return to main. Closing the panel does not stop work. Shared memory has separate controls.";
 if(compact)return svg("Think beside the main task",desc,600,800,
  text(30,50,"Think beside the main task",30,C.pink,"start",700)+
  card("main",60,106,480,104,"Main Pi",["Your main task"],C.mint,30,26)+
  arrow("M300 216V280")+text(327,254,"Bounded context",26,C.muted)+
  card("side",60,288,480,110,"Side chat",["Questions + second opinions"],C.pink,30,26)+
  arrow("M60 344H32V159H56","pink",false,true)+
  card("bridge",60,440,480,144,"Back to main, if enabled",["Note main: off by default","Redirect: review every send"],C.gold,26,26)+
  card("local",60,622,480,110,"Repo tools start off.",["Close is not stop."],C.mint,28,26)+
  text(300,775,"Memory has separate controls.",26,C.muted,"middle"));
 return svg("Think beside the main task",desc,960,456,
  text(36,49,"Ask beside the main task",30,C.pink,"start",700)+text(36,86,"A separate conversation, with bounded main-session context.",22,C.muted)+
  card("main",36,132,280,130,"Main Pi",["Your main task"],C.mint,30,24)+
  card("side",644,132,280,130,"Side chat",["Ask. Think. Compare."],C.pink,30,22)+
  text(480,175,"Bounded context",23,C.muted,"middle")+arrow("M322 195H638")+
  arrow("M784 268V300H176V268","pink",false,true)+
  card("bridge",246,318,468,66,"Note main OFF · Redirect OFF",[],C.gold,23)+
  text(480,415,"Enable notes separately. Review every redirect. Repo tools start off.",20,C.muted,"middle")+
  text(480,442,"Close hides the panel; work can continue. Memory is independent.",20,C.muted,"middle"));
}
for(const [name,render] of [["memory",memory],["encryption",encryption],["side-chat",side]])for(const compact of [false,true]){
 const file=`noodle-${name}-flow${compact?"-compact":""}.svg`;
 writeFileSync(new URL(file,root),render(compact));console.log(`Rendered ${file}`);
}
