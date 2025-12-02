/* ===========================================================================
CONFIG SUPABASE
============================================================================= */
const SUPABASE_URL = '[https://hjrjcfloqdhbkpjpsdhn.supabase.co](https://hjrjcfloqdhbkpjpsdhn.supabase.co)';
const SUPABASE_ANON_KEY =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqcmpjZmxvcWRoYmtwanBzZGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDk2ODAsImV4cCI6MjA3ODY4NTY4MH0.zL3zexnUKamkJ0ZL_oHjX0AgcPxMBXIKamR0AVoR_0Q';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =============================================================================
VARIABLES GLOBALES
============================================================================= */
let currentUser = null;
let currentFavoriteType = 'equipes';

/* =============================================================================
INITIALISATION
============================================================================= */
async function initAuth() {
console.log("🚀 Initialisation AUTH…");
await restoreSession();
initAuthEventListeners();
}

document.addEventListener("DOMContentLoaded", initAuth);

/* =============================================================================
RESTAURATION SESSION
============================================================================= */
async function restoreSession() {
const user = localStorage.getItem('handix_session_user');
if (user) {
currentUser = JSON.parse(user);
console.log("🟢 Session restaurée :", currentUser);
showProfileSection();
updateProfileDisplay();
loadFavorites();
} else {
console.log("⚪ Aucun user stocké");
showAuthForm();
}
}

/* =============================================================================
INSCRIPTION
============================================================================= */
async function handleSignup() {
const email = document.getElementById("signup-email").value.trim();
const username = document.getElementById("signup-username").value.trim();
const password = document.getElementById("signup-password").value;
const confirmPassword = document.getElementById("signup-confirm-password").value;

```
console.log("📝 Inscription :", { email, username });

if (!validateEmail(email)) return showAuthMessage("Email invalide", "error");
if (!username) return showAuthMessage("Nom d’utilisateur requis", "error");
if (password.length < 6) return showAuthMessage("Mot de passe trop court", "error");
if (password !== confirmPassword) return showAuthMessage("Les mots de passe ne correspondent pas", "error");

try {
    const { data, error } = await supabase.rpc('signup_user', {
        _email: email,
        _username: username,
        _password: password
    });
    console.log("➡️ RPC signup_user response:", { data, error });
    if (error) return showAuthMessage(error.message, "error");

    showAuthMessage("Compte créé !", "success");
    setTimeout(() => {
        switchAuthTab("login");
        document.getElementById("login-email").value = email;
    }, 1000);
} catch (err) {
    console.error("❌ Erreur signup_user:", err);
    showAuthMessage("Erreur serveur lors de l'inscription", "error");
}
```

}

/* =============================================================================
CONNEXION
============================================================================= */
async function handleLogin() {
const email = document.getElementById("login-email").value.trim();
const password = document.getElementById("login-password").value;

```
console.log("🔐 Connexion avec :", { email, password });

if (!validateEmail(email)) return showAuthMessage("Email invalide", "error");

try {
    console.log("📡 Envoi de la requête RPC login_user...");
    const { data, error } = await supabase.rpc('login_user', {
        _email: email,
        _password: password
    });

    console.log("⬅️ RPC login_user response:", { data, error });

    if (error) {
        console.error("❌ Erreur login_user:", error);
        return showAuthMessage("Erreur serveur lors de la connexion", "error");
    }

    if (!data || data.length === 0) {
        console.warn("⚠️ Aucun utilisateur trouvé ou mot de passe incorrect");
        return showAuthMessage("Email ou mot de passe incorrect", "error");
    }

    currentUser = data[0];
    console.log("🟢 Utilisateur connecté :", currentUser);
    localStorage.setItem("handix_session_user", JSON.stringify(currentUser));

    updateProfileDisplay();
    showProfileSection();
    loadFavorites();
    showAuthMessage("Connexion réussie !", "success");
} catch (err) {
    console.error("❌ Erreur JS login_user:", err);
    showAuthMessage("Erreur serveur lors de la connexion", "error");
}
```

}

/* =============================================================================
DÉCONNEXION
============================================================================= */
function handleLogout() {
console.log("🔓 Déconnexion");
localStorage.removeItem('handix_session_user');
currentUser = null;
showAuthForm();
showAuthMessage("Déconnecté", "success");
}

/* =============================================================================
UI & UTIL
============================================================================= */
function updateProfileDisplay() {
if (!currentUser) return;
document.getElementById("profile-username").textContent = currentUser.username;
document.getElementById("profile-email").textContent = currentUser.email;
document.getElementById("edit-username").value = currentUser.username;
}

function showAuthForm() {
document.getElementById("profile-section").style.display = "none";
document.querySelector(".auth-container").style.display = "block";
switchAuthTab("login");
}

function showProfileSection() {
document.querySelector(".auth-container").style.display = "none";
document.getElementById("profile-section").style.display = "block";
}

function validateEmail(email) {
return /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(email);
}

function showAuthMessage(message, type) {
clearAuthMessages();
const msg = document.createElement("div");
msg.className = `auth-message ${type}`;
msg.textContent = message;
document.querySelector(".auth-container").prepend(msg);
console.log(`💬 Message Auth (${type}): ${message}`);
setTimeout(() => msg.remove(), 5000);
}

function clearAuthMessages() {
document.querySelectorAll(".auth-message").forEach(m => m.remove());
}

/* =============================================================================
ÉCOUTE DES ÉVÉNEMENTS
============================================================================= */
function initAuthEventListeners() {
document.getElementById("login-button").onclick = handleLogin;
document.getElementById("signup-button").onclick = handleSignup;
document.getElementById("logout-button").onclick = handleLogout;
document.getElementById("save-username").onclick = handleSaveUsername;

```
document.querySelectorAll(".tab").forEach(tab =>
    tab.onclick = () => {
        switchAuthTab(tab.dataset.tab);
        clearAuthMessages();
    }
);
```

}

function switchAuthTab(tab) {
document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));

```
document.querySelector(`.tab[data-tab="${tab}"]`).classList.add("active");
document.getElementById(`${tab}-form`).classList.add("active");
```

}

/* =============================================================================
MODIFICATION DU USERNAME
============================================================================= */
async function handleSaveUsername() {
const newUsername = document.getElementById("edit-username").value.trim();
if (!newUsername || !currentUser) return showAuthMessage("Nom invalide", "error");

```
console.log("✏️ Changement de username:", newUsername);

const { error } = await supabase
    .from("users")
    .update({ username: newUsername })
    .eq("id", currentUser.id);

if (error) {
    console.error("❌ Erreur update username:", error);
    return showAuthMessage("Erreur serveur", "error");
}

currentUser.username = newUsername;
localStorage.setItem("handix_session_user", JSON.stringify(currentUser));
updateProfileDisplay();
showAuthMessage("Nom mis à jour ✔️", "success");
```

}


