import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { initSite } from "./render.js";
import "./admin.js"; // window.* 편집 함수 등록

const appRoot = document.getElementById("app");
const loginRoot = document.getElementById("login-root");
let started = false;

function showLogin(errMsg){
  appRoot.style.display = "none";
  loginRoot.style.display = "flex";
  loginRoot.innerHTML = `
    <div class="modal" style="max-width:400px">
      <span class="badge-pill" style="margin-bottom:14px">RESTRICTED</span>
      <h3 style="margin-top:14px">관리자 로그인</h3>
      <p class="hint" style="margin:-6px 0 18px">Firebase Authentication에 등록해 둔 이메일/비밀번호로 로그인하세요.</p>
      ${errMsg?`<div class="notice-box" style="background:#fbeee9;border-color:#f0cabc;color:#c0392b"><span>⚠️</span><span>${errMsg}</span></div>`:""}
      <label class="f"><span class="lab">이메일</span><input class="inp" id="li-email"></label>
      <label class="f"><span class="lab">비밀번호</span><input class="inp" type="password" id="li-pw"></label>
      <div class="btn-row"><button class="btn" id="li-btn">로그인</button>
        <a class="btn ghost" href="./index.html">사이트로</a></div>
    </div>`;
  document.getElementById("li-btn").onclick = async () => {
    const email = document.getElementById("li-email").value.trim();
    const pw = document.getElementById("li-pw").value;
    try{ await signInWithEmailAndPassword(auth, email, pw); }
    catch(e){ showLogin("로그인 실패: 이메일 또는 비밀번호를 확인해 주세요."); }
  };
  document.getElementById("li-email").focus();
}

window.adminSignOut = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if(user){
    loginRoot.style.display = "none";
    appRoot.style.display = "";
    if(!started){ started = true; initSite({ admin:true }); }
  } else {
    showLogin();
  }
});
