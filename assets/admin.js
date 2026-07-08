// ============================================================================
// 관리자 전용 편집 도구. admin.html에서만 로드됩니다.
// render.js가 만든 화면의 버튼들(onclick="window.xxx()")이 여기 정의된
// 함수들을 호출합니다. 저장은 전부 Firestore(그리고 파일 업로드는 Storage)로 갑니다.
// ============================================================================

import { api } from "./data.js?v=3";
import { esc, shade, accNo, mediaBlock, router, youtubeId } from "./render.js?v=5";
import { storage } from "./firebase-config.js?v=3";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const HUES=["#54a97a","#e0a458","#6f86d6","#c47ac0","#4bb3c4","#e08a5f","#5f9ec4","#8f7fd6","#4faf88"];

/* ---- toast ----------------------------------------------------------------- */
function toast(msg){
  const t=document.createElement("div"); t.textContent=msg;
  t.style.cssText="position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:400;padding:13px 22px;border-radius:999px;font-weight:700;font-size:13.5px;color:#fff;background:linear-gradient(180deg,#74c497,#2f8055);box-shadow:0 10px 24px rgba(47,128,85,.35)";
  document.body.appendChild(t); setTimeout(()=>t.remove(),1800);
}

/* ---- single-entity modal (기존 폼 저장/취소/삭제) ---------------------------- */
let modalRefresh=null;
function openModal(htmlFn,onSave,onDelete){
  const back=document.createElement("div"); back.className="modal-back";
  const close=()=>{ modalRefresh=null; back.remove(); };
  const render=()=>{
    back.innerHTML=`<div class="modal">${htmlFn()}
      <div class="btn-row" style="justify-content:space-between">
        <div style="display:flex;gap:10px"><button class="btn" id="md-save">저장</button>
          <button class="btn ghost" id="md-cancel">취소</button></div>
        ${onDelete?'<button class="btn danger" id="md-del">삭제</button>':''}</div></div>`;
    back.querySelector("#md-save").onclick=async()=>{ const ok=await onSave(); if(ok!==false){ close(); router(); refreshOpenPanels(); } };
    back.querySelector("#md-cancel").onclick=close;
    if(onDelete) back.querySelector("#md-del").onclick=async()=>{ const ok=await onDelete(); if(ok!==false){ close(); router(); refreshOpenPanels(); } };
  };
  modalRefresh=render; render();
  back.addEventListener("mousedown",e=>{ if(e.target===back) close(); });
  document.body.appendChild(back);
}

/* ---- list panel (메뉴 관리 같은 목록형 오버레이) ----------------------------- */
const openPanels={};
function openOrUpdatePanel(key,title,bodyHtml){
  let p=openPanels[key];
  if(!p){
    const back=document.createElement("div"); back.className="modal-back"; back.dataset.key=key;
    document.body.appendChild(back);
    p={back}; openPanels[key]=p;
    back.addEventListener("mousedown",e=>{ if(e.target===back){ back.remove(); delete openPanels[key]; } });
  }
  p.back.innerHTML=`<div class="modal" style="max-width:640px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h3 style="margin:0">${title}</h3><button class="btn ghost sm" data-close>닫기</button>
    </div>${bodyHtml}</div>`;
  p.back.querySelector("[data-close]").onclick=()=>{ p.back.remove(); delete openPanels[key]; };
}
function refreshOpenPanels(){
  if(openPanels["menu-manager"]) renderMenuManagerPanel();
}

/* ============================================================================ 메뉴 관리 */
async function openMenuManager(){ renderMenuManagerPanel(); }
async function renderMenuManagerPanel(){
  const menus=await api.getMenus();
  const rows=menus.map((m,i)=>`<div class="a-item">
      <div class="handle"><button onclick="window.moveMenu('${m.id}',-1)" ${i===0?'disabled style=opacity:.25':''}>▲</button>
        <button onclick="window.moveMenu('${m.id}',1)" ${i===menus.length-1?'disabled style=opacity:.25':''}>▼</button></div>
      <div class="grow"><div class="ttl">${esc(m.label)}</div>
        <div class="subttl">/${esc(m.slug)} · ${esc(m.type)}${m.submenus?.length?` · 서브 ${m.submenus.length}`:''}</div></div>
      <span class="pill ${m.visible?'':'hide'}">${m.visible?'노출':'숨김'}</span>
      <button class="btn ghost sm" onclick="window.editMenu('${m.id}')">편집</button></div>`).join("");
  openOrUpdatePanel("menu-manager","메뉴 관리",
    `<p class="hint" style="margin:-6px 0 16px">상단 네비게이션은 이 목록으로 만들어집니다. 이름·순서·노출 여부를 바꾸거나 새로 추가/삭제할 수 있어요.</p>
     <div class="a-list">${rows||'<p class="empty">메뉴가 없어요.</p>'}</div>
     <div class="btn-row"><button class="btn" onclick="window.editMenu('')">+ 메뉴 추가</button></div>`);
}
async function moveMenu(id,dir){
  const menus=await api.getMenus();
  const i=menus.findIndex(m=>m.id===id), j=i+dir;
  if(j<0||j>=menus.length) return;
  [menus[i],menus[j]]=[menus[j],menus[i]];
  await api.reorderMenus(menus);
  refreshOpenPanels(); router();
}
async function editMenu(id){
  const menus=await api.getMenus();
  const m=id?menus.find(x=>x.id===id):{id:"",label:"",slug:"",type:"page",visible:true,submenus:[],order:menus.length};
  const isNew=!id;
  openModal(()=>menuModalHTML(m,isNew),()=>{
    const g=q=>document.getElementById(q);
    m.label=g("mm-label").value.trim();
    m.slug=g("mm-slug").value.trim()||m.label.toLowerCase().replace(/\s+/g,"-");
    m.type=g("mm-type").value; m.visible=g("mm-visible").checked;
    m.submenus = m.type==="page" ? [] : collectSubs();
    if(collectSubs.lastIncomplete>0){
      alert(m.type==="commission"
        ? "서브메뉴 중 이름 또는 URL이 비어있는 항목이 있어요. 둘 다 입력한 뒤 다시 저장해 주세요."
        : "서브메뉴 중 이름이 비어있는 항목이 있어요. 입력한 뒤 다시 저장해 주세요.");
      return false;
    }
    if(!m.label){ alert("메뉴 이름을 입력해 주세요."); return false; }
    if(typeof m.order!=="number") m.order=menus.length;
    if(isNew) delete m.id;
    return api.saveMenu(m).then(()=>true);
  }, id?()=>{ if(confirm(`"${m.label}" 메뉴를 삭제할까요?`)) return api.deleteMenu(id).then(()=>true); return false; }:null);
}
function menuModalHTML(m,isNew){
  return `<h3>${isNew?"메뉴 추가":"메뉴 편집"}</h3>
    <label class="f"><span class="lab">이름 (네비 표시)</span>
      <input class="inp" id="mm-label" value="${esc(m.label)}" placeholder="예: work" oninput="window.syncSlug()"></label>
    <div class="frow">
      <label class="f"><span class="lab">URL 슬러그</span><input class="inp" id="mm-slug" value="${esc(m.slug)}" placeholder="work"></label>
      <label class="f"><span class="lab">유형</span><select class="inp" id="mm-type" onchange="window.toggleSubs()">
        <option value="page" ${m.type==="page"?"selected":""}>페이지 (텍스트)</option>
        <option value="gallery" ${m.type==="gallery"?"selected":""}>갤러리 (작업물)</option>
        <option value="commission" ${m.type==="commission"?"selected":""}>커미션</option></select></label>
    </div>
    <label class="f" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="mm-visible" ${m.visible?"checked":""} style="width:auto"><span class="lab" style="margin:0">네비게이션에 노출</span></label>
    <div id="subs-wrap" style="${(m.type==="gallery"||m.type==="commission")?"":"display:none"}">
      <span class="lab" id="subs-label">${m.type==="commission"?"서브메뉴 · 외부 링크":"서브메뉴 / 카테고리"}</span>
      <div class="hint" id="subs-hint" style="margin:-4px 0 8px">${m.type==="commission"?"각 항목은 새 탭에서 열리는 외부 링크입니다.":"작업물을 분류하는 카테고리로 쓰입니다."}</div>
      <div class="subgroup" id="sub-editor" data-kind="${m.type==="commission"?"link":"cat"}">
        ${(m.submenus||[]).map(s=>m.type==="commission"?subRowLinkHTML(s.label,s.url):subRowHTML(s.label,s.slug)).join("")}
        <div class="empty" id="sub-empty" style="${(m.submenus||[]).length?'display:none':''};padding:16px">서브메뉴가 없어요.</div>
        <button class="btn ghost sm" id="sub-add-btn" onclick="window.addSubRow()" style="margin-top:8px">+ 서브메뉴 추가</button></div></div>`;
}
function subRowHTML(label,slug){ return `<div class="rowedit sub-item">
  <input class="inp sub-label" value="${esc(label)}" placeholder="카테고리 이름" oninput="this.closest('.sub-item').querySelector('.sub-slug').value=this.value.toLowerCase().replace(/\\s+/g,'-')">
  <button class="btn danger sm" onclick="this.closest('.sub-item').remove();window.refreshSubEmpty()">×</button>
  <input type="hidden" class="sub-slug" value="${esc(slug)}"></div>`; }
function subRowLinkHTML(label,url){ return `<div class="rowedit sub-item">
  <input class="inp sub-label" value="${esc(label)}" placeholder="표시 이름" style="flex:1">
  <input class="inp sub-url" value="${esc(url||"")}" placeholder="https://..." style="flex:1.3">
  <button class="btn danger sm" onclick="this.closest('.sub-item').remove();window.refreshSubEmpty()">×</button></div>`; }
function syncSlug(){ const l=document.getElementById("mm-label"),s=document.getElementById("mm-slug");
  if(s&&!s.dataset.touched)s.value=l.value.trim().toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,""); }
function toggleSubs(){
  const t=document.getElementById("mm-type").value;
  const show=(t==="gallery"||t==="commission");
  document.getElementById("subs-wrap").style.display=show?"":"none";
  if(!show)return;
  const kind=t==="commission"?"link":"cat";
  const ed=document.getElementById("sub-editor");
  if(ed.dataset.kind!==kind){
    ed.dataset.kind=kind;
    document.getElementById("subs-label").textContent=kind==="link"?"서브메뉴 · 외부 링크":"서브메뉴 / 카테고리";
    document.getElementById("subs-hint").textContent=kind==="link"?"각 항목은 새 탭에서 열리는 외부 링크입니다.":"작업물을 분류하는 카테고리로 쓰입니다.";
    ed.querySelectorAll(".sub-item").forEach(r=>r.remove());
    refreshSubEmpty();
  }
}
function addSubRow(){
  const ed=document.getElementById("sub-editor");
  const html=ed.dataset.kind==="link"?subRowLinkHTML("",""):subRowHTML("","");
  document.getElementById("sub-add-btn").insertAdjacentHTML("beforebegin",html); refreshSubEmpty();
}
function refreshSubEmpty(){ const ed=document.getElementById("sub-editor"); document.getElementById("sub-empty").style.display=ed.querySelectorAll(".sub-item").length?"none":""; }
function collectSubs(){
  const ed=document.getElementById("sub-editor"); if(!ed) return [];
  const kind=ed.dataset.kind;
  const items=[]; let incomplete=0;
  [...ed.querySelectorAll(".sub-item")].forEach(r=>{
    const label=r.querySelector(".sub-label").value.trim();
    if(kind==="link"){
      const url=r.querySelector(".sub-url").value.trim();
      if(!label&&!url) return;
      if(!label||!url){ incomplete++; return; }
      items.push({label,url});
    }else{
      if(!label) return;
      const slug=r.querySelector(".sub-slug").value.trim()||label.toLowerCase().replace(/\s+/g,"-");
      items.push({label,slug});
    }
  });
  collectSubs.lastIncomplete=incomplete;
  return items;
}

/* ============================================================================ 작업물 */
let pendingMediaData=null;

/* ---- 공용 이미지 선택 도구 (로고 / 배너 등에서 재사용) ---------------------- */
let pendingImgData={};
function imagePickerHTML(prefix,label,currentSrc){
  const showUrl = currentSrc && !currentSrc.startsWith("data:") && !currentSrc.includes("firebasestorage");
  return `<label class="f"><span class="lab">${label}</span>
      <input class="inp" id="${prefix}-url" placeholder="https://..." oninput="window.onImgUrlInput('${prefix}')" value="${showUrl?esc(currentSrc):''}"></label>
    <div class="hint" style="margin:-8px 0 10px">또는 파일을 직접 올릴 수 있어요.</div>
    <label class="f"><span class="lab">파일 업로드</span>
      <input class="inp" id="${prefix}-file" type="file" accept="image/*" onchange="window.onImgFilePick(this,'${prefix}')"></label>
    <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
      <div id="${prefix}-preview">${currentSrc?`<img src="${esc(currentSrc)}" style="width:110px;border-radius:12px;box-shadow:var(--shadow-sm);display:block">`:''}</div>
      <button type="button" class="btn ghost sm" onclick="window.clearImgField('${prefix}')">이미지 제거</button>
    </div>`;
}
function onImgUrlInput(prefix){
  const v=(document.getElementById(prefix+"-url").value||"").trim();
  delete pendingImgData[prefix];
  const prev=document.getElementById(prefix+"-preview");
  prev.innerHTML=v?`<img src="${esc(v)}" style="width:110px;border-radius:12px;box-shadow:var(--shadow-sm);display:block">`:"";
}
async function onImgFilePick(el,prefix){
  const file=el.files&&el.files[0]; if(!file) return;
  const prev=document.getElementById(prefix+"-preview");
  prev.innerHTML=`<div class="hint">업로드 중...</div>`;
  try{
    const path=`images/${prefix}_${Date.now()}_${file.name}`;
    const fileRef=ref(storage,path);
    await uploadBytes(fileRef,file);
    const url=await getDownloadURL(fileRef);
    pendingImgData[prefix]=url;
    prev.innerHTML=`<img src="${esc(url)}" style="width:110px;border-radius:12px;box-shadow:var(--shadow-sm);display:block">`;
    const urlInp=document.getElementById(prefix+"-url"); if(urlInp) urlInp.value="";
  }catch(err){
    prev.innerHTML=`<div class="hint" style="color:var(--warn)">업로드 실패: Storage 설정을 확인해 주세요.</div>`;
    console.error(err);
  }
}
function clearImgField(prefix){
  pendingImgData[prefix]="";
  const urlInp=document.getElementById(prefix+"-url"); if(urlInp) urlInp.value="";
  const prev=document.getElementById(prefix+"-preview"); if(prev) prev.innerHTML="";
}
function getImageValue(prefix,existing){
  if(Object.prototype.hasOwnProperty.call(pendingImgData,prefix)) return pendingImgData[prefix];
  const urlVal=(document.getElementById(prefix+"-url")?.value||"").trim();
  return urlVal || existing || "";
}
function mediaPreviewHTML(media){
  if(media.type==="video"){
    const yid=youtubeId(media.src);
    if(yid) return `<iframe src="https://www.youtube.com/embed/${yid}" style="width:220px;aspect-ratio:16/9;border:0;border-radius:12px;box-shadow:var(--shadow-sm);display:block" allowfullscreen></iframe>`;
    return `<video src="${esc(media.src)}" muted controls style="width:160px;border-radius:12px;box-shadow:var(--shadow-sm);display:block"></video>`;
  }
  return `<img src="${esc(media.src)}" style="width:160px;border-radius:12px;box-shadow:var(--shadow-sm);display:block">`;
}
async function editWork(id){
  const works=await api.getWorks();
  const cats=((await api.getMenus()).find(m=>m.type==="gallery")?.submenus||[]);
  const w=id?works.find(x=>x.id===id):{id:"",title:"",cat:cats[0]?.slug||"",year:new Date().getFullYear(),hue:HUES[0],desc:"",media:{type:"color",src:""}};
  if(!w.media) w.media={type:"color",src:""};
  const isNew=!id;
  pendingMediaData=null;
  openModal(()=>editWorkModalHTML(w,cats,isNew),()=>{
    w.title=document.getElementById("wk-title").value.trim();
    w.cat=document.getElementById("wk-cat").value;
    w.year=parseInt(document.getElementById("wk-year").value)||new Date().getFullYear();
    w.desc=document.getElementById("wk-desc").value.trim();
    const mtype=document.getElementById("wk-mtype").value;
    if(mtype==="color"){
      w.hue=document.querySelector("#wk-hue .swatch.on")?.dataset.h||HUES[0];
      w.media={type:"color",src:""};
    }else if(mtype==="image"){
      const imgs=collectWorkImages();
      if(imgs.length===0){ alert("이미지를 최소 1장 등록해 주세요."); return false; }
      w.media={type:"image", src:imgs[0], images:imgs};
    }else{
      const urlVal=(document.getElementById("wk-msrc")?.value||"").trim();
      const existing=(w.media&&w.media.type==="video")?w.media.src:"";
      w.media={type:"video", src: pendingMediaData||urlVal||existing};
    }
    if(!w.title){ alert("제목을 입력해 주세요."); return false; }
    if(isNew) delete w.id;
    return api.saveWork(w).then(()=>true);
  }, id?()=>{ if(confirm("이 작업물을 삭제할까요?")) return api.deleteWork(id).then(()=>true); return false; }:null);
}
function editWorkModalHTML(w,cats,isNew){
  const mtype=w.media?.type||"color";
  const images=(w.media&&w.media.type==="image")?((w.media.images&&w.media.images.length)?w.media.images:(w.media.src?[w.media.src]:[])):[];
  return `<h3>${isNew?"작업물 추가":"작업물 편집"}</h3>
    <label class="f"><span class="lab">제목</span><input class="inp" id="wk-title" value="${esc(w.title)}"></label>
    <div class="frow"><label class="f"><span class="lab">카테고리</span>
      <select class="inp" id="wk-cat">${cats.length?cats.map(c=>`<option value="${esc(c.slug)}" ${c.slug===w.cat?'selected':''}>${esc(c.label)}</option>`).join(""):'<option value="">— 없음 —</option>'}</select></label>
      <label class="f"><span class="lab">연도</span><input class="inp" id="wk-year" type="number" value="${w.year}"></label></div>
    <label class="f"><span class="lab">설명</span><textarea class="inp" id="wk-desc">${esc(w.desc)}</textarea></label>
    <label class="f"><span class="lab">미디어 유형</span>
      <select class="inp" id="wk-mtype" onchange="window.onMediaTypeChange()">
        <option value="color" ${mtype==="color"?"selected":""}>색상 placeholder</option>
        <option value="image" ${mtype==="image"?"selected":""}>이미지</option>
        <option value="video" ${mtype==="video"?"selected":""}>영상</option>
      </select></label>
    <div id="wk-color-wrap" style="${mtype==="color"?"":"display:none"}">
      <span class="lab">커버 색상</span>
      <div class="swatches" id="wk-hue">${HUES.map(h=>`<span class="swatch ${h===w.hue?'on':''}" style="background:linear-gradient(150deg,${shade(h,25)},${shade(h,-22)})" data-h="${h}" onclick="window.pickHue(this)"></span>`).join("")}</div>
    </div>
    <div id="wk-image-wrap" style="${mtype==="image"?"":"display:none"}">
      <span class="lab">이미지 목록</span>
      <div class="hint" style="margin:-4px 0 8px">여러 장 등록할 수 있어요. 첫 번째 이미지가 목록의 대표 썸네일로 쓰이고, 상세 페이지에서는 좌우 화살표로 전체를 넘겨볼 수 있어요.</div>
      <div class="subgroup" id="wk-images-editor">
        ${images.map(workImageRowHTML).join("")}
        <div class="empty" id="wk-images-empty" style="${images.length?'display:none':''};padding:12px">등록된 이미지가 없어요.</div>
        <button class="btn ghost sm" id="wk-img-add-btn" type="button" onclick="window.addWorkImageRow()">+ 이미지 추가</button>
      </div>
    </div>
    <div id="wk-video-wrap" style="${mtype==="video"?"":"display:none"}">
      <label class="f"><span class="lab">링크로 등록</span>
        <input class="inp" id="wk-msrc" placeholder="https://..." oninput="window.onMediaUrlInput(this)" value="${(w.media&&w.media.type==="video"&&w.media.src&&!w.media.src.includes('firebasestorage'))?esc(w.media.src):''}"></label>
      <div class="hint" style="margin:-8px 0 12px">유튜브 링크(youtu.be, youtube.com)를 그대로 붙여넣으면 자동으로 재생 플레이어로 바뀝니다. 또는 파일을 직접 올릴 수 있어요.</div>
      <label class="f"><span class="lab">파일 업로드</span>
        <input class="inp" id="wk-file" type="file" accept="video/*" onchange="window.onMediaFilePick(this)"></label>
      <div id="wk-preview" style="margin-top:4px">${(w.media&&w.media.type==="video"&&w.media.src)?mediaPreviewHTML(w.media):''}</div>
    </div>`;
}
function workImageRowHTML(url){
  return `<div class="rowedit img-row" style="align-items:center;flex-wrap:wrap">
    <input class="inp img-url" placeholder="https://..." value="${esc(url||'')}" oninput="window.onWorkImgUrlInput(this)" style="flex:1 1 200px">
    <input type="file" accept="image/*" onchange="window.onWorkImgFilePick(this)" style="flex:0 0 auto;font-size:12px">
    <div class="img-preview" style="width:44px;height:44px;flex-shrink:0">${url?`<img src="${esc(url)}" style="width:44px;height:44px;object-fit:cover;border-radius:9px;box-shadow:var(--shadow-sm)">`:''}</div>
    <button class="btn danger sm" type="button" onclick="window.removeWorkImageRow(this)">×</button>
  </div>`;
}
function addWorkImageRow(){
  document.getElementById("wk-img-add-btn").insertAdjacentHTML("beforebegin", workImageRowHTML(""));
  document.getElementById("wk-images-empty").style.display="none";
}
function removeWorkImageRow(btn){
  btn.closest(".img-row").remove();
  const ed=document.getElementById("wk-images-editor");
  document.getElementById("wk-images-empty").style.display = ed.querySelectorAll(".img-row").length ? "none" : "";
}
function onWorkImgUrlInput(el){
  const row=el.closest(".img-row");
  const v=el.value.trim();
  row.querySelector(".img-preview").innerHTML = v?`<img src="${esc(v)}" style="width:44px;height:44px;object-fit:cover;border-radius:9px;box-shadow:var(--shadow-sm)">`:"";
}
async function onWorkImgFilePick(el){
  const file=el.files&&el.files[0]; if(!file) return;
  const row=el.closest(".img-row");
  const preview=row.querySelector(".img-preview");
  preview.innerHTML=`<div class="hint">업로드 중</div>`;
  try{
    const path=`works/${Date.now()}_${file.name}`;
    const fileRef=ref(storage,path);
    await uploadBytes(fileRef,file);
    const url=await getDownloadURL(fileRef);
    row.querySelector(".img-url").value=url;
    preview.innerHTML=`<img src="${esc(url)}" style="width:44px;height:44px;object-fit:cover;border-radius:9px;box-shadow:var(--shadow-sm)">`;
  }catch(err){
    preview.innerHTML=`<div class="hint" style="color:var(--warn)">실패</div>`;
    console.error(err);
  }
}
function collectWorkImages(){
  const ed=document.getElementById("wk-images-editor"); if(!ed) return [];
  return [...ed.querySelectorAll(".img-row .img-url")].map(inp=>inp.value.trim()).filter(Boolean);
}
function onMediaTypeChange(){
  const t=document.getElementById("wk-mtype").value;
  document.getElementById("wk-color-wrap").style.display=t==="color"?"":"none";
  document.getElementById("wk-image-wrap").style.display=t==="image"?"":"none";
  document.getElementById("wk-video-wrap").style.display=t==="video"?"":"none";
}
function onMediaUrlInput(el){
  const v=el.value.trim();
  const previewEl=document.getElementById("wk-preview");
  if(!v){ previewEl.innerHTML=""; return; }
  pendingMediaData=null; // 링크를 입력하면 이전에 올려둔 파일은 취소합니다
  const t=document.getElementById("wk-mtype").value;
  previewEl.innerHTML=mediaPreviewHTML({type:t,src:v});
}
async function onMediaFilePick(el){
  const file=el.files&&el.files[0]; if(!file)return;
  const previewEl=document.getElementById("wk-preview");
  previewEl.innerHTML=`<div class="hint">업로드 중...</div>`;
  try{
    const path=`works/${Date.now()}_${file.name}`;
    const fileRef=ref(storage,path);
    await uploadBytes(fileRef,file);
    const url=await getDownloadURL(fileRef);
    pendingMediaData=url;
    const t=document.getElementById("wk-mtype").value;
    previewEl.innerHTML=mediaPreviewHTML({type:t,src:url});
    const urlInp=document.getElementById("wk-msrc"); if(urlInp) urlInp.value="";
  }catch(err){
    previewEl.innerHTML=`<div class="hint" style="color:var(--warn)">업로드 실패: Firebase Storage 설정을 확인해 주세요.</div>`;
    console.error(err);
  }
}
function pickHue(el){ el.parentElement.querySelectorAll(".swatch").forEach(s=>s.classList.remove("on")); el.classList.add("on"); }
async function deleteWorkConfirm(id,goBack){
  if(!confirm("이 작업물을 삭제할까요?")) return;
  await api.deleteWork(id);
  toast("삭제됨");
  if(goBack) location.hash="#/work"; else router();
}

/* ============================================================================ 페이지 (홈/about/일반) */
async function editHomePage(){
  const p=await api.getPage("home")||{title:"",body:""};
  pendingImgData={};
  openModal(()=>`<h3>홈 배너 편집</h3>
      <label class="f"><span class="lab">제목</span><input class="inp" id="hp-title" value="${esc(p.title||'')}"></label>
      <label class="f"><span class="lab">설명</span><textarea class="inp" id="hp-body" style="min-height:110px">${esc(p.body||'')}</textarea></label>
      <div class="subgroup"><div class="gh">배너 배경 이미지</div>
        <div class="hint" style="margin-top:-4px">비워두면 기본 그라데이션 배경을 사용합니다.</div>
        ${imagePickerHTML('banner','배경 이미지',p.bannerImage||'')}
      </div>`,
    async()=>{
      await api.savePage("home",{
        title:document.getElementById("hp-title").value.trim(),
        body:document.getElementById("hp-body").value.trim(),
        bannerImage:getImageValue('banner',p.bannerImage||''),
      });
      toast("저장됨"); return true;
    },
    null);
}
async function editAboutPage(){
  const p=await api.getPage("about")||{};
  openModal(()=>`<h3>About 편집</h3>
      <div class="frow">
        <label class="f"><span class="lab">왼쪽 블록 제목</span><input class="inp" id="pg-p-title" value="${esc(p.profileTitle||'Profile')}"></label>
        <label class="f"><span class="lab">오른쪽 블록 제목</span><input class="inp" id="pg-e-title" value="${esc(p.expTitle||'Work Experience')}"></label>
      </div>
      <label class="f"><span class="lab">왼쪽 내용 · Profile <span style="font-weight:400;color:var(--muted)">(빈 줄 = 문단 구분)</span></span>
        <textarea class="inp" id="pg-p-body" style="min-height:140px">${esc(p.profileBody||"")}</textarea></label>
      <label class="f"><span class="lab">오른쪽 내용 · Work Experience <span style="font-weight:400;color:var(--muted)">(줄바꿈 = 한 줄씩)</span></span>
        <textarea class="inp" id="pg-e-body" style="min-height:140px">${esc(p.expBody||"")}</textarea></label>`,
    async()=>{
      await api.savePage("about",{
        profileTitle:document.getElementById("pg-p-title").value.trim(),
        profileBody:document.getElementById("pg-p-body").value,
        expTitle:document.getElementById("pg-e-title").value.trim(),
        expBody:document.getElementById("pg-e-body").value,
      });
      toast("저장됨"); return true;
    }, null);
}
async function editGenericPage(slug,label){
  const p=await api.getPage(slug)||{};
  openModal(()=>`<h3>편집 — ${esc(label)}</h3>
      <label class="f"><span class="lab">제목</span><input class="inp" id="pg-title" value="${esc(p.title||"")}"></label>
      <label class="f"><span class="lab">본문 <span style="font-weight:400;color:var(--muted)">(빈 줄 = 문단 구분)</span></span>
        <textarea class="inp" id="pg-body" style="min-height:200px">${esc(p.body||"")}</textarea></label>`,
    async()=>{ await api.savePage(slug,{title:document.getElementById("pg-title").value.trim(),body:document.getElementById("pg-body").value}); toast("저장됨"); return true; },
    null);
}

/* ============================================================================ 커미션 */
function addCommLink(){ editCommLinkForm(-1); }
function editCommLink(i){ editCommLinkForm(i); }
async function editCommLinkForm(i){
  const c=await api.getCommission(); const isNew=i<0;
  const l=isNew?{label:"",url:""}:(c.links[i]||{label:"",url:""});
  openModal(()=>`<h3>${isNew?"링크 추가":"링크 편집"}</h3>
      <label class="f"><span class="lab">표시 이름</span><input class="inp" id="cl-label" value="${esc(l.label)}"></label>
      <label class="f"><span class="lab">URL</span><input class="inp" id="cl-url" value="${esc(l.url)}" placeholder="https://..."></label>`,
    async()=>{
      const c2=await api.getCommission();
      const label=document.getElementById("cl-label").value.trim();
      const url=document.getElementById("cl-url").value.trim();
      if(!label||!url){ alert("이름과 URL을 모두 입력해 주세요."); return false; }
      c2.links=c2.links||[];
      if(isNew) c2.links.push({label,url}); else c2.links[i]={label,url};
      await api.saveCommission(c2); toast("저장됨"); return true;
    },
    isNew?null:async()=>{ const c2=await api.getCommission(); c2.links.splice(i,1); await api.saveCommission(c2); toast("삭제됨"); return true; });
}
async function deleteCommLink(i){
  if(!confirm("이 링크를 삭제할까요?")) return;
  const c=await api.getCommission(); c.links.splice(i,1); await api.saveCommission(c);
  toast("삭제됨"); router();
}

/* ============================================================================ 설정 */
async function openSettingsManager(){
  const s=await api.getSettings();
  const menus=await api.getMenus();
  pendingImgData={};
  const seedNote = menus.length===0 ? `<div class="notice-box"><span>🌱</span><span>Firestore가 비어있어요. 아래 버튼으로 예시 메뉴·페이지·작업물을 한 번에 채워넣을 수 있어요. (이미 있는 데이터는 건드리지 않습니다)</span></div>
      <div class="btn-row" style="margin-top:0;margin-bottom:22px"><button class="btn ghost sm" id="seed-btn" type="button">예시 데이터로 시작하기</button></div>` : "";
  openModal(()=>`<h3>사이트 설정</h3>${seedNote}
      <div class="frow">
        <label class="f"><span class="lab">이름 (한글)</span><input class="inp" id="st-ko" value="${esc(s.brandKo||'')}"></label>
        <label class="f"><span class="lab">이름 (영문)</span><input class="inp" id="st-en" value="${esc(s.brandEn||'')}"></label></div>
      <label class="f"><span class="lab">태그라인</span><input class="inp" id="st-tag" value="${esc(s.tagline||'')}"></label>
      <div class="subgroup"><div class="gh">메인 컬러</div>
        <div class="hint" style="margin-top:-4px">이 색을 기준으로 밝은 톤·진한 톤·그림자·연한 배경까지 자동으로 계산해서 사이트 전체에 적용됩니다.</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:4px">
          <input type="color" id="st-color" value="${esc(s.themeColor||'#54a97a')}" style="width:52px;height:52px;border:none;border-radius:12px;cursor:pointer;box-shadow:var(--shadow-sm)">
          <input class="inp" id="st-color-hex" value="${esc(s.themeColor||'#54a97a')}" style="max-width:120px" oninput="document.getElementById('st-color').value=this.value">
        </div>
      </div>
      <div class="subgroup"><div class="gh">로고 이미지</div>
        <div class="hint" style="margin-top:-4px">비워두면 이름 첫 글자로 만든 기본 아이콘을 사용합니다.</div>
        ${imagePickerHTML('logo','로고 이미지',s.logoUrl||'')}
      </div>`,
    async()=>{
      await api.saveSettings({
        brandKo:document.getElementById("st-ko").value.trim()||"지율",
        brandEn:document.getElementById("st-en").value.trim(),
        tagline:document.getElementById("st-tag").value.trim(),
        themeColor:document.getElementById("st-color").value,
        logoUrl:getImageValue('logo',s.logoUrl||''),
      });
      toast("저장됨"); return true;
    }, null);
  const colorInp=document.getElementById("st-color"), colorHex=document.getElementById("st-color-hex");
  if(colorInp) colorInp.oninput=()=>{ colorHex.value=colorInp.value; };
  const seedBtn=document.getElementById("seed-btn");
  if(seedBtn) seedBtn.onclick=async()=>{
    seedBtn.textContent="채우는 중..."; seedBtn.disabled=true;
    await seedDefaults();
    toast("예시 데이터를 채웠어요");
    router();
  };
}

async function seedDefaults(){
  await api.saveSettings({ brandKo:"지율", brandEn:"JIYUL", tagline:"Live2D Rigging Artist" });
  await api.saveMenu({ label:"home", slug:"home", type:"page", order:0, visible:true, submenus:[] });
  await api.saveMenu({ label:"about", slug:"about", type:"page", order:1, visible:true, submenus:[] });
  await api.saveMenu({ label:"work", slug:"work", type:"gallery", order:2, visible:true, submenus:[
    { label:"Rigging", slug:"rigging" }, { label:"Design", slug:"design" },
    { label:"Video Edit", slug:"video-edit" }, { label:"Html/css", slug:"html-css" },
  ]});
  await api.saveMenu({ label:"commission", slug:"commission", type:"commission", order:3, visible:true, submenus:[] });
  await api.savePage("home", { title:"작은 움직임까지, 정성껏.", body:"Live2D 리깅 커미션과 개인 작업을 모아두는 아카이브입니다." });
  await api.savePage("about", {
    profileTitle:"Profile",
    profileBody:"자기소개를 여기에 적어주세요.",
    expTitle:"Work Experience",
    expBody:"2024 — 경력 한 줄\n2023 — 경력 한 줄",
  });
  await api.saveCommission({ links:[] });
  await api.saveWork({ title:"예시 작업물", cat:"rigging", year:new Date().getFullYear(), hue:"#54a97a", desc:"예시 설명입니다. 편집 버튼으로 내용을 바꿔주세요.", media:{type:"color",src:""} });
}

/* ---- window에 등록 (render.js가 만든 HTML의 onclick에서 호출) ----------------- */
Object.assign(window, {
  openMenuManager, moveMenu, editMenu,
  syncSlug, toggleSubs, addSubRow, refreshSubEmpty,
  editWork, deleteWorkConfirm, onMediaTypeChange, onMediaFilePick, onMediaUrlInput, pickHue,
  addWorkImageRow, removeWorkImageRow, onWorkImgUrlInput, onWorkImgFilePick,
  editHomePage, editAboutPage, editGenericPage,
  addCommLink, editCommLink, deleteCommLink,
  openSettingsManager,
  onImgUrlInput, onImgFilePick, clearImgField,
});
