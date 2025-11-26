// -----------------------------------------------------------------------------
// CONFIG SUPABASE CONNEXION
// -----------------------------------------------------------------------------
const SUPABASE_URL = 'https://hjrjcfloqdhbkpjpsdhn.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqcmpjZmxvcWRoYmtwanBzZGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDk2ODAsImV4cCI6MjA3ODY4NTY4MH0.zL3zexnUKamkJ0ZL_oHjX0AgcPxMBXIKamR0AVoR_0Q';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -----------------------------------------------------------------------------
// VARIABLES
// -----------------------------------------------------------------------------
let currentUser = null;
let currentFavoriteType = 'equipes';

// -----------------------------------------------------------------------------
// INITIALISATION
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Initialisation de l’auth custom...');
    restoreSession();
    initAuthEventListeners();
});

// -----------------------------------------------------------------------------
// SYSTEME D'AUTH CUSTOM (TABLE users)
// -----------------------------------------------------------------------------

// 🔹 Au chargement : vérifie s’il y a un user en session (localStorage)
async function restoreSession() {
    const user = localStorage.getItem('handix_session_user');
    if (user) {
        currentUser = JSON.parse(user);
        console.log('🟢 Session restaurée →', currentUser);
        showProfileSection();
        updateProfileDisplay();
        loadFavorites();
    } else {
        console.log('⚪ Aucun user stocké');
        showAuthForm();
    }
}

// -----------------------------------------------------------------------------
// INSCRIPTION
// -----------------------------------------------------------------------------
async function handleSignup() {
    console.log('📝 Inscription custom...');
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!validateEmail(email)) return showAuthMessage('Email invalide', 'error');
    if (!username) return showAuthMessage('Nom d’utilisateur requis', 'error');
    if (password.length < 6) return showAuthMessage('Mot de passe trop court', 'error');
    if (password !== confirmPassword)
        return showAuthMessage('Les mots de passe ne correspondent pas', 'error');

    const password_hash = await bcrypt.hash(password, 10);

    // Vérifier si l’email existe déjà
    const { data: exists } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

    if (exists) {
        return showAuthMessage('Un compte existe déjà avec cet email', 'error');
    }

    // Insert user
    const { data, error } = await supabase.from('users').insert([
        {
            email: email,
            password_hash: password_hash,
            username: username,
            favorites_clubs: '[]',
            favorites_equipes: '[]',
            favorites_salles: '[]',
        },
    ]);

    if (error) {
        console.error(error);
        return showAuthMessage('Erreur: ' + error.message, 'error');
    }

    showAuthMessage('Compte créé avec succès !', 'success');

    // Passe automatiquement sur login + met l’email
    setTimeout(() => {
        switchAuthTab('login');
        document.getElementById('login-email').value = email;
    }, 1500);
}

// -----------------------------------------------------------------------------
// CONNEXION
// -----------------------------------------------------------------------------
async function handleLogin() {
    console.log('🔐 Connexion custom...');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!validateEmail(email))
        return showAuthMessage('Email invalide', 'error');

    // Récupère user
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !user) return showAuthMessage('Email introuvable', 'error');

    // Vérification hash
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return showAuthMessage('Mot de passe incorrect', 'error');

    // Session locale
    currentUser = user;
    localStorage.setItem('handix_session_user', JSON.stringify(user));

    updateProfileDisplay();
    showProfileSection();
    loadFavorites();
    showAuthMessage('Connexion réussie !', 'success');
}

// -----------------------------------------------------------------------------
// DÉCONNEXION
// -----------------------------------------------------------------------------
function handleLogout() {
    localStorage.removeItem('handix_session_user');
    currentUser = null;
    showAuthForm();
    showAuthMessage('Déconnecté', 'success');
}

// -----------------------------------------------------------------------------
// CHANGEMENT DE USERNAME
// -----------------------------------------------------------------------------
async function handleSaveUsername() {
    const newUsername = document.getElementById('edit-username').value.trim();
    if (!newUsername) return showAuthMessage('Nom d’utilisateur invalide', 'error');
    if (!currentUser) return;

    const { error } = await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('id', currentUser.id);

    if (error) {
        console.error(error);
        return showAuthMessage('Erreur lors de la mise à jour', 'error');
    }

    currentUser.username = newUsername;
    localStorage.setItem('handix_session_user', JSON.stringify(currentUser));

    updateProfileDisplay();
    showAuthMessage('Nom mis à jour ✔️', 'success');
}

// -----------------------------------------------------------------------------
// FAVORIS (JSON dans ta base)
// -----------------------------------------------------------------------------
async function loadFavorites() {
    if (!currentUser) return;

    const list = document.getElementById('favorites-list');
    if (!list) return;

    let json;

    switch (currentFavoriteType) {
        case 'equipes':
            json = JSON.parse(currentUser.favorites_equipes);
            break;
        case 'salles':
            json = JSON.parse(currentUser.favorites_salles);
            break;
        case 'clubs':
            json = JSON.parse(currentUser.favorites_clubs);
            break;
    }

    if (!json || json.length === 0) {
        list.innerHTML = `
            <div class="no-favorites">
                <i class="ri-star-line"></i>
                <div>Aucun favori</div>
            </div>`;
        return;
    }

    list.innerHTML = json
        .map(
            (fav) => `
        <div class="favorite-item">
            <div class="favorite-item-content">
                <div class="favorite-item-name">${fav.name}</div>
            </div>
            <button class="remove-favorite" onclick="removeFavorite('${fav.id}')">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>`
        )
        .join('');
}

async function removeFavorite(id) {
    let listName;
    switch (currentFavoriteType) {
        case 'equipes':
            listName = 'favorites_equipes';
            break;
        case 'salles':
            listName = 'favorites_salles';
            break;
        case 'clubs':
            listName = 'favorites_clubs';
            break;
    }

    let arr = JSON.parse(currentUser[listName]);
    arr = arr.filter((f) => f.id !== id);

    const { error } = await supabase
        .from('users')
        .update({ [listName]: JSON.stringify(arr) })
        .eq('id', currentUser.id);

    if (!error) {
        currentUser[listName] = JSON.stringify(arr);
        localStorage.setItem('handix_session_user', JSON.stringify(currentUser));
        loadFavorites();
        showAuthMessage('Favori supprimé', 'success');
    }
}

// -----------------------------------------------------------------------------
// UI
// -----------------------------------------------------------------------------
function updateProfileDisplay() {
    if (!currentUser) return;

    document.getElementById('profile-username').textContent =
        currentUser.username || 'Utilisateur';

    document.getElementById('profile-email').textContent = currentUser.email;

    document.getElementById('edit-username').value =
        currentUser.username || '';
}

function showAuthForm() {
    document.getElementById('profile-section').style.display = 'none';
    document.querySelector('.auth-container').style.display = 'block';
    switchAuthTab('login');
}

function showProfileSection() {
    document.querySelector('.auth-container').style.display = 'none';
    document.getElementById('profile-section').style.display = 'block';
}

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showAuthMessage(message, type) {
    clearAuthMessages();

    const msg = document.createElement('div');
    msg.className = `auth-message ${type}`;
    msg.textContent = message;

    const cont = document.querySelector('.auth-container');
    cont.insertBefore(msg, cont.firstChild);

    setTimeout(() => msg.remove(), 5000);
}

function clearAuthMessages() {
    document.querySelectorAll('.auth-message').forEach((m) => m.remove());
}

function initAuthEventListeners() {
    document
        .getElementById('login-button')
        .addEventListener('click', handleLogin);

    document
        .getElementById('signup-button')
        .addEventListener('click', handleSignup);

    document
        .getElementById('logout-button')
        .addEventListener('click', handleLogout);

    document
        .getElementById('save-username')
        .addEventListener('click', handleSaveUsername);

    document.querySelectorAll('.favorite-tab').forEach((tab) =>
        tab.addEventListener('click', function () {
            currentFavoriteType = this.getAttribute('data-type');
            document
                .querySelectorAll('.favorite-tab')
                .forEach((t) => t.classList.remove('active'));
            this.classList.add('active');
            loadFavorites();
        })
    );
}

// -----------------------------------------------------------------------------
// SWITCH CONNEXION <-> INSCRIPTION
// -----------------------------------------------------------------------------
function switchAuthTab(tab) {
    // désactive tous les onglets
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    // désactive tous les formulaires
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    // active l'onglet sélectionné
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
}

// Ajouter les listeners sur les tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function () {
        const selected = this.getAttribute('data-tab');
        switchAuthTab(selected);
        clearAuthMessages(); // on efface les messages d’erreurs
    });
});
