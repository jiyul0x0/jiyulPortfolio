// ============================================================================
// 방문자 페이지(index.html)와 관리자 페이지(admin.html)가 공유하는 렌더링 로직.
// ADMIN 이 true면 각 화면에 편집/추가/삭제 버튼이 추가로 렌더링됩니다.
// 그 버튼들의 실제 동작(모달 열기 등)은 admin.js 에서 window.* 로 등록합니다.
// ============================================================================

import { api, subscribeAll, debounce } from "./data.js";

export let ADMIN = false;
const app = () => document.getElementById("app");

export function esc(s){ return String(s??"").replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
export function shade(hex,amt){
  const n=parseInt(hex.slice(1),16); let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
  r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
  return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
}
export function accNo(n){ return "No."+String(n||0).padStart(3,"0"); }

export function youtubeId(url){
  if(!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function mediaBlock(w,wrapClass,ratio){
  const style=`aspect-ratio:${ratio||'4/3'}`;
  const hue = w.hue||"#54a97a";
  if(w.media&&w.media.type==="image"&&w.media.src){
    return `<div class="${wrapClass}" style="${style}"><img src="${esc(w.media.src)}" alt="${esc(w.title)}"
      style="width:100%;height:100%;object-fit:cover;display:block"><div class="sheen"></div></div>`;
  }
  if(w.media&&w.media.type==="video"&&w.media.src){
    const yid=youtubeId(w.media.src);
    if(yid){
      return `<div class="${wrapClass}" style="${style};background:#111">
        <iframe src="https://www.youtube.com/embed/${yid}" style="width:100%;height:100%;display:block;border:0"
          allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;
    }
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
      <a class="brand" href="#/home"><span class="mark">${esc((s.brandKo||"J")[0])}</span>
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
  await renderShell(`
    <div class="anim">
      <section class="hero">${editBtn}<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
        <div class="wrap hero-inner">
          <h1>${esc(p.title)}</h1>
          <p class="role" style="max-width:52ch;margin:0 auto;color:var(--muted)">${esc(p.body)}</p>
        </div>
      </section>
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
  await renderShell(`<div class="wrap view anim">
    <a class="back" href="#/work">← 인덱스로</a>
    ${mediaBlock(w,'detail-hero','16/8')}
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
  const editBanner = ADMIN?`<button class="admin-edit-fab" onclick="window.editCommBanner()">✎ 배너 편집</button>`:"";
  const addBtn = ADMIN?`<div style="text-align:center;margin-top:18px"><button class="btn" onclick="window.addCommLink()">+ 링크 추가</button></div>`:"";
  await renderShell(`<div class="anim">
    <section class="hero">${editBanner}<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
      <div class="wrap hero-inner"><h1 style="margin-top:0">${esc(c.bannerTitle||"commission")}</h1></div>
    </section>
    <div class="wrap view">
      <div class="link-cards">${cards||'<p class="empty">등록된 링크가 없어요.</p>'}</div>
      ${addBtn}
    </div>
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
