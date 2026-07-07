// ============================================================================
// Firebase 초기화
// ----------------------------------------------------------------------------
// 1) https://console.firebase.google.com 에서 프로젝트를 만드세요.
// 2) 프로젝트 설정 > 내 앱 > 웹 앱 추가 후, 아래 firebaseConfig 값을
//    콘솔에 나오는 실제 값으로 전부 바꿔주세요.
// 3) 왼쪽 메뉴에서 다음 세 가지를 켜주세요 (모두 무료 Spark 플랜으로 충분합니다):
//      - Firestore Database  (프로덕션 모드로 시작)
//      - Storage
//      - Authentication > Sign-in method > 이메일/비밀번호 사용 설정
//    Authentication > Users 탭에서 본인이 로그인할 이메일/비밀번호를 직접 추가하세요.
// 4) 이 파일을 수정한 뒤 index.html / admin.html을 그대로 GitHub Pages에 올리면 됩니다.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBcq8nWL1_QCddRPVy348SNour5gQIX5E0",
  authDomain: "portfolio-31add.firebaseapp.com",
  projectId: "portfolio-31add",
  storageBucket: "portfolio-31add.firebasestorage.app",
  messagingSenderId: "867294442656",
  appId: "1:867294442656:web:9520a24f461cdcaf3385c5"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
