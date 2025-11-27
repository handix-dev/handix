// Configuration Supabase
const SUPABASE_URL = 'https://hjrjcfloqdhbkpjpsdhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqcmpjZmxvcWRoYmtwanBzZGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDk2ODAsImV4cCI6MjA3ODY4NTY4MH0.zL3zexnUKamkJ0ZL_oHjX0AgcPxMBXIKamR0AVoR_0Q';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables globales
let map;
let userLocation = null;
let clubsData = [];
let venuesMarkers = [];
let currentPage = 'home';
let currentMatchFilter = 'upcoming';
let currentVenueDetails = null;
let currentClubDetails = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    detectCurrentPage();
    initApp();
});

function detectCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'home.html';
    
    if (page.includes('salles.html')) {
        currentPage = 'salles';
    } else if (page.includes('matchs.html')) {
        currentPage = 'matchs';
    } else if (page.includes('profil.html')) {
        currentPage = 'profil';
    } else if (page.includes('clubs.html')) {
        currentPage = 'clubs';
    } else {
        currentPage = 'home';
    }
    
    console.log('Page détectée:', currentPage);
}

async function initApp() {
    console.log('🚀 Initialisation de la page:', currentPage);

    initFdmEvents();
    
    switch(currentPage) {
        case 'home':
            await loadTodayMatches();
            await loadFavoritesPreview();
            await extractClubsFromTeams();
            initHomeEventListeners();
            break;
        case 'salles':
            await initMap();
            await loadVenuesNearby();
            setTimeout(initSallesEventListeners, 100);
            break;
        case 'matchs':
            await initMatchesPage();
            break;
        case 'clubs':
            await initClubsPage();
            break;
    }
    
    requestLocationPermission();
    checkForNewMatches();
}

// FONCTIONS SPÉCIFIQUES POUR LA PAGE CLUBS
async function initClubsPage() {
    console.log('🚀 Initialisation de la page clubs...');
    await initClubsEventListeners();
    // NE PAS charger tous les clubs au démarrage - afficher un message d'accueil
    showInitialMessage();
}

function showInitialMessage() {
    const container = document.getElementById('clubs-results');
    if (!container) return;
    
    container.innerHTML = `
        <div class="no-results">
            <div class="no-results-icon">
                <i class="ri-search-line"></i>
            </div>
            <div>Recherchez un club</div>
            <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                Utilisez la barre de recherche pour trouver des clubs de handball
            </div>
        </div>
    `;
}

function initClubsEventListeners() {
    console.log('🎯 Initialisation des écouteurs clubs...');
    
    // Recherche de clubs
    const clubSearchBtn = document.getElementById('club-search-button');
    const clubSearchInput = document.getElementById('club-search');
    
    console.log('🔍 Éléments trouvés:', {
        clubSearchBtn: !!clubSearchBtn,
        clubSearchInput: !!clubSearchInput
    });

    if (clubSearchBtn && clubSearchInput) {
        clubSearchBtn.onclick = () => {
            const term = clubSearchInput.value.trim();
            console.log('🖱️ Bouton cliqué - Recherche clubs:', term);
            if (term) {
                searchClubs(term);
            } else {
                showInitialMessage();
            }
        };
        
        clubSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = clubSearchInput.value.trim();
                console.log('⌨️ Enter pressé - Recherche clubs:', term);
                if (term) {
                    searchClubs(term);
                } else {
                    showInitialMessage();
                }
            }
        });
        
        console.log('✅ Écouteurs clubs attachés avec succès');
    } else {
        console.error('❌ Éléments de recherche clubs non trouvés');
        showNotification('Erreur: éléments de recherche non chargés');
    }

    // Actualiser les clubs - maintenant relance la recherche actuelle
    const refreshClubs = document.getElementById('refresh-clubs');
    if (refreshClubs) {
        refreshClubs.onclick = () => {
            console.log('🔄 Actualisation clubs');
            const currentSearch = document.getElementById('club-search').value.trim();
            if (currentSearch) {
                searchClubs(currentSearch);
            } else {
                showInitialMessage();
            }
        };
    }

    // Bouton retour
    const backToClubs = document.getElementById('back-to-clubs');
    if (backToClubs) {
        backToClubs.onclick = () => {
            showClubsList();
        };
    }

    // Initialiser les onglets des matchs de club
    initClubMatchesTabs();
}

function initClubMatchesTabs() {
    const upcomingTab = document.getElementById('club-upcoming-tab');
    const resultsTab = document.getElementById('club-results-tab');
    
    if (upcomingTab) {
        upcomingTab.onclick = () => switchClubMatchesTab('upcoming');
    }
    
    if (resultsTab) {
        resultsTab.onclick = () => switchClubMatchesTab('results');
    }
}

function switchClubMatchesTab(tabType) {
    const upcomingTab = document.getElementById('club-upcoming-tab');
    const resultsTab = document.getElementById('club-results-tab');
    const matchesTitle = document.getElementById('club-matches-title');
    
    // Mettre à jour les onglets actifs
    if (upcomingTab) upcomingTab.classList.remove('active');
    if (resultsTab) resultsTab.classList.remove('active');
    
    if (tabType === 'upcoming') {
        if (upcomingTab) upcomingTab.classList.add('active');
        if (matchesTitle) matchesTitle.textContent = 'Matchs à venir';
        loadClubUpcomingMatches();
    } else if (tabType === 'results') {
        if (resultsTab) resultsTab.classList.add('active');
        if (matchesTitle) matchesTitle.textContent = 'Résultats';
        loadClubRecentResults();
    }
}

// FONCTIONS POUR LA NORMALISATION DES NOMS DE CLUBS
function normalizeClubName(teamName) {
    if (!teamName) return '';
    
    // Supprimer les parenthèses avec lettres (A), (B), etc.
    let normalized = teamName.replace(/\s*\([A-Z]\)\s*$/g, '');
    
    // Normaliser les abréviations courantes
    normalized = normalized
        .replace(/ENT\./g, 'ENTENTE')
        .replace(/ENT\s/g, 'ENTENTE ')
        .replace(/AS\./g, 'ASSOCIATION SPORTIVE ')
        .replace(/AS\s/g, 'ASSOCIATION SPORTIVE ')
        .replace(/US\./g, 'UNION SPORTIVE ')
        .replace(/US\s/g, 'UNION SPORTIVE ')
        .replace(/HB\./g, 'HANDBALL ')
        .replace(/HB\s/g, 'HANDBALL ')
        .replace(/HB\./g, 'HANDBALL')
        .replace(/HB\s/g, 'HANDBALL')
        .replace(/SH\./g, 'SPORTIF HANDBALL ')
        .replace(/SH\s/g, 'SPORTIF HANDBALL ');
    
    // Supprimer les espaces multiples et trim
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized.toUpperCase();
}

function extractBaseClubName(teamName) {
    const normalized = normalizeClubName(teamName);
    
    // Supprimer les mentions de catégories à la fin
    const baseName = normalized
        .replace(/\s+(FÉMININES?|FÉMININ|DAMES?|FEMININES?|FEMININ|WOMEN)$/i, '')
        .replace(/\s+(MASCULINS?|MASCULIN|HOMMES?|MEN|HOM)$/i, '')
        .replace(/\s+(U[0-9]{1,2}|JEUNES?|JUNIORS?|SENIORS?|VÉTÉRANS?)$/i, '')
        .replace(/\s+(NATIONALE|NATIONALE\s+[0-9]|REGIONAL|REGIONALE|DEPARTEMENTAL|DEPARTEMENTALE|D[0-9]|R[0-9])$/i, '')
        .trim();
    
    return baseName;
}

function groupSimilarClubs(matches) {
    const clubGroups = new Map();
    
    matches.forEach(match => {
        // Ignorer les matchs où le level contient " vs "
        if (match.level && match.level.includes(' vs ')) {
            return; // Skip ce match
        }
        
        // Traiter l'équipe domicile
        if (match.home_team) {
            const baseName = extractBaseClubName(match.home_team);
            const normalized = normalizeClubName(match.home_team);
            
            if (!clubGroups.has(baseName)) {
                clubGroups.set(baseName, {
                    baseName: baseName,
                    teamNames: new Set(),
                    normalizedNames: new Set(),
                    matchCount: 0,
                    levels: new Set()
                });
            }
            
            const group = clubGroups.get(baseName);
            group.teamNames.add(match.home_team);
            group.normalizedNames.add(normalized);
            group.matchCount++;
            if (match.level) group.levels.add(match.level);
        }
        
        // Traiter l'équipe extérieure
        if (match.away_team) {
            const baseName = extractBaseClubName(match.away_team);
            const normalized = normalizeClubName(match.away_team);
            
            if (!clubGroups.has(baseName)) {
                clubGroups.set(baseName, {
                    baseName: baseName,
                    teamNames: new Set(),
                    normalizedNames: new Set(),
                    matchCount: 0,
                    levels: new Set()
                });
            }
            
            const group = clubGroups.get(baseName);
            group.teamNames.add(match.away_team);
            group.normalizedNames.add(normalized);
            group.matchCount++;
            if (match.level) group.levels.add(match.level);
        }
    });
    
    // Convertir en tableau et trier par nombre de matchs
    return Array.from(clubGroups.values())
        .map(group => ({
            ...group,
            teamNames: Array.from(group.teamNames),
            normalizedNames: Array.from(group.normalizedNames),
            levels: Array.from(group.levels)
        }))
        .sort((a, b) => b.matchCount - a.matchCount);
}

// FONCTIONS PRINCIPALES POUR LES CLUBS - CHARGEMENT UNIQUEMENT LORS DE LA RECHERCHE
async function searchClubs(searchTerm) {
    try {
        console.log('🔍 Recherche clubs:', searchTerm);
        showLoading('clubs-results', `Recherche de clubs pour "${searchTerm}"...`);
        
        // Charger les données depuis Supabase UNIQUEMENT lors de la recherche
        const { data, error } = await supabase
            .from('matches')
            .select('home_team, away_team, level')
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%`)
            .limit(500); // Limiter pour les performances

        if (error) throw error;

        console.log(`📊 ${data?.length || 0} matchs trouvés pour la recherche`);

        if (!data || data.length === 0) {
            showNoResults(searchTerm);
            return;
        }

        // Grouper les clubs similaires UNIQUEMENT pour les résultats de recherche
        const groupedClubs = groupSimilarClubs(data);
        
        console.log(`🏟️ ${groupedClubs.length} clubs groupés trouvés`);
        displayClubs(groupedClubs, `Résultats pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur recherche clubs:', error);
        showError('clubs-results', 'Erreur lors de la recherche de clubs');
    }
}

function showNoResults(searchTerm) {
    const container = document.getElementById('clubs-results');
    if (!container) return;
    
    container.innerHTML = `
        <div class="no-results">
            <div class="no-results-icon">
                <i class="ri-team-line"></i>
            </div>
            <div>Aucun club trouvé</div>
            <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                Aucun résultat pour "${searchTerm}"
            </div>
        </div>
    `;
}

function displayClubs(clubs, title = 'Clubs') {
    const container = document.getElementById('clubs-results');
    if (!container) return;
    
    if (!clubs || clubs.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-team-line"></i>
                </div>
                <div>Aucun club trouvé</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    ${title.includes('Recherche') ? 'Essayez avec d\'autres termes de recherche' : 'Aucun club disponible'}
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--text-primary); font-size: 16px; font-weight: 600;">
            ${title} (${clubs.length})
        </div>
        ${clubs.map(club => {
            const isFav = isItemFavorite('club', club.baseName);
            const teamCount = club.teamNames.length;
            const levelInfo = club.levels.slice(0, 3).join(', ');
            
            return `
            <div class="card club-card" data-club-name="${club.baseName}">
                <div class="card-header">
                    <div class="card-icon">
                        <i class="ri-team-line"></i>
                    </div>
                    <div class="card-title">${club.baseName}</div>
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('club', '${club.baseName}', '${club.baseName}', 'club')">
                        <i class="ri-star-${isFav ? 'fill' : 'line'}"></i>
                    </button>
                </div>
                <div class="card-details">
                    <div><strong>Équipes:</strong> ${teamCount} équipe${teamCount > 1 ? 's' : ''}</div>
                    ${levelInfo ? `<div><strong>Niveaux:</strong> ${levelInfo}</div>` : ''}
                    ${club.matchCount ? `<div><strong>Matchs référencés:</strong> ${club.matchCount}</div>` : ''}
                    ${teamCount > 1 ? `
                    <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">
                        <i class="ri-information-line"></i> Regroupe: ${club.teamNames.slice(0, 3).join(', ')}${teamCount > 3 ? '...' : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('')}
    `;

    // Ajouter les écouteurs d'événements pour les cartes de club
    document.querySelectorAll('.club-card').forEach(card => {
        card.addEventListener('click', function() {
            const clubName = this.getAttribute('data-club-name');
            loadClubDetails(clubName);
        });
    });
}

async function loadClubDetails(clubName) {
    try {
        showLoading('club-detail-container', `Chargement des détails pour ${clubName}...`);
        
        const clubsResults = document.getElementById('clubs-results');
        const clubDetailView = document.getElementById('club-detail-view');
        
        if (clubsResults) clubsResults.style.display = 'none';
        if (clubDetailView) clubDetailView.style.display = 'block';

        // Stocker les détails du club courant
        currentClubDetails = {
            clubName: clubName
        };

        // Pour afficher les détails d'un club, on doit recharger les données spécifiques
        // car on n'a pas chargé tous les clubs au démarrage
        const { data, error } = await supabase
            .from('matches')
            .select('home_team, away_team, level')
            .or(`home_team.ilike.%${clubName}%,away_team.ilike.%${clubName}%`)
            .limit(200);

        if (error) throw error;

        // Regrouper les données pour ce club spécifique
        const groupedClubs = groupSimilarClubs(data || []);
        const club = groupedClubs.find(c => c.baseName === clubName);
        
        if (!club) {
            showError('club-detail-container', 'Club non trouvé');
            return;
        }

        displayClubDetails(club);
        
        // Charger les équipes et matchs
        await loadClubTeams(club);
        await loadClubUpcomingMatches(club);
        
    } catch (error) {
        console.error('❌ Erreur loadClubDetails:', error);
        showError('club-detail-container', 'Erreur lors du chargement des détails du club');
    }
}

function displayClubDetails(club) {
    const container = document.getElementById('club-detail-container');
    if (!container) return;
    
    const isFav = isItemFavorite('club', club.baseName);

    const html = `
        <div class="card">
            <div class="card-header">
                <div class="card-icon">
                    <i class="ri-team-line"></i>
                </div>
                <div class="card-title">${club.baseName}</div>
                <button class="favorite-btn ${isFav ? 'active' : ''}" 
                        onclick="toggleFavorite('club', '${club.baseName}', '${club.baseName}', 'club')">
                    <i class="ri-star-${isFav ? 'fill' : 'line'}"></i>
                </button>
            </div>
            <div class="card-details">
                <div><strong>Équipes:</strong> ${club.teamNames.length} équipe${club.teamNames.length > 1 ? 's' : ''}</div>
                ${club.levels.length > 0 ? `<div><strong>Niveaux:</strong> ${club.levels.join(', ')}</div>` : ''}
                <div><strong>Matchs référencés:</strong> ${club.matchCount}</div>
                <div style="margin-top: 12px;">
                    <strong>Équipes du club:</strong>
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
                        ${club.teamNames.map(team => `
                            <div class="filter-chip" onclick="searchTeamMatches('${team}')">
                                ${team}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

async function loadClubTeams(club) {
    try {
        if (!currentClubDetails) return;
        
        const container = document.getElementById('club-teams-results');
        if (!container) return;
        
        const teamsHtml = club.teamNames.map(teamName => {
            return `
            <div class="card" style="margin-bottom: 12px;">
                <div class="card-header">
                    <div class="card-icon">
                        <i class="ri-user-line"></i>
                    </div>
                    <div class="card-title">${teamName}</div>
                </div>
                <div class="card-details">
                    <button class="search-button" onclick="searchTeamMatches('${teamName}')" style="margin-top: 8px;">
                        <i class="ri-search-line"></i> Voir les matchs
                    </button>
                </div>
            </div>
            `;
        }).join('');
        
        container.innerHTML = teamsHtml;
        
    } catch (error) {
        console.error('❌ Erreur loadClubTeams:', error);
        showError('club-teams-results', 'Erreur lors du chargement des équipes');
    }
}

async function loadClubUpcomingMatches(club) {
    try {
        if (!currentClubDetails) return;
        
        showLoading('club-matches-results', 'Chargement des matchs à venir...');
        
        // Utiliser les noms d'équipes pour rechercher les matchs
        const teamNames = club.teamNames;
        
        const { data: matchesData, error } = await supabase
            .from('matches')
            .select('*')
            .or(teamNames.map(team => `home_team.eq.${team},away_team.eq.${team}`).join(','))
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(20);

        if (error) throw error;

        console.log(`🎯 ${matchesData?.length || 0} matchs à venir trouvés pour le club`);
        displayClubMatches(matchesData || [], 'club-matches-results', 'Matchs à venir');
        
    } catch (error) {
        console.error('❌ Erreur loadClubUpcomingMatches:', error);
        showError('club-matches-results', 'Erreur lors du chargement des matchs à venir');
    }
}

async function loadClubRecentResults(club) {
    try {
        if (!currentClubDetails) return;
        
        showLoading('club-matches-results', 'Chargement des résultats...');
        
        // Utiliser les noms d'équipes pour rechercher les matchs
        const teamNames = club.teamNames;
        
        const { data: matchesData, error } = await supabase
            .from('matches')
            .select('*')
            .or(teamNames.map(team => `home_team.eq.${team},away_team.eq.${team}`).join(','))
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(20);

        if (error) throw error;

        console.log(`🎯 ${matchesData?.length || 0} résultats trouvés pour le club`);
        displayClubMatchResults(matchesData || [], 'club-matches-results', 'Résultats');
        
    } catch (error) {
        console.error('❌ Erreur loadClubRecentResults:', error);
        showError('club-matches-results', 'Erreur lors du chargement des résultats');
    }
}

function displayClubMatches(matches, containerId, title = 'Matchs') {
    // Réutiliser la fonction displayMatches existante
    displayMatches(matches, containerId, title);
}

function displayClubMatchResults(matches, containerId, title = 'Résultats') {
    // Réutiliser la fonction displayMatchResults existante
    displayMatchResults(matches, containerId, title);
}

function showClubsList() {
    const clubsResults = document.getElementById('clubs-results');
    const clubDetailView = document.getElementById('club-detail-view');
    
    if (clubsResults) clubsResults.style.display = 'block';
    if (clubDetailView) clubDetailView.style.display = 'none';
    
    // Réinitialiser les détails de club courants
    currentClubDetails = null;
}

// FONCTIONS SPÉCIFIQUES POUR LA PAGE MATCHS
async function initMatchesPage() {
    console.log('🚀 Initialisation de la page matchs...');
    await initMatchesEventListeners();
    requestLocationPermission();
    
    // Charger les matchs à venir par défaut
    loadUpcomingMatches();
}

// Gestionnaire d'événements pour la navigation
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            if (target) {
                window.location.href = `${target}.html`;
            }
        });
    });
});

// FONCTIONS POUR LA PAGE HOME
function initHomeEventListeners() {
    // Recherche globale
    const homeSearchBtn = document.getElementById('home-search-button');
    const homeSearchInput = document.getElementById('home-search');
    
    if (homeSearchBtn && homeSearchInput) {
        homeSearchBtn.addEventListener('click', performGlobalSearch);
        homeSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performGlobalSearch();
        });
    }

    // Actions rapides
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', function() {
            const actionType = this.getAttribute('data-action');
            handleQuickAction(actionType);
        });
    });
}

function handleQuickAction(action) {
    switch(action) {
        case 'nearby':
            showNotification('Recherche des matchs près de vous...');
            break;
        case 'today':
            showNotification('Affichage des matchs du jour...');
            break;
        case 'favorites':
            showNotification('Ouverture des favoris...');
            break;
        case 'venues':
            window.location.href = 'salles.html';
            break;
    }
}

// FONCTIONS POUR LA PAGE SALLES
function initSallesEventListeners() {
    console.log('🎯 Initialisation des écouteurs salles...');
    
    const venueSearchBtn = document.getElementById('venue-search-button');
    const venueSearchInput = document.getElementById('venue-search');
    
    console.log('🔍 Éléments trouvés:', {
        venueSearchBtn: !!venueSearchBtn,
        venueSearchInput: !!venueSearchInput
    });

    if (venueSearchBtn && venueSearchInput) {
        venueSearchBtn.onclick = () => {
            const term = venueSearchInput.value.trim();
            console.log('🖱️ Bouton cliqué - Recherche:', term);
            if (term) {
                searchVenues(term);
            } else {
                showNotification('Veuillez entrer un terme de recherche');
            }
        };
        
        venueSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = venueSearchInput.value.trim();
                console.log('⌨️ Enter pressé - Recherche:', term);
                if (term) {
                    searchVenues(term);
                } else {
                    showNotification('Veuillez entrer un terme de recherche');
                }
            }
        });
        
        console.log('✅ Écouteurs salles attachés avec succès');
    } else {
        console.error('❌ Éléments de recherche non trouvés');
        showNotification('Erreur: éléments de recherche non chargés');
    }

    const refreshVenues = document.getElementById('refresh-venues');
    if (refreshVenues) {
        refreshVenues.onclick = () => {
            console.log('🔄 Actualisation salles');
            loadVenuesNearby();
        };
    }

    const backToVenues = document.getElementById('back-to-venues');
    if (backToVenues) {
        backToVenues.onclick = () => {
            showVenuesList();
        };
    }
}

// FONCTIONS POUR LA PAGE MATCHS
function initMatchesEventListeners() {
    console.log('🎯 Initialisation des écouteurs matchs...');
    
    // Initialiser les onglets
    initMatchesTabs();
    
    // Recherche de matchs
    const matchSearchBtn = document.getElementById('match-search-button');
    const matchSearchInput = document.getElementById('match-search');
    
    if (matchSearchBtn && matchSearchInput) {
        matchSearchBtn.onclick = () => {
            const term = matchSearchInput.value.trim();
            console.log('🖱️ Bouton cliqué - Recherche matchs:', term);
            if (term) {
                searchMatches(term);
            } else {
                showNotification('Veuillez entrer un terme de recherche');
            }
        };
        
        matchSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = matchSearchInput.value.trim();
                console.log('⌨️ Enter pressé - Recherche matchs:', term);
                if (term) {
                    searchMatches(term);
                } else {
                    showNotification('Veuillez entrer un terme de recherche');
                }
            }
        });
    }

    // Filtres rapides pour matchs à venir
    document.querySelectorAll('#upcoming-filters .filter-chip[data-filter]').forEach(chip => {
        chip.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            currentMatchFilter = filter; // Mettre à jour le filtre actuel
            handleMatchFilter(filter, this);
        });
    });

    // Filtres pour résultats
    document.querySelectorAll('#results-filters .filter-chip[data-filter]').forEach(chip => {
        chip.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            handleResultsFilter(filter, this);
        });
    });

    // Recherche par date pour matchs à venir
    const dateSearchBtn = document.getElementById('date-search-button');
    if (dateSearchBtn) {
        dateSearchBtn.onclick = () => {
            const date = document.getElementById('match-date').value;
            if (date) {
                searchMatchesByDate(date);
            } else {
                showNotification('Veuillez sélectionner une date');
            }
        };
    }

    // Recherche par date pour résultats
    const resultsDateSearchBtn = document.getElementById('results-date-search-button');
    if (resultsDateSearchBtn) {
        resultsDateSearchBtn.onclick = () => {
            const date = document.getElementById('results-date').value;
            if (date) {
                searchResultsByDate(date);
            } else {
                showNotification('Veuillez sélectionner une date');
            }
        };
    }

    // Actualiser les matchs
    const refreshMatches = document.getElementById('refresh-matches');
    if (refreshMatches) {
        refreshMatches.onclick = () => {
            console.log('🔄 Actualisation matchs');
            // Recharger selon l'onglet actif
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.getAttribute('data-tab') === 'results') {
                loadRecentResults();
            } else {
                // Recharger avec le filtre actuel et le terme de recherche
                const searchTerm = document.getElementById('match-search').value.trim();
                if (searchTerm) {
                    searchMatches(searchTerm);
                } else {
                    handleMatchFilter(currentMatchFilter);
                }
            }
        };
    }

    // Bouton retour
    const backToMatches = document.getElementById('back-to-matches');
    if (backToMatches) {
        backToMatches.onclick = () => {
            showMatchesList();
        };
    }
}

function initMatchesTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.getAttribute('data-tab');
            switchMatchesTab(tabType, this);
        });
    });
}

function switchMatchesTab(tabType, element) {
    // Mettre à jour les onglets actifs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
    
    // Mettre à jour le titre de section
    const sectionTitle = document.getElementById('matches-section-title');
    
    // Gérer l'affichage des filtres selon l'onglet
    const upcomingFilters = document.getElementById('upcoming-filters');
    const resultsFilters = document.getElementById('results-filters');
    const upcomingDatePicker = document.getElementById('date-picker-container');
    const resultsDatePicker = document.getElementById('results-date-picker-container');
    
    if (tabType === 'upcoming') {
        sectionTitle.textContent = 'Matchs à venir';
        // Afficher les filtres matchs à venir
        if (upcomingFilters) upcomingFilters.style.display = 'flex';
        if (resultsFilters) resultsFilters.style.display = 'none';
        if (upcomingDatePicker) upcomingDatePicker.style.display = 'none';
        if (resultsDatePicker) resultsDatePicker.style.display = 'none';
        
        // Activer le filtre "À venir" par défaut
        document.querySelectorAll('#upcoming-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
        const upcomingChip = document.querySelector('#upcoming-filters .filter-chip[data-filter="upcoming"]');
        if (upcomingChip) upcomingChip.classList.add('active');
        currentMatchFilter = 'upcoming';
        loadUpcomingMatches();
        
    } else if (tabType === 'results') {
        sectionTitle.textContent = 'Résultats';
        // Afficher les filtres résultats
        if (upcomingFilters) upcomingFilters.style.display = 'none';
        if (resultsFilters) resultsFilters.style.display = 'flex';
        if (upcomingDatePicker) upcomingDatePicker.style.display = 'none';
        if (resultsDatePicker) resultsDatePicker.style.display = 'none';
        
        // Activer le filtre "Récent" par défaut
        document.querySelectorAll('#results-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
        const recentChip = document.querySelector('#results-filters .filter-chip[data-filter="recent"]');
        if (recentChip) recentChip.classList.add('active');
        loadRecentResults();
    }
}

// FONCTIONS POUR LES MATCHS À VENIR
async function loadUpcomingMatches() {
    try {
        showLoading('matches-results', 'Chargement des matchs à venir...');
        
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(100);

        if (error) throw error;

        displayMatches(data, 'matches-results', 'Matchs à venir');
        
    } catch (error) {
        console.error('❌ Erreur loadUpcomingMatches:', error);
        showError('matches-results', 'Erreur lors du chargement des matchs');
    }
}

function handleMatchFilter(filter, element = null) {
    console.log('🎯 Filtre matchs:', filter);
    
    // Récupérer le terme de recherche actuel
    const searchTerm = document.getElementById('match-search').value.trim();
    
    // Si un élément est fourni, mettre à jour les classes actives
    if (element) {
        document.querySelectorAll('#upcoming-filters .filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
        element.classList.add('active');
    }
    
    // Gérer l'affichage du sélecteur de date
    const datePicker = document.getElementById('date-picker-container');
    if (filter === 'calendar') {
        datePicker.style.display = datePicker.style.display === 'none' ? 'block' : 'none';
        return;
    } else {
        datePicker.style.display = 'none';
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch(filter) {
        case 'today':
            if (searchTerm) {
                searchMatchesByDateAndTerm(todayStr, searchTerm);
            } else {
                searchMatchesByDate(todayStr);
            }
            break;
        case 'weekend':
            // Calculer le week-end (samedi et dimanche)
            const dayOfWeek = today.getDay();
            const saturday = new Date(today);
            saturday.setDate(today.getDate() + (6 - dayOfWeek));
            const sunday = new Date(today);
            sunday.setDate(today.getDate() + (7 - dayOfWeek));
            
            const saturdayStr = saturday.toISOString().split('T')[0];
            const sundayStr = sunday.toISOString().split('T')[0];
            
            if (searchTerm) {
                searchMatchesByDateRangeAndTerm(saturdayStr, sundayStr, searchTerm);
            } else {
                searchMatchesByDateRange(saturdayStr, sundayStr);
            }
            break;
        case 'upcoming':
            if (searchTerm) {
                searchMatches(searchTerm);
            } else {
                loadUpcomingMatches();
            }
            break;
        case 'nearby':
            if (searchTerm) {
                searchMatchesNearbyWithTerm(searchTerm);
            } else {
                loadMatchesNearby();
            }
            break;
    }
}

async function loadMatchesNearby() {
    try {
        showLoading('matches-results', 'Recherche des matchs près de vous...');
        
        if (!userLocation) {
            showError('matches-results', 'Activez la géolocalisation pour voir les matchs près de vous');
            return;
        }

        console.log('📍 Recherche matchs dans un rayon de 10km');

        // Récupérer toutes les salles avec coordonnées
        const { data: venuesData, error: venuesError } = await supabase
            .from('matches')
            .select('venue_name, venue_address, city, longitude, latitude')
            .not('venue_name', 'is', null)
            .not('longitude', 'is', null)
            .not('latitude', 'is', null)
            .limit(1000);

        if (venuesError) throw venuesError;

        // Filtrer les salles dans un rayon de 10km
        const nearbyVenues = filterVenuesByDistance(venuesData, userLocation, 10);
        const venueNames = nearbyVenues.map(venue => venue.venue_name);
        
        console.log(`📍 ${venueNames.length} salles trouvées dans un rayon de 10km`);

        if (venueNames.length === 0) {
            showError('matches-results', 'Aucune salle trouvée dans un rayon de 10km');
            return;
        }

        // Récupérer les matchs dans ces salles
        const today = new Date().toISOString().split('T')[0];
        const { data: matchesData, error: matchesError } = await supabase
            .from('matches')
            .select('*')
            .in('venue_name', venueNames)
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(100);

        if (matchesError) throw matchesError;

        console.log(`🎯 ${matchesData?.length || 0} matchs trouvés près de vous`);
        displayMatches(matchesData || [], 'matches-results', 'Matchs près de vous (10km)');
        
    } catch (error) {
        console.error('❌ Erreur loadMatchesNearby:', error);
        showError('matches-results', 'Erreur lors de la recherche des matchs près de vous');
    }
}

async function searchMatches(searchTerm) {
    try {
        console.log('🔍 Recherche matchs:', searchTerm);
        
        // Déterminer l'onglet actif
        const activeTab = document.querySelector('.tab.active');
        const isResultsTab = activeTab && activeTab.getAttribute('data-tab') === 'results';
        
        if (isResultsTab) {
            // Recherche dans les résultats
            showLoading('matches-results', `Recherche de résultats pour "${searchTerm}"...`);
            
            const today = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(today.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
            
            const { data, error } = await supabase
                .from('matches')
                .select('*')
                .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
                .gte('date', sevenDaysAgoStr)
                .lte('date', today.toISOString().split('T')[0])
                .not('score_home', 'is', null)
                .not('score_away', 'is', null)
                .order('date', { ascending: false })
                .order('time', { ascending: false })
                .limit(100);

            if (error) throw error;

            console.log('✅ Résultats de recherche trouvés:', data?.length || 0);
            displayMatchResults(data, 'matches-results', `Résultats pour "${searchTerm}"`);
            
        } else {
            // Recherche dans les matchs à venir (comportement existant)
            showLoading('matches-results', `Recherche de matchs pour "${searchTerm}"...`);
            
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('matches')
                .select('*')
                .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
                .gte('date', today)
                .order('date', { ascending: true })
                .order('time', { ascending: true })
                .limit(100);

            if (error) throw error;

            console.log('✅ Matchs trouvés:', data?.length || 0);
            displayMatches(data, 'matches-results', `Résultats pour "${searchTerm}"`);
        }
        
    } catch (error) {
        console.error('❌ Erreur recherche:', error);
        showError('matches-results', 'Erreur lors de la recherche: ' + error.message);
    }
}

async function searchMatchesByDate(date) {
    try {
        console.log('📅 Recherche matchs pour:', date);
        showLoading('matches-results', `Recherche des matchs du ${formatDateForDisplay(date)}...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('date', date)
            .order('time', { ascending: true })
            .limit(100);

        if (error) throw error;

        console.log('✅ Matchs trouvés pour cette date:', data?.length || 0);
        displayMatches(data, 'matches-results', `Matchs du ${formatDateForDisplay(date)}`);
        
    } catch (error) {
        console.error('❌ Erreur recherche par date:', error);
        showError('matches-results', 'Erreur lors de la recherche par date');
    }
}

async function searchMatchesByDateRange(startDate, endDate) {
    try {
        console.log('📅 Recherche matchs du', startDate, 'au', endDate);
        showLoading('matches-results', `Recherche des matchs du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)}...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(100);

        if (error) throw error;

        console.log('✅ Matchs trouvés pour cette période:', data?.length || 0);
        const title = `Matchs du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)}`;
        displayMatches(data, 'matches-results', title);
        
    } catch (error) {
        console.error('❌ Erreur recherche par période:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

// NOUVELLES FONCTIONS POUR LA COMBINAISON FILTRE + RECHERCHE
async function searchMatchesByDateAndTerm(date, searchTerm) {
    try {
        console.log('📅🔍 Recherche matchs pour:', date, 'avec terme:', searchTerm);
        showLoading('matches-results', `Recherche des matchs du ${formatDateForDisplay(date)} pour "${searchTerm}"...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('date', date)
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .order('time', { ascending: true })
            .limit(100);

        if (error) throw error;

        console.log('✅ Matchs trouvés pour cette date et terme:', data?.length || 0);
        displayMatches(data, 'matches-results', `Matchs du ${formatDateForDisplay(date)} pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur recherche par date et terme:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

async function searchMatchesByDateRangeAndTerm(startDate, endDate, searchTerm) {
    try {
        console.log('📅🔍 Recherche matchs du', startDate, 'au', endDate, 'avec terme:', searchTerm);
        showLoading('matches-results', `Recherche des matchs du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)} pour "${searchTerm}"...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(100);

        if (error) throw error;

        console.log('✅ Matchs trouvés pour cette période et terme:', data?.length || 0);
        const title = `Matchs du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)} pour "${searchTerm}"`;
        displayMatches(data, 'matches-results', title);
        
    } catch (error) {
        console.error('❌ Erreur recherche par période et terme:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

async function searchMatchesNearbyWithTerm(searchTerm) {
    try {
        showLoading('matches-results', `Recherche des matchs près de vous pour "${searchTerm}"...`);
        
        if (!userLocation) {
            showError('matches-results', 'Activez la géolocalisation pour voir les matchs près de vous');
            return;
        }

        console.log('📍 Recherche matchs dans un rayon de 10km pour:', searchTerm);

        // Récupérer toutes les salles avec coordonnées
        const { data: venuesData, error: venuesError } = await supabase
            .from('matches')
            .select('venue_name, venue_address, city, longitude, latitude')
            .not('venue_name', 'is', null)
            .not('longitude', 'is', null)
            .not('latitude', 'is', null)
            .limit(1000);

        if (venuesError) throw venuesError;

        // Filtrer les salles dans un rayon de 10km
        const nearbyVenues = filterVenuesByDistance(venuesData, userLocation, 10);
        const venueNames = nearbyVenues.map(venue => venue.venue_name);
        
        console.log(`📍 ${venueNames.length} salles trouvées dans un rayon de 10km`);

        if (venueNames.length === 0) {
            showError('matches-results', 'Aucune salle trouvée dans un rayon de 10km');
            return;
        }

        // Récupérer les matchs dans ces salles avec le terme de recherche
        const today = new Date().toISOString().split('T')[0];
        const { data: matchesData, error: matchesError } = await supabase
            .from('matches')
            .select('*')
            .in('venue_name', venueNames)
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%`)
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(100);

        if (matchesError) throw matchesError;

        console.log(`🎯 ${matchesData?.length || 0} matchs trouvés près de vous pour "${searchTerm}"`);
        displayMatches(matchesData || [], 'matches-results', `Matchs près de vous pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur searchMatchesNearbyWithTerm:', error);
        showError('matches-results', 'Erreur lors de la recherche des matchs près de vous');
    }
}

// FONCTIONS POUR LES RÉSULTATS
function handleResultsFilter(filter, element) {
    console.log('🎯 Filtre résultats:', filter);
    
    // Récupérer le terme de recherche actuel
    const searchTerm = document.getElementById('match-search').value.trim();
    
    // Gérer l'affichage du sélecteur de date
    const datePicker = document.getElementById('results-date-picker-container');
    if (filter === 'results-date') {
        datePicker.style.display = datePicker.style.display === 'none' ? 'block' : 'none';
        return;
    } else {
        datePicker.style.display = 'none';
    }
    
    // Mettre à jour les filtres actifs
    document.querySelectorAll('#results-filters .filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    element.classList.add('active');

    const today = new Date();
    
    switch(filter) {
        case 'recent':
            if (searchTerm) {
                searchResultsWithTerm(searchTerm);
            } else {
                loadRecentResults();
            }
            break;
        case 'last-weekend':
            // Week-end dernier (samedi et dimanche de la semaine dernière)
            const lastSaturday = new Date(today);
            lastSaturday.setDate(today.getDate() - today.getDay() - 1);
            const lastSunday = new Date(today);
            lastSunday.setDate(today.getDate() - today.getDay());
            
            const lastSaturdayStr = lastSaturday.toISOString().split('T')[0];
            const lastSundayStr = lastSunday.toISOString().split('T')[0];
            
            if (searchTerm) {
                searchResultsByDateRangeAndTerm(lastSaturdayStr, lastSundayStr, searchTerm);
            } else {
                searchResultsByDateRange(lastSaturdayStr, lastSundayStr);
            }
            break;
        case 'last-week':
            // 7 derniers jours complets
            const lastWeekStart = new Date(today);
            lastWeekStart.setDate(today.getDate() - 7);
            const lastWeekEnd = new Date(today);
            lastWeekEnd.setDate(today.getDate() - 1);
            
            const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
            const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];
            
            if (searchTerm) {
                searchResultsByDateRangeAndTerm(lastWeekStartStr, lastWeekEndStr, searchTerm);
            } else {
                searchResultsByDateRange(lastWeekStartStr, lastWeekEndStr);
            }
            break;
        case 'two-weeks-ago':
            // Week-end d'il y a 2 semaines
            const twoWeeksAgoSaturday = new Date(today);
            twoWeeksAgoSaturday.setDate(today.getDate() - today.getDay() - 8);
            const twoWeeksAgoSunday = new Date(today);
            twoWeeksAgoSunday.setDate(today.getDate() - today.getDay() - 7);
            
            const twoWeeksAgoSaturdayStr = twoWeeksAgoSaturday.toISOString().split('T')[0];
            const twoWeeksAgoSundayStr = twoWeeksAgoSunday.toISOString().split('T')[0];
            
            if (searchTerm) {
                searchResultsByDateRangeAndTerm(twoWeeksAgoSaturdayStr, twoWeeksAgoSundayStr, searchTerm);
            } else {
                searchResultsByDateRange(twoWeeksAgoSaturdayStr, twoWeeksAgoSundayStr);
            }
            break;
    }
}

async function loadRecentResults() {
    try {
        showLoading('matches-results', 'Chargement des résultats...');
        
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', sevenDaysAgoStr)
            .lte('date', today.toISOString().split('T')[0])
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(100);

        if (error) throw error;

        displayMatchResults(data, 'matches-results', 'Résultats récents');
        
    } catch (error) {
        console.error('❌ Erreur loadRecentResults:', error);
        showError('matches-results', 'Erreur lors du chargement des résultats');
    }
}

async function searchResultsByDate(date) {
    try {
        const searchTerm = document.getElementById('match-search').value.trim();
        
        if (searchTerm) {
            // Si un terme de recherche est présent, utiliser la fonction combinée
            return searchResultsByDateAndTerm(date, searchTerm);
        }

        console.log('📅 Recherche résultats pour:', date);
        showLoading('matches-results', `Recherche des résultats du ${formatDateForDisplay(date)}...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('date', date)
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('time', { ascending: false })
            .limit(100);

        if (error) throw error;

        console.log('✅ Résultats trouvés pour cette date:', data?.length || 0);
        displayMatchResults(data, 'matches-results', `Résultats du ${formatDateForDisplay(date)}`);
        
    } catch (error) {
        console.error('❌ Erreur recherche résultats par date:', error);
        showError('matches-results', 'Erreur lors de la recherche par date');
    }
}

// Fonction pour rechercher dans les résultats par date avec terme
async function searchResultsByDateAndTerm(date, searchTerm) {
    try {
        console.log('📅🔍 Recherche résultats pour:', date, 'avec terme:', searchTerm);
        showLoading('matches-results', `Recherche des résultats du ${formatDateForDisplay(date)} pour "${searchTerm}"...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('date', date)
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('time', { ascending: false })
            .limit(100);

        if (error) throw error;

        console.log('✅ Résultats trouvés pour cette date et terme:', data?.length || 0);
        displayMatchResults(data, 'matches-results', `Résultats du ${formatDateForDisplay(date)} pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur recherche résultats par date et terme:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

async function searchResultsByDateRange(startDate, endDate) {
    try {
        console.log('📅 Recherche résultats du', startDate, 'au', endDate);
        showLoading('matches-results', `Recherche des résultats du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)}...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(100);

        if (error) throw error;

        console.log('✅ Résultats trouvés pour cette période:', data?.length || 0);
        const title = `Résultats du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)}`;
        displayMatchResults(data, 'matches-results', title);
        
    } catch (error) {
        console.error('❌ Erreur recherche résultats par période:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

// FONCTIONS D'AFFICHAGE
function displayMatches(matches, containerId, title = 'Matchs') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-calendar-line"></i>
                </div>
                <div>Aucun match trouvé</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    Aucun match programmé
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 16px; font-weight: 600;">
            ${title} (${matches.length})
        </div>
        ${matches.map(match => {
            const matchDate = new Date(match.date);
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            
            // Formater l'adresse avec code postal et ville
            const venueInfo = formatVenueInfo(match);
            
            // Formater l'heure pour enlever les secondes
            const formattedTime = formatTime(match.time);
            
            return `
            <div class="match-card">
                <div class="match-header">
                    <div class="match-date">${formattedDate}</div>
                    <div class="match-level">${match.level || 'Niveau inconnu'}</div>
                </div>
                <div class="teams-container">
                    <div class="team">
                        <div class="team-logo">
                            ${match.home_logo ? 
                                `<img src="${match.home_logo}" alt="${match.home_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.home_logo ? 'display: none;' : 'display: flex;'}">🏠</div>
                        </div>
                        <div class="team-name">${match.home_team}</div>
                        <!-- Ajout d'un conteneur de score vide pour maintenir l'alignement -->
                        <div class="score-container" style="visibility: hidden;">
                            <div class="match-score">-</div>
                        </div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team">
                        <div class="team-logo">
                            ${match.away_logo ? 
                                `<img src="${match.away_logo}" alt="${match.away_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.away_logo ? 'display: none;' : 'display: flex;'}">✈️</div>
                        </div>
                        <div class="team-name">${match.away_team}</div>
                        <!-- Ajout d'un conteneur de score vide pour maintenir l'alignement -->
                        <div class="score-container" style="visibility: hidden;">
                            <div class="match-score">-</div>
                        </div>
                    </div>
                </div>
                <div class="match-footer">
                    <div class="match-venue">
                        ${formattedTime || 'Heure non précisée'} - ${venueInfo}
                    </div>
                </div>
            </div>
            `;
        }).join('')}
    `;
}

function displayMatchResults(matches, containerId, title = 'Résultats') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-trophy-line"></i>
                </div>
                <div>Aucun résultat trouvé</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    Aucun match terminé pour cette période
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 16px; font-weight: 600;">
            ${title} (${matches.length})
        </div>
        ${matches.map(match => {
            const matchDate = new Date(match.date);
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            
            // Déterminer le gagnant pour un style sobre
            const homeScore = parseInt(match.score_home) || 0;
            const awayScore = parseInt(match.score_away) || 0;
            const homeWon = homeScore > awayScore;
            const awayWon = awayScore > homeScore;
            
            // Formater l'adresse avec code postal et ville
            const venueInfo = formatVenueInfo(match);
            
            // Formater l'heure pour enlever les secondes
            const formattedTime = formatTime(match.time);
            
            // Vérifier si une feuille de match est disponible
            const hasFdm = match.fdm_url && match.fdm_url !== '';
            
            // CORRECTION : Échapper correctement l'URL
            const fdmUrl = hasFdm ? match.fdm_url.replace(/'/g, "\\'") : '';
            
            return `
            <div class="match-card">
                <div class="match-header">
                    <div class="match-date">${formattedDate}</div>
                    <div class="match-level">${match.level || 'Niveau inconnu'}</div>
                </div>
                <div class="teams-container">
                    <div class="team ${homeWon ? 'winner' : ''}">
                        <div class="team-logo">
                            ${match.home_logo ? 
                                `<img src="${match.home_logo}" alt="${match.home_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.home_logo ? 'display: none;' : 'display: flex;'}">🏠</div>
                        </div>
                        <div class="team-name">${match.home_team}</div>
                        <div class="score-container ${homeWon ? 'winner-score' : ''}">
                            <div class="match-score">${match.score_home || '-'}</div>
                        </div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team ${awayWon ? 'winner' : ''}">
                        <div class="team-logo">
                            ${match.away_logo ? 
                                `<img src="${match.away_logo}" alt="${match.away_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.away_logo ? 'display: none;' : 'display: flex;'}">✈️</div>
                        </div>
                        <div class="team-name">${match.away_team}</div>
                        <div class="score-container ${awayWon ? 'winner-score' : ''}">
                            <div class="match-score">${match.score_away || '-'}</div>
                        </div>
                    </div>
                </div>
                <div class="match-footer">
                    <div class="match-venue">${formattedTime} - ${venueInfo}</div>
                    ${hasFdm ? `
                    <button class="fdm-button" onclick="openFdmModal('${fdmUrl}')" title="Voir la feuille de match">
                        <i class="ri-file-text-line"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('')}
    `;
}

// Fonction pour formater l'heure (enlever les secondes)
function formatTime(timeString) {
    if (!timeString) return '';
    
    // Si le format est HH:MM:SS, on prend seulement HH:MM
    if (timeString.includes(':')) {
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}`;
        }
    }
    
    return timeString;
}

// Fonction pour formater les informations de lieu
function formatVenueInfo(match) {
    const parts = [];
    
    // Nom de la salle
    if (match.venue_name && match.venue_name !== 'Inconnu') {
        parts.push(match.venue_name);
    }
    
    // Code postal et ville (uniquement si différents du nom de la salle)
    if (match.postal_code && match.city) {
        const cityInfo = `${match.postal_code} ${match.city}`;
        // Éviter les doublons si le nom de la salle contient déjà la ville
        if (!match.venue_name || !match.venue_name.includes(match.city)) {
            parts.push(cityInfo);
        }
    } else if (match.city && (!match.venue_name || !match.venue_name.includes(match.city))) {
        parts.push(match.city);
    } else if (match.postal_code && (!match.venue_name || !match.venue_name.includes(match.postal_code))) {
        parts.push(match.postal_code);
    }
    
    // Si aucune information n'est disponible
    if (parts.length === 0) {
        return 'Lieu à confirmer';
    }
    
    return parts.join(' - ');
}

function showMatchesList() {
    const matchesResults = document.getElementById('matches-results');
    const matchDetailView = document.getElementById('match-detail-view');
    
    if (matchesResults) matchesResults.style.display = 'block';
    if (matchDetailView) matchDetailView.style.display = 'none';
}

function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

// FONCTIONS CARTE
function initMap() {
    return new Promise((resolve) => {
        const defaultCenter = userLocation || [48.8566, 2.3522];
        
        map = L.map('map').setView(defaultCenter, 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        if (userLocation) {
            // Icône maison rouge
            const homeIcon = L.divIcon({
                className: 'user-home-marker',
                html: `
                    <div style="
                        position: relative;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                            <path d="M9 22V12H15V22" fill="#ffffff"/>
                        </svg>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 32]
            });
            
            L.marker([userLocation.lat, userLocation.lng], { icon: homeIcon })
                .addTo(map)
                .bindPopup('<div style="font-weight: 600; color: #ef4444;">Votre position</div>')
                .openPopup();
        }

        resolve();
    });
}

function addVenueMarkers(venues) {
    if (!map) return;

    venuesMarkers.forEach(marker => map.removeLayer(marker));
    venuesMarkers = [];

    venues.forEach(venue => {
        if (venue.latitude && venue.longitude) {
            const lat = parseFloat(venue.latitude);
            const lng = parseFloat(venue.longitude);
            
            const marker = L.marker([lat, lng])
                .addTo(map)
                .bindPopup(`
                    <strong>${venue.venue_name}</strong><br>
                    ${venue.venue_address || ''}<br>
                    ${venue.city || ''}
                    <br><button onclick="loadVenueDetails('${venue.venue_name}')" style="margin-top: 8px; padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 12px;">Voir détails</button>
                `);
            
            venuesMarkers.push(marker);
        } else {
            console.warn('Coordonnées manquantes pour:', venue.venue_name);
        }
    });

    if (venuesMarkers.length > 0) {
        const group = new L.featureGroup(venuesMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    } else if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 13);
    }
}

// FONCTIONS SALLES
async function loadVenuesNearby() {
    try {
        showLoading('venues-results', 'Recherche des salles près de vous...');
        
        if (!userLocation) {
            showError('venues-results', 'Activez la géolocalisation pour voir les salles près de vous');
            return;
        }

        console.log('📍 Position utilisateur:', userLocation);

        const bbox = calculateBoundingBox(userLocation.lat, userLocation.lng, 20);
        
        console.log('📐 Bounding box:', bbox);

        const { data, error } = await supabase
            .from('matches')
            .select('venue_name, venue_address, city, longitude, latitude')
            .not('venue_name', 'is', null)
            .not('longitude', 'is', null)
            .not('latitude', 'is', null)
            .gte('latitude', bbox.minLat)
            .lte('latitude', bbox.maxLat)
            .gte('longitude', bbox.minLng)
            .lte('longitude', bbox.maxLng)
            .limit(100);

        if (error) throw error;

        console.log(`📊 ${data?.length || 0} salles trouvées dans la bounding box`);

        if (!data || data.length === 0) {
            console.log('🔍 Aucune salle dans 20km, extension à 50km...');
            return loadVenuesExtended(userLocation, 50);
        }

        const venuesWithDistance = data.map(venue => {
            const distance = calculateDistance(
                userLocation.lat, 
                userLocation.lng,
                parseFloat(venue.latitude),
                parseFloat(venue.longitude)
            );
            return {
                ...venue,
                distance: distance
            };
        }).sort((a, b) => a.distance - b.distance);

        const closestVenues = venuesWithDistance.slice(0, 10);
        
        console.log(`📍 ${closestVenues.length} salles les plus proches:`, 
            closestVenues.map(v => `${v.venue_name} (${v.distance.toFixed(1)}km)`));

        displayVenues(closestVenues, 'Salles près de vous');
        addVenueMarkers(closestVenues);
        
    } catch (error) {
        console.error('❌ Erreur loadVenuesNearby:', error);
        showError('venues-results', 'Erreur lors de la recherche des salles près de vous');
    }
}

// Fonction pour les recherches étendues
async function loadVenuesExtended(userLocation, radiusKm) {
    try {
        const bbox = calculateBoundingBox(userLocation.lat, userLocation.lng, radiusKm);
        
        console.log(`🔍 Recherche étendue à ${radiusKm}km:`, bbox);

        const { data, error } = await supabase
            .from('matches')
            .select('venue_name, venue_address, city, longitude, latitude')
            .not('venue_name', 'is', null)
            .not('longitude', 'is', null)
            .not('latitude', 'is', null)
            .gte('latitude', bbox.minLat)
            .lte('latitude', bbox.maxLat)
            .gte('longitude', bbox.minLng)
            .lte('longitude', bbox.maxLng)
            .limit(100);

        if (error) throw error;

        if (!data || data.length === 0) {
            showError('venues-results', `Aucune salle trouvée dans un rayon de ${radiusKm}km`);
            return;
        }

        const venuesWithDistance = data.map(venue => {
            const distance = calculateDistance(
                userLocation.lat, 
                userLocation.lng,
                parseFloat(venue.latitude),
                parseFloat(venue.longitude)
            );
            return {
                ...venue,
                distance: distance
            };
        }).sort((a, b) => a.distance - b.distance);

        const closestVenues = venuesWithDistance.slice(0, 10);
        
        displayVenues(closestVenues, `Salles dans un rayon de ${radiusKm}km`);
        addVenueMarkers(closestVenues);

    } catch (error) {
        console.error('❌ Erreur loadVenuesExtended:', error);
        showError('venues-results', 'Erreur lors de la recherche étendue');
    }
}

// Fonction pour calculer une bounding box autour d'un point
function calculateBoundingBox(lat, lng, radiusKm) {
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
    
    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta
    };
}

// Fonction pour calculer la distance entre deux points GPS (formule de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

// Fonction pour filtrer les salles par distance
function filterVenuesByDistance(venues, userLocation, maxDistanceKm) {
    return venues
        .map(venue => {
            const distance = calculateDistance(
                userLocation.lat, 
                userLocation.lng,
                parseFloat(venue.latitude),
                parseFloat(venue.longitude)
            );
            return {
                ...venue,
                distance: distance
            };
        })
        .filter(venue => venue.distance <= maxDistanceKm)
        .sort((a, b) => a.distance - b.distance);
}

async function searchVenues(searchTerm) {
    try {
        console.log('🔍 Recherche salles:', searchTerm);
        showLoading('venues-results', `Recherche de salles pour "${searchTerm}"...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('venue_name, venue_address, city, longitude, latitude')
            .or(`venue_name.ilike.%${searchTerm}%,venue_address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .not('venue_name', 'is', null)
            .not('longitude', 'is', null)
            .not('latitude', 'is', null)
            .order('city')
            .order('venue_name')
            .limit(100);

        if (error) {
            console.error('❌ Erreur Supabase:', error);
            throw error;
        }

        console.log('✅ Résultats trouvés dans toute la France:', data?.length || 0);

        displayVenues(data || [], `Résultats pour "${searchTerm}"`);
        addVenueMarkers(data || []);
        
    } catch (error) {
        console.error('❌ Erreur recherche salles:', error);
        showError('venues-results', 'Erreur lors de la recherche de salles: ' + error.message);
    }
}

function displayVenues(venues, title = 'Salles') {
    const container = document.getElementById('venues-results');
    if (!container) return;
    
    if (!venues || venues.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-map-pin-line"></i>
                </div>
                <div>Aucune salle trouvée</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    ${title.includes('10km') ? 'Aucune salle dans un rayon de 20km. Essayez de rechercher une ville spécifique.' : 'Essayez avec d\'autres termes de recherche'}
                </div>
            </div>
        `;
        return;
    }

    const uniqueVenues = [];
    const seenVenues = new Set();

    venues.forEach(venue => {
        const key = `${venue.venue_name}_${venue.venue_address}_${venue.city}`;
        if (!seenVenues.has(key)) {
            seenVenues.add(key);
            uniqueVenues.push(venue);
        }
    });

    container.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--text-primary); font-size: 16px; font-weight: 600;">
            ${title} (${uniqueVenues.length})
        </div>
        ${uniqueVenues.map(venue => {
            const isFav = isItemFavorite('venue', venue.venue_name + '_' + (venue.venue_address || ''));
            const hasCoords = venue.latitude && venue.longitude;
            const distance = venue.distance ? `${venue.distance.toFixed(1)} km` : 'Distance inconnue';
            
            // Formater l'adresse complète sans doublons
            const addressParts = [];
            if (venue.venue_address && venue.venue_address !== 'Inconnu') {
                addressParts.push(venue.venue_address);
            }
            
            // Ajouter code postal et ville seulement si différents de l'adresse
            if (venue.postal_code && venue.city) {
                const cityInfo = `${venue.postal_code} ${venue.city}`;
                if (!venue.venue_address || !venue.venue_address.includes(venue.city)) {
                    addressParts.push(cityInfo);
                }
            } else if (venue.city && (!venue.venue_address || !venue.venue_address.includes(venue.city))) {
                addressParts.push(venue.city);
            }
            
            const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Non disponible';
            
            return `
            <div class="card venue-card" 
                 data-venue-name="${venue.venue_name}" 
                 data-venue-address="${venue.venue_address || ''}">
                <div class="card-header">
                    <div class="card-icon">
                        <i class="ri-map-pin-line"></i>
                    </div>
                    <div class="card-title">${venue.venue_name}</div>
                    ${venue.distance ? `<div class="card-badge">${distance}</div>` : ''}
                </div>
                <div class="card-details">
                    <div><strong>Adresse:</strong> ${fullAddress}</div>
                    ${venue.distance ? `<div><strong>Distance:</strong> ${distance}</div>` : ''}
                    <div style="margin-top: 8px; color: var(--primary); font-size: 12px;">
                        <i class="ri-map-pin-line"></i> Voir sur la carte
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('venue', '${venue.venue_name + '_' + (venue.venue_address || '')}', '${venue.venue_name}', 'venue')">
                        <i class="ri-star-${isFav ? 'fill' : 'line'}"></i>
                    </button>
                    ${hasCoords ? `
                    <button style="background: var(--gradient-primary); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;"
                            onclick="event.stopPropagation(); centerMapOnVenue(${parseFloat(venue.latitude)}, ${parseFloat(venue.longitude)}, '${venue.venue_name}', '${venue.venue_address || ''}')">
                        <i class="ri-navigation-line"></i> Y aller
                    </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('')}
    `;

    document.querySelectorAll('.venue-card').forEach(card => {
        card.addEventListener('click', function() {
            const venueName = this.getAttribute('data-venue-name');
            const venueAddress = this.getAttribute('data-venue-address');
            loadVenueDetails(venueName, venueAddress);
        });
    });
}

// Fonction pour centrer la carte sur une salle
function centerMapOnVenue(lat, lng, venueName, venueAddress = null) {
    if (map) {
        map.setView([lat, lng], 15);
        L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`<strong>${venueName}</strong><br>${venueAddress || ''}<br>Centré sur cette salle`)
            .openPopup()
            .on('popupclose', function() {
                map.removeLayer(this);
            });
    }
}

// FONCTIONS POUR LA GESTION DES SALLES AVEC TOGGLE MATCHS/RÉSULTATS
async function loadVenueDetails(venueName, venueAddress = null) {
    try {
        showLoading('venue-detail-container', `Chargement des détails pour ${venueName}...`);
        
        const venuesResults = document.getElementById('venues-results');
        const venueDetailView = document.getElementById('venue-detail-view');
        
        if (venuesResults) venuesResults.style.display = 'none';
        if (venueDetailView) venueDetailView.style.display = 'block';

        // Stocker les détails de la salle courante
        currentVenueDetails = {
            venueName: venueName,
            venueAddress: venueAddress
        };

        let venueQuery = supabase
            .from('matches')
            .select('venue_name, venue_address, city, longitude, latitude')
            .not('longitude', 'is', null)
            .not('latitude', 'is', null)
            .limit(1);

        if (venueAddress && venueAddress !== 'null' && venueAddress !== '') {
            venueQuery = venueQuery.eq('venue_address', venueAddress);
        } else {
            venueQuery = venueQuery.eq('venue_name', venueName);
        }

        const { data: venueData, error: venueError } = await venueQuery;

        if (venueError) throw venueError;

        let teamsQuery = supabase
            .from('matches')
            .select('home_team')
            .limit(100);

        if (venueAddress && venueAddress !== 'null' && venueAddress !== '') {
            teamsQuery = teamsQuery.eq('venue_address', venueAddress);
        } else {
            teamsQuery = teamsQuery.eq('venue_name', venueName);
        }

        const { data: teamsData, error: teamsError } = await teamsQuery;

        if (teamsError) throw teamsError;

        const venue = venueData && venueData.length > 0 ? venueData[0] : null;
        const teams = analyzeMainClubsSimple(teamsData || []);
        
        displayVenueDetails(venue, teams, venueName, venueAddress);
        
        // Initialiser les onglets et charger les matchs à venir par défaut
        initVenueMatchesTabs();
        loadVenueUpcomingMatches();
        
    } catch (error) {
        console.error('❌ Erreur loadVenueDetails:', error);
        showError('venue-detail-container', 'Erreur lors du chargement des détails de la salle');
    }
}

// Fonction pour initialiser les onglets des matchs de salle
function initVenueMatchesTabs() {
    const upcomingTab = document.getElementById('venue-upcoming-tab');
    const resultsTab = document.getElementById('venue-results-tab');
    
    if (upcomingTab) {
        upcomingTab.onclick = () => switchVenueMatchesTab('upcoming');
    }
    
    if (resultsTab) {
        resultsTab.onclick = () => switchVenueMatchesTab('results');
    }
}

// Fonction pour changer d'onglet dans la vue salle
function switchVenueMatchesTab(tabType) {
    const upcomingTab = document.getElementById('venue-upcoming-tab');
    const resultsTab = document.getElementById('venue-results-tab');
    const matchesTitle = document.getElementById('venue-matches-title');
    
    // Mettre à jour les onglets actifs
    if (upcomingTab) upcomingTab.classList.remove('active');
    if (resultsTab) resultsTab.classList.remove('active');
    
    if (tabType === 'upcoming') {
        if (upcomingTab) upcomingTab.classList.add('active');
        if (matchesTitle) matchesTitle.textContent = 'Matchs à venir';
        loadVenueUpcomingMatches();
    } else if (tabType === 'results') {
        if (resultsTab) resultsTab.classList.add('active');
        if (matchesTitle) matchesTitle.textContent = 'Résultats';
        loadVenueRecentResults();
    }
}

// Fonction pour charger les matchs à venir d'une salle
async function loadVenueUpcomingMatches() {
    try {
        if (!currentVenueDetails) return;
        
        showLoading('venue-matches-results', 'Chargement des matchs à venir...');
        
        const today = new Date().toISOString().split('T')[0];
        
        let matchesQuery = supabase
            .from('matches')
            .select('*')
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(20);

        // Filtrer par venue_address
        if (currentVenueDetails.venueAddress && currentVenueDetails.venueAddress !== 'null' && currentVenueDetails.venueAddress !== '') {
            matchesQuery = matchesQuery.eq('venue_address', currentVenueDetails.venueAddress);
        } else {
            matchesQuery = matchesQuery.eq('venue_name', currentVenueDetails.venueName);
        }

        const { data: matchesData, error: matchesError } = await matchesQuery;

        if (matchesError) throw matchesError;

        console.log(`🎯 ${matchesData?.length || 0} matchs à venir trouvés pour la salle`);
        displayVenueMatches(matchesData || [], 'venue-matches-results', 'Matchs à venir');
        
    } catch (error) {
        console.error('❌ Erreur loadVenueUpcomingMatches:', error);
        showError('venue-matches-results', 'Erreur lors du chargement des matchs à venir');
    }
}

// Fonction pour charger les résultats récents d'une salle
async function loadVenueRecentResults() {
    try {
        if (!currentVenueDetails) return;
        
        showLoading('venue-matches-results', 'Chargement des résultats...');
        
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 120); // 30 derniers jours pour plus de résultats
        
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        let matchesQuery = supabase
            .from('matches')
            .select('*')
            .gte('date', thirtyDaysAgoStr)
            .lte('date', today.toISOString().split('T')[0])
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(50);

        // Filtrer par venue_address
        if (currentVenueDetails.venueAddress && currentVenueDetails.venueAddress !== 'null' && currentVenueDetails.venueAddress !== '') {
            matchesQuery = matchesQuery.eq('venue_address', currentVenueDetails.venueAddress);
        } else {
            matchesQuery = matchesQuery.eq('venue_name', currentVenueDetails.venueName);
        }

        const { data: matchesData, error: matchesError } = await matchesQuery;

        if (matchesError) throw matchesError;

        console.log(`🎯 ${matchesData?.length || 0} résultats trouvés pour la salle`);
        displayVenueMatchResults(matchesData || [], 'venue-matches-results', 'Résultats récents');
        
    } catch (error) {
        console.error('❌ Erreur loadVenueRecentResults:', error);
        showError('venue-matches-results', 'Erreur lors du chargement des résultats');
    }
}

// Fonction pour afficher les matchs d'une salle (version matchs à venir)
function displayVenueMatches(matches, containerId, title = 'Matchs') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-calendar-line"></i>
                </div>
                <div>Aucun match à venir</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    Aucun match programmé dans cette salle
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 16px; font-weight: 600;">
            ${title} (${matches.length})
        </div>
        ${matches.map(match => {
            const matchDate = new Date(match.date);
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            
            const venueInfo = formatVenueInfo(match);
            const formattedTime = formatTime(match.time);
            
            return `
            <div class="match-card">
                <div class="match-header">
                    <div class="match-date">${formattedDate}</div>
                    <div class="match-level">${match.level || 'Niveau inconnu'}</div>
                </div>
                <div class="teams-container">
                    <div class="team">
                        <div class="team-logo">
                            ${match.home_logo ? 
                                `<img src="${match.home_logo}" alt="${match.home_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.home_logo ? 'display: none;' : 'display: flex;'}">🏠</div>
                        </div>
                        <div class="team-name">${match.home_team}</div>
                        <div class="score-container" style="visibility: hidden;">
                            <div class="match-score">-</div>
                        </div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team">
                        <div class="team-logo">
                            ${match.away_logo ? 
                                `<img src="${match.away_logo}" alt="${match.away_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.away_logo ? 'display: none;' : 'display: flex;'}">✈️</div>
                        </div>
                        <div class="team-name">${match.away_team}</div>
                        <div class="score-container" style="visibility: hidden;">
                            <div class="match-score">-</div>
                        </div>
                    </div>
                </div>
                <div class="match-footer">
                    <div class="match-venue">
                        ${formattedTime || 'Heure non précisée'} - ${venueInfo}
                    </div>
                </div>
            </div>
            `;
        }).join('')}
    `;
}

// Fonction pour afficher les résultats d'une salle
function displayVenueMatchResults(matches, containerId, title = 'Résultats') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-trophy-line"></i>
                </div>
                <div>Aucun résultat trouvé</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    Aucun match terminé dans cette salle récemment
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--text-muted); font-size: 16px; font-weight: 600;">
            ${title} (${matches.length})
        </div>
        ${matches.map((match, index) => {
            const matchDate = new Date(match.date);
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            
            const homeScore = parseInt(match.score_home) || 0;
            const awayScore = parseInt(match.score_away) || 0;
            const homeWon = homeScore > awayScore;
            const awayWon = awayScore > homeScore;
            
            const venueInfo = formatVenueInfo(match);
            const formattedTime = formatTime(match.time);
            
            const hasFdm = match.fdm_url && match.fdm_url !== '';
            
            return `
            <div class="match-card" data-match-index="${index}">
                <div class="match-header">
                    <div class="match-date">${formattedDate}</div>
                    <div class="match-level">${match.level || 'Niveau inconnu'}</div>
                </div>
                <div class="teams-container">
                    <div class="team ${homeWon ? 'winner' : ''}">
                        <div class="team-logo">
                            ${match.home_logo ? 
                                `<img src="${match.home_logo}" alt="${match.home_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.home_logo ? 'display: none;' : 'display: flex;'}">🏠</div>
                        </div>
                        <div class="team-name">${match.home_team}</div>
                        <div class="score-container ${homeWon ? 'winner-score' : ''}">
                            <div class="match-score">${match.score_home || '-'}</div>
                        </div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team ${awayWon ? 'winner' : ''}">
                        <div class="team-logo">
                            ${match.away_logo ? 
                                `<img src="${match.away_logo}" alt="${match.away_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                                ''
                            }
                            <div class="logo-fallback" style="${match.away_logo ? 'display: none;' : 'display: flex;'}">✈️</div>
                        </div>
                        <div class="team-name">${match.away_team}</div>
                        <div class="score-container ${awayWon ? 'winner-score' : ''}">
                            <div class="match-score">${match.score_away || '-'}</div>
                        </div>
                    </div>
                </div>
                <div class="match-footer">
                    <div class="match-venue">${formattedTime} - ${venueInfo}</div>
                    ${hasFdm ? `
                    <button class="fdm-button" data-fdm-url="${match.fdm_url}" title="Voir la feuille de match">
                        <i class="ri-file-text-line"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('')}
    `;

    // Ajouter les écouteurs d'événements pour les boutons FDM
    container.querySelectorAll('.fdm-button').forEach(button => {
        button.addEventListener('click', function() {
            const fdmUrl = this.getAttribute('data-fdm-url');
            if (fdmUrl) {
                openFdmModal(fdmUrl);
            }
        });
    });
}

// Fonction pour analyser les clubs principaux - UNIQUEMENT LE PLUS FRÉQUENT
function analyzeMainClubsSimple(teamsData) {
    if (!teamsData || teamsData.length === 0) return [];

    const clubFrequency = new Map();

    teamsData.forEach(match => {
        const homeTeam = match.home_team;
        if (homeTeam) {
            const cleanClubName = homeTeam.replace(/\s*\([^)]*\)\s*$/, '').trim();
            clubFrequency.set(cleanClubName, (clubFrequency.get(cleanClubName) || 0) + 1);
        }
    });

    let mostFrequentClub = '';
    let maxFrequency = 0;

    clubFrequency.forEach((frequency, clubName) => {
        if (frequency > maxFrequency) {
            maxFrequency = frequency;
            mostFrequentClub = clubName;
        }
    });

    console.log(`🏟️ Club principal du gymnase: ${mostFrequentClub} (${maxFrequency} matchs)`);
    
    return mostFrequentClub ? [mostFrequentClub] : [];
}

function displayVenueDetails(venue, teams, venueName, venueAddress = null) {
    const container = document.getElementById('venue-detail-container');
    if (!container) return;
    
    const venueIdentifier = venueAddress && venueAddress !== 'null' && venueAddress !== '' ? 
        venueName + '_' + venueAddress : venueName;
    const isFav = isItemFavorite('venue', venueIdentifier);

    let html = `
        <div class="card">
            <div class="card-header">
                <div class="card-icon">
                    <i class="ri-map-pin-line"></i>
                </div>
                <div class="card-title">${venueName}</div>
                <button class="favorite-btn ${isFav ? 'active' : ''}" 
                        onclick="toggleFavorite('venue', '${venueIdentifier}', '${venueName}', 'venue')">
                    <i class="ri-star-${isFav ? 'fill' : 'line'}"></i>
                </button>
            </div>
            <div class="card-details">
    `;

    if (venue) {
        // Formater l'adresse complète sans doublons
        const addressParts = [];
        if (venue.venue_address && venue.venue_address !== 'Inconnu') {
            addressParts.push(venue.venue_address);
        }
        
        // Ajouter code postal et ville seulement si différents de l'adresse
        if (venue.postal_code && venue.city) {
            const cityInfo = `${venue.postal_code} ${venue.city}`;
            if (!venue.venue_address || !venue.venue_address.includes(venue.city)) {
                addressParts.push(cityInfo);
            }
        } else if (venue.city && (!venue.venue_address || !venue.venue_address.includes(venue.city))) {
            addressParts.push(venue.city);
        }
        
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Non disponible';
        
        html += `
                <div><strong>Adresse:</strong> ${fullAddress}</div>
        `;
        
        if (venue.latitude && venue.longitude) {
            let distanceHtml = '';
            if (userLocation) {
                const distance = calculateDistance(
                    userLocation.lat, 
                    userLocation.lng,
                    parseFloat(venue.latitude),
                    parseFloat(venue.longitude)
                );
                distanceHtml = `<div><strong>Distance:</strong> ${distance.toFixed(1)} km</div>`;
            }
            
            html += `
                ${distanceHtml}
            `;
            
            if (map) {
                map.setView([parseFloat(venue.latitude), parseFloat(venue.longitude)], 15);
                
                L.marker([parseFloat(venue.latitude), parseFloat(venue.longitude)])
                    .addTo(map)
                    .bindPopup(`<strong>${venueName}</strong><br>${fullAddress}`)
                    .openPopup();
            }
        }
    }

    if (teams.length > 0) {
        html += `
                <div style="margin-top: 16px;"><strong>Club résident:</strong></div>
                <div class="filters-container" style="margin-top: 8px;">
                    <div class="filter-chip" onclick="searchTeamMatches('${teams[0]}')">
                        ${teams[0]}
                    </div>
                </div>
        `;
    }

    html += `</div></div>`;

    container.innerHTML = html;
}

function showVenuesList() {
    const venuesResults = document.getElementById('venues-results');
    const venueDetailView = document.getElementById('venue-detail-view');
    
    if (venuesResults) venuesResults.style.display = 'block';
    if (venueDetailView) venueDetailView.style.display = 'none';
    
    // Réinitialiser les détails de salle courante
    currentVenueDetails = null;
}

function searchTeamMatches(teamName) {
    localStorage.setItem('searchTerm', teamName);
    window.location.href = 'matchs.html';
}

// FONCTIONS COMMUNES
function requestLocationPermission() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('📍 Localisation utilisateur:', userLocation);
                if (map && currentPage === 'salles') {
                    map.setView([userLocation.lat, userLocation.lng], 13);
                    
                    const homeIcon = L.divIcon({
                        className: 'user-home-marker',
                        html: `
                            <div style="
                                position: relative;
                                width: 32px;
                                height: 32px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                                    <path d="M9 22V12H15V22" fill="#ffffff"/>
                                </svg>
                            </div>
                        `,
                        iconSize: [32, 32],
                        iconAnchor: [16, 32]
                    });
                    
                    L.marker([userLocation.lat, userLocation.lng], { icon: homeIcon })
                        .addTo(map)
                        .bindPopup('<div style="font-weight: 600; color: #050f44;">Votre position</div>')
                }
            },
            (error) => {
                console.log('📍 Géolocalisation refusée ou erreur:', error);
                if (currentPage === 'salles' || currentPage === 'matchs') {
                    showNotification('Activez la géolocalisation pour voir les contenus près de vous');
                }
            }
        );
    }
}

// FONCTIONS FAVORIS
function getFavorites() {
    return JSON.parse(localStorage.getItem('handix_favorites') || '[]');
}

function saveFavorites(favorites) {
    localStorage.setItem('handix_favorites', JSON.stringify(favorites));
}

function isItemFavorite(type, id) {
    const favorites = getFavorites();
    return favorites.some(fav => fav.type === type && fav.id === id);
}

function toggleFavorite(type, id, name, category) {
    const favorites = getFavorites();
    const existingIndex = favorites.findIndex(fav => fav.type === type && fav.id === id);
    
    if (existingIndex > -1) {
        favorites.splice(existingIndex, 1);
        showNotification(`Retiré des favoris: ${name}`);
    } else {
        favorites.push({
            type,
            id,
            name,
            category,
            addedAt: new Date().toISOString()
        });
        showNotification(`Ajouté aux favoris: ${name}`);
    }
    
    saveFavorites(favorites);
    
    if (currentPage === 'home') {
        loadFavoritesPreview();
    }
}

function loadFavoritesPreview() {
    const favorites = getFavorites().slice(0, 2);
    const container = document.getElementById('favorites-preview');
    if (!container) return;
    
    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">
                    <i class="ri-star-line"></i>
                </div>
                <div>Aucun favori</div>
                <div style="margin-top: 8px; font-size: 14px; color: var(--text-muted);">
                    Ajoutez des équipes à vos favoris en cliquant sur l'étoile
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = favorites.map(fav => {
        const icon = getFavoriteIcon(fav.category);
        
        return `
        <div class="card">
            <div class="card-header">
                <div class="card-icon">
                    ${icon}
                </div>
                <div class="card-title">${fav.name}</div>
                <button class="favorite-btn active" 
                        onclick="toggleFavorite('${fav.type}', '${fav.id}', '${fav.name}', '${fav.category}')">
                    <i class="ri-star-fill"></i>
                </button>
            </div>
            <div class="card-details">
                ${getFavoriteDetails(fav)}
            </div>
        </div>
        `;
    }).join('');
}

function getFavoriteIcon(category) {
    switch(category) {
        case 'team': return '<i class="ri-team-line"></i>';
        case 'venue': return '<i class="ri-map-pin-line"></i>';
        case 'club': return '<i class="ri-building-line"></i>';
        default: return '<i class="ri-star-line"></i>';
    }
}

function getFavoriteDetails(fav) {
    switch(fav.category) {
        case 'team': return 'Équipe de handball';
        case 'venue': return 'Salle de sport';
        case 'club': return 'Club de handball';
        default: return 'Favori';
    }
}

// FONCTIONS MATCHS (pour home.html)
async function loadTodayMatches() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('date', today)
            .order('time', { ascending: true })
            .limit(5);

        if (error) throw error;
        displayMatches(data, 'today-matches', 'Aujourd\'hui');
    } catch (error) {
        showError('today-matches', 'Erreur lors du chargement des matchs du jour');
    }
}

// FONCTIONS CLUBS
async function extractClubsFromTeams() {
    try {
        const { data, error } = await supabase
            .from('matches')
            .select('home_team, away_team, level')
            .limit(1000);

        if (error) throw error;

        const clubNames = new Set();
        
        data.forEach(match => {
            const homeClub = match.home_team.split(' ')[0];
            const awayClub = match.away_team.split(' ')[0];
            
            clubNames.add(homeClub);
            clubNames.add(awayClub);
        });

        clubsData = Array.from(clubNames).map(name => ({
            name: name,
            teams: [],
            level: 'Multiple'
        }));

        clubsData.forEach(club => {
            club.teams = data
                .filter(match => 
                    match.home_team.includes(club.name) || 
                    match.away_team.includes(club.name)
                )
                .map(match => match.home_team.includes(club.name) ? match.home_team : match.away_team)
                .filter((team, index, arr) => arr.indexOf(team) === index)
                .slice(0, 5);
        });

    } catch (error) {
        console.error('Erreur extraction clubs:', error);
    }
}

// FONCTIONS RECHERCHE GLOBALE
function performGlobalSearch() {
    const searchTerm = document.getElementById('home-search').value.trim();
    if (searchTerm.length < 2) return;

    showNotification(`Recherche de "${searchTerm}"...`);
    simulateSearch(searchTerm);
}

function simulateSearch(searchTerm) {
    showNotification(`Résultats pour "${searchTerm}" - Fonctionnalité à venir`);
}

// FONCTIONS NOTIFICATIONS
function getNotifications() {
    return JSON.parse(localStorage.getItem('handix_notifications') || '[]');
}

function saveNotifications(notifications) {
    localStorage.setItem('handix_notifications', JSON.stringify(notifications));
}

function addNotification(title, content, type = 'info') {
    const notifications = getNotifications();
    notifications.unshift({
        id: Date.now(),
        title,
        content,
        type,
        read: false,
        timestamp: new Date().toISOString()
    });
    
    if (notifications.length > 50) {
        notifications.splice(50);
    }
    
    saveNotifications(notifications);
}

// Vérifier les nouveaux matchs pour les favoris
async function checkForNewMatches() {
    const favorites = getFavorites();
    const teamFavorites = favorites.filter(f => f.category === 'team');
    
    if (teamFavorites.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data: newMatches, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', today)
            .or(teamFavorites.map(f => `home_team.ilike.%${f.name}%`).join(','))
            .limit(10);

        if (error) throw error;

        const lastCheck = localStorage.getItem('handix_last_match_check') || today;
        const newMatchesForFavorites = newMatches.filter(match => 
            match.date > lastCheck &&
            teamFavorites.some(fav => 
                match.home_team.includes(fav.name) || 
                match.away_team.includes(fav.name)
            )
        );

        newMatchesForFavorites.forEach(match => {
            const favoriteTeam = teamFavorites.find(fav => 
                match.home_team.includes(fav.name) || 
                match.away_team.includes(fav.name)
            );
            
            if (favoriteTeam) {
                addNotification(
                    'Nouveau match!',
                    `${favoriteTeam.name} joue ${match.date} à ${match.time}`,
                    'match'
                );
            }
        });

        localStorage.setItem('handix_last_match_check', today);
    } catch (error) {
        console.error('Erreur vérification nouveaux matchs:', error);
    }
}

// UTILITAIRES
function showLoading(containerId, message = 'Chargement...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <div>${message}</div>
            </div>
        `;
    }
}

function showError(containerId, message) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                <i class="ri-error-warning-line"></i>
                <div>${message}</div>
            </div>
        `;
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--gradient-primary);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        font-weight: 600;
        animation: slideDown 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Fonction pour rechercher dans les résultats avec un terme
async function searchResultsWithTerm(searchTerm) {
    try {
        console.log('🔍 Recherche résultats avec terme:', searchTerm);
        showLoading('matches-results', `Recherche de résultats pour "${searchTerm}"...`);
        
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .gte('date', sevenDaysAgoStr)
            .lte('date', today.toISOString().split('T')[0])
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(100);

        if (error) throw error;

        console.log('✅ Résultats trouvés avec terme:', data?.length || 0);
        displayMatchResults(data, 'matches-results', `Résultats pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur recherche résultats avec terme:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

// Fonction pour rechercher dans les résultats par période avec terme
async function searchResultsByDateRangeAndTerm(startDate, endDate, searchTerm) {
    try {
        console.log('📅🔍 Recherche résultats du', startDate, 'au', endDate, 'avec terme:', searchTerm);
        showLoading('matches-results', `Recherche des résultats du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)} pour "${searchTerm}"...`);
        
        const { data, error } = await supabase
            .from('matches')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .not('score_home', 'is', null)
            .not('score_away', 'is', null)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(100);

        if (error) throw error;

        console.log('✅ Résultats trouvés pour cette période et terme:', data?.length || 0);
        const title = `Résultats du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)} pour "${searchTerm}"`;
        displayMatchResults(data, 'matches-results', title);
        
    } catch (error) {
        console.error('❌ Erreur recherche résultats par période et terme:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

// Variables pour le modal FDM
let currentPdfUrl = '';
let currentZoom = 100;

// Fonction pour ouvrir la feuille de match
function openFdmModal(pdfUrl) {
    const modal = document.getElementById('fdm-modal');
    const pdfViewer = document.getElementById('fdm-pdf-viewer');
    const loading = document.getElementById('fdm-loading');
    const error = document.getElementById('fdm-error');
    
    if (!modal || !pdfViewer) {
        console.error('Modal FDM non trouvé');
        return;
    }
    
    currentPdfUrl = pdfUrl;
    currentZoom = 100;
    
    // Afficher le modal
    modal.classList.add('active');
    
    // Masquer le contenu précédent
    pdfViewer.style.display = 'none';
    error.style.display = 'none';
    loading.style.display = 'block';
    
    // Mettre à jour le zoom
    updateZoomInfo();
    
    // Charger le PDF
    setTimeout(() => {
        if (pdfUrl) {
            pdfViewer.src = pdfUrl;
            pdfViewer.onload = () => {
                loading.style.display = 'none';
                pdfViewer.style.display = 'block';
            };
            pdfViewer.onerror = () => {
                loading.style.display = 'none';
                error.style.display = 'block';
            };
        } else {
            loading.style.display = 'none';
            error.style.display = 'block';
        }
    }, 500);
}

// Fonction pour fermer le modal
function closeFdmModal() {
    const modal = document.getElementById('fdm-modal');
    const pdfViewer = document.getElementById('fdm-pdf-viewer');
    
    if (modal) {
        modal.classList.remove('active');
    }
    
    if (pdfViewer) {
        pdfViewer.src = '';
    }
    
    currentPdfUrl = '';
    currentZoom = 100;
}

// Fonction pour zoomer
function zoomPdf(direction) {
    const pdfViewer = document.getElementById('fdm-pdf-viewer');
    
    if (direction === 'in') {
        currentZoom = Math.min(currentZoom + 25, 200);
    } else if (direction === 'out') {
        currentZoom = Math.max(currentZoom - 25, 50);
    }
    
    if (pdfViewer) {
        pdfViewer.style.transform = `scale(${currentZoom / 100})`;
        pdfViewer.style.transformOrigin = 'center center';
    }
    
    updateZoomInfo();
}

// Fonction pour mettre à jour l'affichage du zoom
function updateZoomInfo() {
    const zoomInfo = document.getElementById('fdm-zoom-info');
    if (zoomInfo) {
        zoomInfo.textContent = `${currentZoom}%`;
    }
}

// Fonction pour télécharger le PDF
function downloadPdf() {
    if (currentPdfUrl) {
        const link = document.createElement('a');
        link.href = currentPdfUrl;
        link.download = 'feuille-de-match.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Initialisation des événements FDM
function initFdmEvents() {
    // Bouton de fermeture
    const closeButton = document.getElementById('fdm-close-button');
    if (closeButton) {
        closeButton.addEventListener('click', closeFdmModal);
    }
    
    // Fermeture en cliquant en dehors du modal
    const modal = document.getElementById('fdm-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeFdmModal();
            }
        });
    }
    
    // Contrôles de zoom
    const zoomInButton = document.getElementById('fdm-zoom-in');
    const zoomOutButton = document.getElementById('fdm-zoom-out');
    const downloadButton = document.getElementById('fdm-download');
    
    if (zoomInButton) {
        zoomInButton.addEventListener('click', () => zoomPdf('in'));
    }
    
    if (zoomOutButton) {
        zoomOutButton.addEventListener('click', () => zoomPdf('out'));
    }
    
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadPdf);
    }
    
    // Fermeture avec la touche Échap
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeFdmModal();
        }
    });
}

// Vérifier les nouveaux matchs toutes les heures
setInterval(checkForNewMatches, 60 * 60 * 1000);