import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const navCta = document.getElementById("nav-cta");
const heroCta = document.getElementById("hero-cta");
const chatBubble = document.getElementById("chat-bubble");

onAuthStateChanged(auth, (user) => {
  if (user && navCta) {
    navCta.textContent = "Dashboard";
    navCta.href = "dashboard.html";
  }
  if (user && heroCta) {
    heroCta.href = "dashboard.html";
    heroCta.textContent = "Buka dashboard";
  }
  if (chatBubble) {
    chatBubble.href = user ? "aichat.html" : "login.html";
  }
});
