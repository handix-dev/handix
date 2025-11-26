/* =============================================================================
   CONFIG SUPABASE
============================================================================= */
const SUPABASE_URL = 'https://hjrjcfloqdhbkpjpsdhn.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqcmpjZmxvcWRoYmtwanBzZGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDk2ODAsImV4cCI6MjA3ODY4NTY4MH0.zL3zexnUKamkJ0ZL_oHjX0AgcPxMBXIKamR0AVoR_0Q';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =============================================================================
   INITIALISATION GLOBALE
============================================================================= */
async function initAuth() {
    console.log("🚀 Initialisation AUTH…");
    await restoreSession();
    initAuthEventListeners();
}

document.addEventListener("DOMContentLoaded", initAuth);

/* =============================================================================
   VARIABLES
============================================================================= */
let currentUser = null;
let currentFavoriteType = 'equipes';

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
   INSCRIPTION (RPC Supabase)
============================================================================= */
async function handleSignup() {
    console.log("📝 Inscription via RPC...");
    const email = document.getElementById("signup-email").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;

    if (!validateEmail(email)) return showAuthMessage("Email invalide", "error");
    if (!username) return showAuthMessage("Nom d’utilisateur requis", "error");
    if (password.length < 6) return showAuthMessage("Mot de passe trop court", "error");
    if (password !== confirmPassword) return showAuthMessage("Les mots de passe ne correspondent pas", "error");

    const { data, error } = await supabase.rpc('signup_user', {
        _email: email,
        _username: username,
        _password: password
    });

    if (error) return showAuthMessage(error.message, "error");

    showAuthMessage("Compte créé !", "success");
    setTimeout(() => {
        switchAuthTab("login");
        document.getElementById("login-email").value = email;
    }, 1000);
}

/* =============================================================================
   CONNEXION (RPC Supabase)
============================================================================= */
async function handleLogin() {
    console.log("🔐 Connexion via RPC...");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!validateEmail(email)) return showAuthMessage("Email invalide", "error");

    const { data, error } = await supabase.rpc('login_user', {
        _email: email,
        _password: password
    });

    if (error || !data || data.length === 0)
        return showAuthMessage("Email ou mot de passe incorrect", "error");

    currentUser = data[0];
    localStorage.setItem("handix_session_user", JSON.stringify(currentUser));

    updateProfileDisplay();
    showProfileSection();
    loadFavorites();
    showAuthMessage("Connexion réussie !", "success");
}

/* =============================================================================
   DÉCONNEXION
============================================================================= */
function handleLogout() {
    localStorage.removeItem("handix_session_user");
    currentUser = null;
    showAuthForm();
    showAuthMessage("Déconnecté", "success");
}

/* =============================================================================
   PROFIL
============================================================================= */
async function handleSaveUsername() {
    const newUsername = document.getElementById("edit-username").value.trim();
    if (!newUsername || !currentUser) return showAuthMessage("Nom invalide", "error");

    const { error } = await supabase
        .from("users")
        .update({ username: newUsername })
        .eq("id", currentUser.id);

    if (error) return showAuthMessage("Erreur serveur", "error");

    currentUser.username = newUsername;
    localStorage.setItem("handix_session_user", JSON.stringify(currentUser));
    updateProfileDisplay();
    showAuthMessage("Nom mis à jour ✔️", "success");
}

/* =============================================================================
   FAVORIS
============================================================================= */
async function loadFavorites() {
    if (!currentUser) return;
    const list = document.getElementById("favorites-list");
    if (!list) return;

    let json = [];
    switch (currentFavoriteType) {
        case "equipes": json = JSON.parse(currentUser.favorites_equipes); break;
        case "salles": json = JSON.parse(currentUser.favorites_salles); break;
        case "clubs": json = JSON.parse(currentUser.favorites_clubs); break;
    }

    if (!json || json.length === 0) {
        list.innerHTML = `<div class="no-favorites"><i class="ri-star-line"></i><div>Aucun favori</div></div>`;
        return;
    }

    list.innerHTML = json.map(f => `
        <div class="favorite-item">
            <div class="favorite-item-name">${f.name}</div>
            <button onclick="removeFavorite('${f.id}')" class="remove-favorite">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
    `).join("");
}

async function removeFavorite(id) {
    let field = {
        equipes: "favorites_equipes",
        salles: "favorites_salles",
        clubs: "favorites_clubs"
    }[currentFavoriteType];

    let arr = JSON.parse(currentUser[field]).filter(f => f.id !== id);

    const { error } = await supabase
        .from("users")
        .update({ [field]: JSON.stringify(arr) })
        .eq("id", currentUser.id);

    if (!error) {
        currentUser[field] = JSON.stringify(arr);
        localStorage.setItem("handix_session_user", JSON.stringify(currentUser));
        loadFavorites();
        showAuthMessage("Favori supprimé", "success");
    }
}

/* =============================================================================
   UI
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

/* =============================================================================
   UTILS
============================================================================= */
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showAuthMessage(message, type) {
    clearAuthMessages();
    const msg = document.createElement("div");
    msg.className = `auth-message ${type}`;
    msg.textContent = message;
    document.querySelector(".auth-container").prepend(msg);
    setTimeout(() => msg.remove(), 5000);
}

function clearAuthMessages() {
    document.querySelectorAll(".auth-message").forEach(m => m.remove());
}

/* =============================================================================
   EVENT LISTENERS
============================================================================= */
function initAuthEventListeners() {
    document.getElementById("login-button").onclick = handleLogin;
    document.getElementById("signup-button").onclick = handleSignup;
    document.getElementById("logout-button").onclick = handleLogout;
    document.getElementById("save-username").onclick = handleSaveUsername;

    document.querySelectorAll(".favorite-tab").forEach(tab =>
        tab.onclick = () => {
            currentFavoriteType = tab.dataset.type;
            document.querySelectorAll(".favorite-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            loadFavorites();
        }
    );

    document.querySelectorAll(".tab").forEach(tab =>
        tab.onclick = () => {
            switchAuthTab(tab.dataset.tab);
            clearAuthMessages();
        }
    );
}

/* =============================================================================
   SWITCH AUTH TABS
============================================================================= */
function switchAuthTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));

    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add("active");
    document.getElementById(`${tab}-form`).classList.add("active");
}
