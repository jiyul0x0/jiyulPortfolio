// ============================================================================
// 방문자 페이지(index.html)와 관리자 페이지(admin.html)가 공유하는 렌더링 로직.
// ADMIN 이 true면 각 화면에 편집/추가/삭제 버튼이 추가로 렌더링됩니다.
// 그 버튼들의 실제 동작(모달 열기 등)은 admin.js 에서 window.* 로 등록합니다.
// ============================================================================

import { api, subscribeAll, debounce } from "./data.js?v=3";

export let ADMIN = false;
const app = () => document.getElementById("app");

export function esc(s){ return String(s??"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
export function shade(hex,amt){
  const n=parseInt(hex.slice(1),16); let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
}
export function accNo(n){ return "No."+String(n||0).padStart(3,"0"); }

/* ---- 메인 컬러 하나로 전체 톤(밝은/진한/그림자/연한 배경)을 계산해서 적용 -------- */
function hexToRgb(hex){
  hex=String(hex||"").replace("#","");
  if(hex.length===3) hex=hex.split("").map(c=>c+c).join("");
  const num=parseInt(hex,16);
  if(isNaN(num)) return null;
  return { r:(num>>16)&255, g:(num>>8)&255, b:num&255 };
}
function rgbToHex(r,g,b){
  return "#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
}
function mixHex(hex,target,amt){
  const a=hexToRgb(hex), b=hexToRgb(target); if(!a) return hex;
  return rgbToHex(a.r+(b.r-a.r)*amt, a.g+(b.g-a.g)*amt, a.b+(b.b-a.b)*amt);
}
const tint=(hex,amt)=>mixHex(hex,"#ffffff",amt);
const shadeC=(hex,amt)=>mixHex(hex,"#0c1a13",amt);

let lastTheme=null;
function applyTheme(hex){
  if(!hex || !hexToRgb(hex) || hex===lastTheme) return;
  lastTheme=hex;
  const r=document.documentElement.style;
  const greenLt=tint(hex,.16), greenDeep=shadeC(hex,.22), greenInk=shadeC(hex,.42);
  r.setProperty("--green",hex);
  r.setProperty("--green-lt",greenLt);
  r.setProperty("--green-deep",greenDeep);
  r.setProperty("--green-ink",greenInk);
  r.setProperty("--green-soft",tint(hex,.90));
  r.setProperty("--green-soft-2",tint(hex,.84));
  r.setProperty("--bg",tint(hex,.94));
  r.setProperty("--line",tint(hex,.87));
  r.setProperty("--line-soft",tint(hex,.91));
  r.setProperty("--surface-soft",tint(hex,.97));
  const dr=hexToRgb(greenDeep);
  r.setProperty("--green-deep-rgb",`${dr.r},${dr.g},${dr.b}`);
}

export function imageSliderHTML(images,alt){
  if(images.length<=1){
    return `<div class="detail-hero" style="aspect-ratio:16/8"><img src="${esc(images[0]||'')}" alt="${esc(alt)}"
      style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
  }
  const slides=images.map((src,i)=>`<img src="${esc(src)}" alt="${esc(alt)}" data-i="${i}"
      style="width:100%;height:100%;object-fit:cover;display:${i===0?'block':'none'};position:absolute;inset:0">`).join("");
  const dots=images.map((_,i)=>`<span class="slider-dot ${i===0?'on':''}" data-i="${i}"></span>`).join("");
  return `<div class="detail-hero slider" style="aspect-ratio:16/8" data-idx="0" data-count="${images.length}">
      ${slides}
      <button class="slider-nav prev" onclick="window.workSlide(this,-1)" aria-label="이전 이미지">‹</button>
      <button class="slider-nav next" onclick="window.workSlide(this,1)" aria-label="다음 이미지">›</button>
      <div class="slider-dots">${dots}</div>
    </div>`;
}
function workSlide(btn,dir){
  const wrap=btn.closest(".slider");
  const count=parseInt(wrap.dataset.count,10);
  let idx=parseInt(wrap.dataset.idx,10);
  idx=(idx+dir+count)%count;
  wrap.dataset.idx=idx;
  wrap.querySelectorAll("img[data-i]").forEach(img=>{ img.style.display=(parseInt(img.dataset.i,10)===idx)?"block":"none"; });
  wrap.querySelectorAll(".slider-dot").forEach(d=>{ d.classList.toggle("on",parseInt(d.dataset.i,10)===idx); });
}
window.workSlide=workSlide;

export function youtubeId(url){
  if(!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function mediaBlock(w,wrapClass,ratio){
  const style=`aspect-ratio:${ratio||'4/3'}`;
  const hue = w.hue||"#54a97a";
  const isDetail = wrapClass==="detail-hero";
  if(w.media&&w.media.type==="image"){
    const thumb=(w.media.images&&w.media.images.length)?w.media.images[0]:w.media.src;
    if(thumb){
      return `<div class="${wrapClass}" style="${style}"><img src="${esc(thumb)}" alt="${esc(w.title)}"
        style="width:100%;height:100%;object-fit:cover;display:block"><div class="sheen"></div></div>`;
    }
  }
  if(w.media&&w.media.type==="video"&&w.media.src){
    const yid=youtubeId(w.media.src);
    if(yid){
      return `<div class="${wrapClass}" style="${style};background:#111">
        <iframe src="https://www.youtube.com/embed/${yid}" style="width:100%;height:100%;display:block;border:0"
          allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if(isDetail){
      // 상세 페이지: 자동재생 없이 실제 컨트롤(음량 포함)로 재생
      return `<div class="${wrapClass}" style="${style};background:#111"><video src="${esc(w.media.src)}" controls playsinline
        style="width:100%;height:100%;object-fit:cover;display:block"></video></div>`;
    }
    // 목록 카드: 여러 개가 동시에 자동재생되므로 무음 미리보기 유지
    return `<div class="${wrapClass}" style="${style};background:#111"><video src="${esc(w.media.src)}" muted loop autoplay playsinline
      style="width:100%;height:100%;object-fit:cover;display:block"></video><div class="sheen"></div></div>`;
  }
  return `<div class="${wrapClass}" style="${style};
    background:linear-gradient(150deg,${shade(hue,25)},${hue} 55%,${shade(hue,-22)})"><div class="sheen"></div></div>`;
}

let menuCache=[];
export function catLabel(slug){
  const m = menuCache.find(x=>x.type==="gallery");
  return m?.submenus.find(s=>s.slug===slug)?.label || slug;
}

/* ============================================================================ ROUTER */
export async function router(){
  const raw=location.hash.replace(/^#\/?/,""); const parts=raw.split("/").filter(Boolean); const root=parts[0]||"home";
  if(root==="work"&&parts[2]==="item"){ menuCache=await api.getMenus(); return renderDetail(parts[3]); }
  const menus=await api.getMenus(); menuCache=menus;
  const menu=menus.find(m=>m.slug===root)||menus.find(m=>m.slug==="home")||menus[0];
  if(!menu) return renderShell(`<div class="wrap view"><p class="empty">아직 페이지가 없어요.${ADMIN?' 왼쪽 위 "메뉴 관리"에서 추가해 주세요.':''}</p></div>`);
  if(menu.slug==="home") return renderHome();
  if(menu.type==="gallery") return renderGallery(menu,parts[1]);
  if(menu.type==="commission") return renderCommission();
  return renderPage(menu);
}

/* ============================================================================ SHELL */
async function renderShell(inner){
  const menus=(await api.getMenus()).filter(m=>m.visible); menuCache = menuCache.length?menuCache:await api.getMenus();
  const s=await api.getSettings();
  if(s.themeColor) applyTheme(s.themeColor);
  const cur=location.hash.replace(/^#\/?/,"").split("/")[0]||"home";
  const nav=menus.map(m=>{
    const active=(m.slug===cur||(cur===""&&m.slug==="home"))?"active":"";
    const hasSub=(m.type==="gallery"||m.type==="commission")&&m.submenus.length;
    let sub="";
    if(hasSub){
      if(m.type==="gallery"){
        sub=`<div class="submenu"><a href="#/${m.slug}">All</a>${
          m.submenus.map(su=>`<a href="#/${m.slug}/${su.slug}">${esc(su.label)}</a>`).join("")}</div>`;
      }else{
        sub=`<div class="submenu">${
          m.submenus.map(su=>`<a href="${esc(su.url)}" target="_blank" rel="noopener noreferrer">${esc(su.label)} ↗</a>`).join("")}</div>`;
      }
    }
    return `<div class="menu-item"><a class="menu-link ${active}" href="#/${m.slug}">${esc(m.label)}${hasSub?'<span class="caret">▾</span>':''}</a>${sub}</div>`;
  }).join("");

  const adminStrip = ADMIN ? `<div class="admin-strip">
      <span>🔒 관리자 모드 — 페이지 곳곳의 편집 버튼으로 내용을 바꿀 수 있어요</span>
      <div class="actions">
        <button onclick="window.openMenuManager()">메뉴 관리</button>
        <button onclick="window.openSettingsManager()">설정</button>
        <button onclick="window.adminSignOut && window.adminSignOut()">로그아웃</button>
      </div>
    </div>` : "";

  app().innerHTML=`${adminStrip}
    <header class="nav"><div class="nav-inner">
      <a class="brand" href="#/home">${s.logoUrl?`<img src="${esc(s.logoUrl)}" alt="logo" style="width:36px;height:36px;border-radius:12px;object-fit:cover;box-shadow:0 6px 14px rgba(47,128,85,.30)">`:`<span class="mark">${esc((s.brandKo||"J")[0])}</span>`}
        <span class="txt">${esc(s.brandKo||"")}<small>${esc(s.brandEn||"")}</small></span></a>
      <button class="nav-toggle" aria-label="메뉴" onclick="document.querySelector('nav.menu').classList.toggle('open')">≡</button>
      <nav class="menu">${nav}</nav>
    </div></header>
    <main>${inner}</main>
    <footer class="site"><div class="foot-inner">
      <span>© ${new Date().getFullYear()} ${esc(s.brandKo||"")} · ${esc(s.tagline||"")}</span>
    </div></footer>`;
}

/* ============================================================================ HOME */
async function renderHome(){
  const p=await api.getPage("home")||{title:"",body:""};
  const menus=(await api.getMenus()).filter(m=>m.visible && m.slug!=="home");
  const iconFor=m=>m.type==="gallery"?"🗂️":m.type==="commission"?"✉️":"🙂";
  const cards=menus.map(m=>`<a class="nav-card" href="#/${m.slug}"><span class="arrow">↗</span>
      <span class="ic">${iconFor(m)}</span><h3>${esc(m.label)}</h3></a>`).join("");
  const editBtn = ADMIN?`<button class="admin-edit-fab" onclick="window.editHomePage()">✎ 배너 편집</button>`:"";
  const hasImg = !!p.bannerImage;
  const heroInner = `<div class="wrap hero-inner">
      <h1>${esc(p.title)}</h1>
      <p class="role" style="max-width:52ch;margin:0 auto">${esc(p.body)}</p>
    </div>`;
  const heroSection = hasImg
    ? `<section class="hero has-image">
        <img class="hero-bg-img" src="${esc(p.bannerImage)}" alt="">
        <div class="hero-overlay"></div>
        ${editBtn}${heroInner}
      </section>`
    : `<section class="hero">${editBtn}<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>${heroInner}</section>`;
  await renderShell(`
    <div class="anim">
      ${heroSection}
      <div class="wrap view">
        <div class="nav-cards">${cards||'<p class="empty">노출된 메뉴가 없어요.</p>'}</div>
      </div>
    </div>`);
}

function workCard(w){
  const adminBtns = ADMIN?`<div class="admin-card-tools">
      <button onclick="event.preventDefault();event.stopPropagation();window.editWork('${w.id}')" title="편집">✎</button>
      <button onclick="event.preventDefault();event.stopPropagation();window.deleteWorkConfirm('${w.id}')" title="삭제">🗑</button>
    </div>`:"";
  return `<a class="work" href="#/work/all/item/${w.id}">${mediaBlock(w,'cover')}${adminBtns}
    <div class="hoverlay"><span class="t">${esc(w.title)}</span><span class="no">${accNo(w.no)}</span></div></a>`;
}

/* ============================================================================ GALLERY */
async function renderGallery(menu,sub){
  const all=await api.getWorks();
  const cats=["all",...menu.submenus.map(s=>s.slug)];
  const active=sub&&cats.includes(sub)?sub:"all";
  const list=(active==="all"?all:all.filter(w=>w.cat===active)).sort((a,b)=>(b.year-a.year)||(b.no-a.no));
  const tabs=cats.map(c=>`<a class="tab-item ${c===active?'on':''}" href="#/${menu.slug}${c==='all'?'':'/'+c}">${c==='all'?'all':catLabel(c)}</a>`).join("");
  const years=list.map(w=>w.year).filter(Boolean);
  const range=years.length?(Math.min(...years)===Math.max(...years)?`${Math.min(...years)}`:`${Math.min(...years)}~${Math.max(...years)}`):"—";
  const rangeLabel=active==='all'?'All Works':catLabel(active);
  const gridHTML=list.length?`<div class="grid">${list.map(workCard).join("")}</div>`:`<p class="empty">이 카테고리에는 아직 작업물이 없어요.</p>`;
  const toolbarAdmin = ADMIN?`<div class="admin-toolbar">
      <button class="btn sm" onclick="window.editWork('')">+ 작업물 추가</button>
      <button class="btn ghost sm" onclick="window.editMenu('${menu.id}')">카테고리 관리</button>
    </div>`:"";
  await renderShell(`<div class="wrap view anim">
      <div class="tabs-plain">${tabs}</div>
      ${toolbarAdmin}
      <div class="range-title">${esc(rangeLabel)} (${range})</div>
      ${gridHTML}
    </div>`);
}

async function renderDetail(id){
  const w=(await api.getWorks()).find(x=>x.id===id);
  if(!w) return renderShell(`<div class="wrap view"><a class="back" href="#/work">← 목록</a><p class="empty">작업물을 찾을 수 없어요.</p></div>`);
  const adminBtns = ADMIN?`<div class="btn-row">
      <button class="btn sm" onclick="window.editWork('${w.id}')">✎ 편집</button>
      <button class="btn danger sm" onclick="window.deleteWorkConfirm('${w.id}',true)">🗑 삭제</button>
    </div>`:"";
  let heroHTML;
  if(w.media&&w.media.type==="image"){
    const images=(w.media.images&&w.media.images.length)?w.media.images:(w.media.src?[w.media.src]:[]);
    heroHTML=images.length?imageSliderHTML(images,w.title):mediaBlock(w,'detail-hero','16/8');
  }else{
    heroHTML=mediaBlock(w,'detail-hero','16/8');
  }
  await renderShell(`<div class="wrap view anim">
    <a class="back" href="#/work">← 인덱스로</a>
    ${heroHTML}
    <span class="badge-pill">${accNo(w.no)} · ${catLabel(w.cat)} · ${w.year}</span>
    <div class="page-head"><h1 style="margin-top:14px">${esc(w.title)}</h1>${adminBtns}</div>
    <div class="dspec">
      <div class="spec">
        <div class="srow"><span class="k">정리번호</span><span class="v">${accNo(w.no)}</span></div>
        <div class="srow"><span class="k">분류</span><span class="v">${catLabel(w.cat)}</span></div>
        <div class="srow"><span class="k">연도</span><span class="v">${w.year}</span></div>
      </div>
      <div class="prose card">${esc(w.desc).split("\n").filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join("")}</div>
    </div></div>`);
}

/* ============================================================================ PAGE */
async function renderPage(menu){
  if(menu.slug==="about") return renderAbout();
  const p=await api.getPage(menu.slug)||{title:menu.label,body:""};
  const paras=String(p.body||"").split("\n").filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join("");
  const editBtn = ADMIN?`<button class="btn ghost sm" onclick="window.editGenericPage('${menu.slug}','${esc(menu.label)}')" style="margin-top:16px">✎ 편집</button>`:"";
  await renderShell(`<div class="wrap view anim">
    <div class="page-head"><span class="badge-pill">${esc(menu.label).toUpperCase()}</span><h1>${esc(p.title||menu.label)}</h1></div>
    <div class="prose card">${paras||'<p style="color:var(--muted)">아직 내용이 없어요.</p>'}</div>${editBtn}</div>`);
}

async function renderAbout(){
  const p=await api.getPage("about")||{};
  const profTitle=p.profileTitle||"Profile", expTitle=p.expTitle||"Work Experience";
  const profParas=String(p.profileBody||"").split("\n").filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join("")
    ||'<p style="color:var(--muted)">아직 내용이 없어요.</p>';
  const expLines=String(p.expBody||"").split("\n").filter(Boolean);
  const expHTML=expLines.length
    ? `<ul style="list-style:none;display:flex;flex-direction:column;gap:11px">${expLines.map(l=>`<li style="font-size:15px;color:var(--ink);padding-bottom:11px;border-bottom:1px solid var(--line-soft)">${esc(l)}</li>`).join("")}</ul>`
    : '<p style="color:var(--muted)">아직 내용이 없어요.</p>';
  const editBtn = ADMIN?`<div style="text-align:right;margin-bottom:12px"><button class="btn ghost sm" onclick="window.editAboutPage()">✎ About 편집</button></div>`:"";
  await renderShell(`<div class="wrap view anim">${editBtn}
    <div class="split2">
      <div class="card"><h3>${esc(profTitle)}</h3>${profParas}</div>
      <div class="card"><h3>${esc(expTitle)}</h3>${expHTML}</div>
    </div></div>`);
}

/* ============================================================================ COMMISSION */
async function renderCommission(){
  const c=await api.getCommission();
  const links = c.links||[];
  const cards=links.map((l,i)=>{
    const adminBtns = ADMIN?`<div class="admin-card-tools">
        <button onclick="event.preventDefault();window.editCommLink(${i})" title="편집">✎</button>
        <button onclick="event.preventDefault();window.deleteCommLink(${i})" title="삭제">🗑</button>
      </div>`:"";
    return `<a class="link-card" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
      ${adminBtns}<span>${esc(l.label)}</span><span class="arrow">↗</span></a>`;
  }).join("");
  const addBtn = ADMIN?`<div style="text-align:center;margin-top:18px"><button class="btn" onclick="window.addCommLink()">+ 링크 추가</button></div>`:"";
  await renderShell(`<div class="wrap view anim" style="padding-top:48px">
      <div class="link-cards">${cards||'<p class="empty">등록된 링크가 없어요.</p>'}</div>
      ${addBtn}
    </div>`);
}

/* ============================================================================ INIT */
export async function initSite(opts){
  ADMIN = !!(opts && opts.admin);
  if(ADMIN) document.body.classList.add("admin-mode");
  window.addEventListener("hashchange", router);
  await router();
  subscribeAll(debounce(()=>router(), 200));
}
