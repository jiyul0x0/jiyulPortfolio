// ============================================================================
// Firestore 데이터 레이어. index.html(방문자)과 admin.html(관리자) 양쪽에서
// 똑같이 이 api 객체를 통해 데이터를 읽고 씁니다.
//
// Firestore 구조:
//   settings/site              (문서)  { brandKo, brandEn, tagline, year }
//   menus/{autoId}              (컬렉션) { label, slug, type, order, visible, submenus:[...] }
//   pages/{slug}                (컬렉션) home/about/기타 페이지형 메뉴의 텍스트 내용
//   commission/main             (문서)  { bannerTitle, links:[{label,url}] }
//   works/{autoId}               (컬렉션) { no, title, cat, year, hue, desc, media:{type,src} }
// ============================================================================

import { db } from "./firebase-config.js?v=3";
import {
  doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc,
  collection, getDocs, query, orderBy, onSnapshot, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const api = {
  async getSettings(){
    const snap = await getDoc(doc(db,"settings","site"));
    return snap.exists() ? snap.data() : { brandKo:"", brandEn:"", tagline:"", year:"" };
  },
  async saveSettings(s){
    await setDoc(doc(db,"settings","site"), s, { merge:true });
  },

  async getMenus(){
    const q = query(collection(db,"menus"), orderBy("order"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data(), submenus: d.data().submenus||[] }));
  },
  async saveMenu(m){
    const { id, ...data } = m;
    if(id) await setDoc(doc(db,"menus",id), data);
    else await addDoc(collection(db,"menus"), data);
  },
  async deleteMenu(id){ await deleteDoc(doc(db,"menus",id)); },
  async reorderMenus(list){
    const batch = writeBatch(db);
    list.forEach((m,i) => batch.update(doc(db,"menus",m.id), { order:i }));
    await batch.commit();
  },

  async getPage(slug){
    const snap = await getDoc(doc(db,"pages",slug));
    return snap.exists() ? snap.data() : null;
  },
  async savePage(slug, data){
    await setDoc(doc(db,"pages",slug), data, { merge:true });
  },

  async getCommission(){
    const snap = await getDoc(doc(db,"commission","main"));
    return snap.exists() ? snap.data() : { bannerTitle:"commission", links:[] };
  },
  async saveCommission(c){
    await setDoc(doc(db,"commission","main"), c);
  },

  async getWorks(){
    const snap = await getDocs(collection(db,"works"));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  },
  async saveWork(w){
    const { id, ...data } = w;
    if(id){ await setDoc(doc(db,"works",id), data); return; }
    const all = await getDocs(collection(db,"works"));
    const maxNo = all.docs.reduce((m,d) => Math.max(m, d.data().no||0), 0);
    await addDoc(collection(db,"works"), { ...data, no: maxNo+1 });
  },
  async deleteWork(id){ await deleteDoc(doc(db,"works",id)); },
};

// 방문자 페이지에서 실시간 반영을 위해 사용하는 구독 헬퍼.
// 메뉴/작업물/페이지/커미션/설정 중 무엇이든 바뀌면 콜백을 호출합니다.
export function subscribeAll(callback){
  const unsubs = [
    onSnapshot(collection(db,"menus"), callback, ()=>{}),
    onSnapshot(collection(db,"works"), callback, ()=>{}),
    onSnapshot(collection(db,"pages"), callback, ()=>{}),
    onSnapshot(doc(db,"commission","main"), callback, ()=>{}),
    onSnapshot(doc(db,"settings","site"), callback, ()=>{}),
  ];
  return () => unsubs.forEach(u => u());
}

export function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}
