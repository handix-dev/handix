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
    } else if (page.includes('favoris.html')) {
        currentPage = 'favoris';
    } else if (page.includes('clubs.html')) {
        currentPage = 'clubs';
    } else {
        currentPage = 'home';
    }
    
    console.log('Page détectée:', currentPage);
}

async function initApp() {
    console.log('🚀 Initialisation de la page:', currentPage);
    
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
            await loadUpcomingMatches();
            setTimeout(initMatchesEventListeners, 100);
            break;
    }
    
    requestLocationPermission();
    checkForNewMatches();
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

    // Filtres rapides
    document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
        chip.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            handleMatchFilter(filter, this);
        });
    });

    // Recherche par date
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

    // Actualiser les matchs
    const refreshMatches = document.getElementById('refresh-matches');
    if (refreshMatches) {
        refreshMatches.onclick = () => {
            console.log('🔄 Actualisation matchs');
            loadUpcomingMatches();
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

        if (error) {
            console.error('❌ Erreur Supabase:', error);
            throw error;
        }

        console.log('✅ Résultats matchs trouvés:', data?.length || 0);
        displayMatches(data, 'matches-results', `Résultats pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur recherche matchs:', error);
        showError('matches-results', 'Erreur lors de la recherche de matchs: ' + error.message);
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

function handleMatchFilter(filter, element) {
    console.log('🎯 Filtre matchs:', filter);
    
    // Récupérer le terme de recherche actuel
    const searchTerm = document.getElementById('match-search').value.trim();
    
    // Gérer l'affichage du sélecteur de date
    const datePicker = document.getElementById('date-picker-container');
    if (filter === 'calendar') {
        datePicker.style.display = 'block';
        // Ne pas changer la classe active pour le calendrier
        return;
    } else {
        datePicker.style.display = 'none';
    }
    
    // Mettre à jour les filtres actifs
    document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
        chip.classList.remove('active');
    });
    element.classList.add('active');

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
                searchMatches(searchTerm); // Utilise la recherche normale qui filtre par date
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

// Nouvelle fonction pour rechercher par date ET terme
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

// Nouvelle fonction pour rechercher par période ET terme
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
        displayMatches(data, 'matches-results', `Matchs du ${formatDateForDisplay(startDate)} au ${formatDateForDisplay(endDate)} pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur recherche par période et terme:', error);
        showError('matches-results', 'Erreur lors de la recherche');
    }
}

// Nouvelle fonction pour rechercher les matchs près de chez moi AVEC terme
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
            .gte('date', today)
            .or(`home_team.ilike.%${searchTerm}%,away_team.ilike.%${searchTerm}%,venue_name.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(100);

        if (matchesError) throw matchesError;

        console.log(`🎯 ${matchesData?.length || 0} matchs trouvés près de vous pour "${searchTerm}"`);
        displayMatches(matchesData || [], 'matches-results', `Matchs près de vous (10km) pour "${searchTerm}"`);
        
    } catch (error) {
        console.error('❌ Erreur searchMatchesNearbyWithTerm:', error);
        showError('matches-results', 'Erreur lors de la recherche des matchs près de vous');
    }
}

// Mettre à jour aussi la fonction searchMatchesByDate pour le calendrier
async function searchMatchesByDate(date) {
    try {
        const searchTerm = document.getElementById('match-search').value.trim();
        
        if (searchTerm) {
            // Si un terme de recherche est présent, utiliser la fonction combinée
            return searchMatchesByDateAndTerm(date, searchTerm);
        }

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

function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

function showMatchesList() {
    const matchesResults = document.getElementById('matches-results');
    const matchDetailView = document.getElementById('match-detail-view');
    
    if (matchesResults) matchesResults.style.display = 'block';
    if (matchDetailView) matchDetailView.style.display = 'none';
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
                    <div><strong>Adresse:</strong> ${venue.venue_address || 'Non disponible'}</div>
                    <div><strong>Ville:</strong> ${venue.city || 'Non disponible'}</div>
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

async function loadVenueDetails(venueName, venueAddress = null) {
    try {
        showLoading('venue-detail-container', `Chargement des détails pour ${venueName}...`);
        
        const venuesResults = document.getElementById('venues-results');
        const venueDetailView = document.getElementById('venue-detail-view');
        
        if (venuesResults) venuesResults.style.display = 'none';
        if (venueDetailView) venueDetailView.style.display = 'block';

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

        const today = new Date().toISOString().split('T')[0];
        
        let matchesQuery = supabase
            .from('matches')
            .select('*')
            .gte('date', today)
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(10);

        if (venueAddress && venueAddress !== 'null' && venueAddress !== '') {
            matchesQuery = matchesQuery.eq('venue_address', venueAddress);
        } else {
            matchesQuery = matchesQuery.eq('venue_name', venueName);
        }

        const { data: matchesData, error: matchesError } = await matchesQuery;

        if (matchesError) throw matchesError;

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
        const matches = matchesData || [];
        
        const teams = analyzeMainClubsSimple(teamsData || []);
        
        displayVenueDetails(venue, matches, teams, venueName, venueAddress);
        
    } catch (error) {
        console.error('❌ Erreur loadVenueDetails:', error);
        showError('venue-detail-container', 'Erreur lors du chargement des détails de la salle');
    }
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

function displayVenueDetails(venue, matches, teams, venueName, venueAddress = null) {
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
        html += `
                <div><strong>Adresse:</strong> ${venue.venue_address || 'Non disponible'}</div>
                <div><strong>Ville:</strong> ${venue.city || 'Non disponible'}</div>
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
                <div><strong>Coordonnées:</strong> ${parseFloat(venue.latitude).toFixed(6)}, ${parseFloat(venue.longitude).toFixed(6)}</div>
                ${distanceHtml}
            `;
            
            if (map) {
                map.setView([parseFloat(venue.latitude), parseFloat(venue.longitude)], 15);
                
                L.marker([parseFloat(venue.latitude), parseFloat(venue.longitude)])
                    .addTo(map)
                    .bindPopup(`<strong>${venueName}</strong><br>${venue.venue_address || ''}`)
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

    if (matches.length > 0) {
        html += `
            <div class="section-header" style="margin-top: 32px;">
                <div class="section-title">Matchs à venir</div>
                <div class="section-link">${matches.length} matchs</div>
            </div>
        `;
        
        html += matches.map(match => {
            const matchDate = new Date(match.date);
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            
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
                    </div>
                </div>
                <div class="match-footer">
                    <div class="match-venue">${match.time || 'Heure non précisée'}</div>
                </div>
            </div>
            `;
        }).join('');
    } else {
        html += `
            <div class="no-results" style="margin-top: 32px;">
                <div class="no-results-icon">📅</div>
                <div>Aucun match à venir dans cette salle</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function showVenuesList() {
    const venuesResults = document.getElementById('venues-results');
    const venueDetailView = document.getElementById('venue-detail-view');
    
    if (venuesResults) venuesResults.style.display = 'block';
    if (venueDetailView) venueDetailView.style.display = 'none';
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
                        .bindPopup('<div style="font-weight: 600; color: #ef4444;">Votre position</div>')
                        .openPopup();
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
        <div style="margin-bottom: 16px; color: var(--text-primary); font-size: 16px; font-weight: 600;">
            ${title} (${matches.length})
        </div>
        ${matches.map(match => {
            const matchDate = new Date(match.date);
            const formattedDate = matchDate.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const isFavorite = isItemFavorite('team', match.home_team) || isItemFavorite('team', match.away_team);
            
            return `
            <div class="match-card" data-match-id="${match.id}">
                <div class="match-header">
                    <div class="match-date">${formattedDate}</div>
                    <div class="match-level">${match.level || 'Niveau inconnu'}</div>
                </div>
                <div class="teams-container">
                    <div class="team">
                        <div class="team-logo">
                            ${match.home_logo ? `<img src="${match.home_logo}" alt="${match.home_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
                            <div class="logo-fallback" style="${match.home_logo ? 'display: none;' : 'display: flex;'}">🏠</div>
                        </div>
                        <div class="team-name">${match.home_team}</div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team">
                        <div class="team-logo">
                            ${match.away_logo ? `<img src="${match.away_logo}" alt="${match.away_team}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
                            <div class="logo-fallback" style="${match.away_logo ? 'display: none;' : 'display: flex;'}">✈️</div>
                        </div>
                        <div class="team-name">${match.away_team}</div>
                    </div>
                </div>
                <div class="match-footer">
                    <div class="match-venue">${match.venue_name || 'Lieu à confirmer'}</div>
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                            onclick="toggleFavorite('team', '${match.home_team}', '${match.home_team}', 'team')">
                        <i class="ri-star-${isFavorite ? 'fill' : 'line'}"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('')}
    `;
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

// Ajouter l'animation CSS pour les notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { 
            opacity: 0; 
            transform: translateX(-50%) translateY(-20px); 
        }
        to { 
            opacity: 1; 
            transform: translateX(-50%) translateY(0); 
        }
    }
`;
document.head.appendChild(style);

// Vérifier les nouveaux matchs toutes les heures
setInterval(checkForNewMatches, 60 * 60 * 1000);