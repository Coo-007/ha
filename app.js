// Configuration
const COORDINATES = {
    lat: 6.1319,
    lon: 1.2228
};

const BACKEND_URL = 'http://192.168.1.117:5000';

// Variables globales
let chart = null;
let intervalCapteurs = null;

// Attendre que la page soit chargee
document.addEventListener('DOMContentLoaded', () => {
    chargerMeteo();
    demarrerSurveillanceCapteurs();
    enregistrerServiceWorker();
});

// ==================== METEOROLOGIE ====================

async function chargerMeteo() {
    const weatherDiv = document.getElementById('weather-content');
    weatherDiv.innerHTML = '<p class="loading">🌤️ Chargement...</p>';
    
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${COORDINATES.lat}&longitude=${COORDINATES.lon}&daily=precipitation_probability_max,temperature_2m_max&timezone=GMT&forecast_days=7`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.daily) {
            afficherMeteo(data);
        } else {
            weatherDiv.innerHTML = '<p>❌ Donnees meteo non disponibles</p>';
        }
    } catch (erreur) {
        console.error('Erreur:', erreur);
        weatherDiv.innerHTML = '<p>⚠️ Impossible de charger la meteo</p>';
    }
}

function afficherMeteo(data) {
    const precipitations = data.daily.precipitation_probability_max;
    const temperatures = data.daily.temperature_2m_max;
    
    const moyennePluie = precipitations.reduce((a, b) => a + b, 0) / 7;
    const temperatureMax = Math.max(...temperatures);
    
    let conseil = '';
    let conseilClass = '';
    
    if (moyennePluie > 65) {
        conseil = '💧 Pluies frequentes cette semaine. Profitez-en pour semer, mais surveillez l\'exces d\'eau.';
        conseilClass = 'pluvieux';
    } else if (moyennePluie > 35) {
        conseil = '🌦️ Pluies moderees. Bonne periode pour les cultures. Pensez a preparer votre irrigation.';
        conseilClass = 'modere';
    } else {
        conseil = '☀️ Temps sec cette semaine. Prevoyez un systeme d\'irrigation si necessaire.';
        conseilClass = 'sec';
    }
    
    const html = `
        <div class="weather-details">
            <div class="weather-temp">${Math.round(temperatureMax)}°C</div>
            <div class="weather-rain">💧 Risque pluie moyen : ${Math.round(moyennePluie)}%</div>
            <div class="weather-advice ${conseilClass}">
                <strong>Conseil agricole</strong><br>
                ${conseil}
            </div>
            <p style="font-size: 0.8rem; margin-top: 12px; color: #666;">
                Previsions pour les 7 prochains jours
            </p>
        </div>
    `;
    
    document.getElementById('weather-content').innerHTML = html;
}

// ==================== CAPTEURS ====================

function demarrerSurveillanceCapteurs() {
    chargerDonneesCapteurs();
    
    if (intervalCapteurs) clearInterval(intervalCapteurs);
    intervalCapteurs = setInterval(chargerDonneesCapteurs, 5000);
}

async function chargerDonneesCapteurs() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/capteurs`);
        const data = await response.json();
        
        if (data.actuel && data.actuel.temperature !== undefined) {
            afficherCapteurs(data.actuel);
            mettreAJourGraphique(data.historique);
            mettreAJourQualiteAir(data.actuel.qualite_air);
            mettreAJourConseils(data.actuel);
        } else {
            afficherCapteursSimules();
        }
    } catch (erreur) {
        console.error('Erreur chargement capteurs:', erreur);
        afficherCapteursSimules();
    }
}

function afficherCapteurs(donnees) {
    const container = document.getElementById('sensors-content');
    
    let solStatus = 'good';
    let solMessage = 'Humidite correcte';
    
    if (donnees.humidite_sol < 30) {
        solStatus = 'warning';
        solMessage = 'Sol sec - Arrosez';
    } else if (donnees.humidite_sol > 80) {
        solStatus = 'warning';
        solMessage = 'Sol trop humide';
    }
    
    let airStatus = 'good';
    let airMessage = 'Air normal';
    
    if (donnees.qualite_air > 85) {
        airStatus = 'bad';
        airMessage = 'Air mauvais - Evacuation necessaire';
    } else if (donnees.qualite_air > 70) {
        airStatus = 'warning';
        airMessage = 'Air moyen - Aerez';
    }
    
    const html = `
        <div class="sensor-grid">
            <div class="sensor-item">
                <div class="sensor-label">Temperature</div>
                <div class="sensor-value">${donnees.temperature}°C</div>
            </div>
            <div class="sensor-item">
                <div class="sensor-label">Humidite air</div>
                <div class="sensor-value">${donnees.humidite_air}%</div>
            </div>
            <div class="sensor-item">
                <div class="sensor-label">Humidite sol</div>
                <div class="sensor-value">${donnees.humidite_sol}%</div>
                <div class="sensor-status status-${solStatus}">${solMessage}</div>
            </div>
            <div class="sensor-item">
                <div class="sensor-label">Qualite air</div>
                <div class="sensor-value">${donnees.qualite_air}%</div>
                <div class="sensor-status status-${airStatus}">${airMessage}</div>
            </div>
        </div>
        <p style="font-size: 0.7rem; text-align: center; color: #999; margin-top: 8px;">
            Derniere mise a jour : ${donnees.timestamp || 'en cours...'}
        </p>
    `;
    
    container.innerHTML = html;
}

function afficherCapteursSimules() {
    const donneesSimulees = {
        temperature: Math.floor(Math.random() * 20) + 25,
        humidite_air: Math.floor(Math.random() * 40) + 50,
        humidite_sol: Math.floor(Math.random() * 50) + 30,
        qualite_air: Math.floor(Math.random() * 40) + 50,
        timestamp: new Date().toLocaleTimeString()
    };
    afficherCapteurs(donneesSimulees);
}

// ==================== GRAPHIQUE ====================

function mettreAJourGraphique(historique) {
    const ctx = document.getElementById('humidityChart').getContext('2d');
    
    if (!historique || historique.length === 0) {
        historique = genererHistoriqueSimule();
    }
    
    const labels = historique.map(h => h.timestamp || '');
    const solData = historique.map(h => h.humidite_sol || 0);
    const tempData = historique.map(h => h.temperature || 0);
    
    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = solData;
        chart.data.datasets[1].data = tempData;
        chart.update();
    } else {
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Humidite sol (%)',
                        data: solData,
                        borderColor: '#2e7d32',
                        backgroundColor: 'rgba(46,125,50,0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Temperature (°C)',
                        data: tempData,
                        borderColor: '#ff9800',
                        backgroundColor: 'rgba(255,152,0,0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Valeur (%)'
                        }
                    }
                }
            }
        });
    }
}

function genererHistoriqueSimule() {
    const historique = [];
    for (let i = 20; i >= 0; i--) {
        historique.push({
            timestamp: `-${i*5}s`,
            humidite_sol: Math.floor(Math.random() * 50) + 30,
            temperature: Math.floor(Math.random() * 20) + 25
        });
    }
    return historique;
}

// ==================== QUALITE AIR ====================

function mettreAJourQualiteAir(qualite) {
    const airDiv = document.getElementById('air-content');
    let statusClass = 'normal';
    let message = '';
    
    if (qualite < 70) {
        statusClass = 'normal';
        message = 'Qualite de l\'air normale. Les conditions sont bonnes pour les cultures.';
    } else if (qualite < 85) {
        statusClass = 'warning';
        message = 'Qualite de l\'air moyenne. Aerez votre espace de culture. Evitez l\'utilisation excessive d\'engrais.';
    } else {
        statusClass = 'danger';
        message = 'Qualite de l\'air mauvaise! Ventilez immediatement. Les emissions d\'engrais sont trop elevees.';
    }
    
    const html = `
        <div class="air-status ${statusClass}">
            <span class="status-dot"></span>
            ${message}
        </div>
        <p style="font-size: 0.7rem; color: #666; margin-top: 8px;">
            Indice actuel : ${qualite}/100
        </p>
    `;
    
    airDiv.innerHTML = html;
}

// ==================== CONSEILS AGRICOLES ====================

function mettreAJourConseils(donnees) {
    const adviceDiv = document.getElementById('advice-content');
    
    let conseilHumidite = '';
    let conseilTemperature = '';
    
    if (donnees.humidite_sol < 30) {
        conseilHumidite = 'Le sol est sec. Arrosez vos cultures de preference le matin ou le soir.';
    } else if (donnees.humidite_sol > 80) {
        conseilHumidite = 'Attention sol trop humide. Creez des canaux de drainage si necessaire.';
    } else {
        conseilHumidite = 'L\'humidite du sol est bonne. Continuez l\'entretien normal.';
    }
    
    if (donnees.temperature > 35) {
        conseilTemperature = 'Temperature elevee. Protegez les jeunes plants du soleil direct.';
    } else if (donnees.temperature < 20) {
        conseilTemperature = 'Temperature fraiche. Les cultures comme le maïs et le niebe resistent bien.';
    } else {
        conseilTemperature = 'Temperature ideale pour la croissance des cultures.';
    }
    
    const html = `
        <div class="advice-item">
            <strong>Pour le maïs :</strong> Periode favorable. Espacement recommande 80x40cm.
        </div>
        <div class="advice-item">
            <strong>Pour l\'igname :</strong> Utilisez des buttes. Rotation sur 3 ans conseillee.
        </div>
        <div class="advice-item">
            <strong>Pour la tomate :</strong> Arrosage regulier. Paillage recommande.
        </div>
        <div class="advice-item">
            <strong>${conseilHumidite}</strong>
        </div>
        <div class="advice-item">
            <strong>${conseilTemperature}</strong>
        </div>
    `;
    
    adviceDiv.innerHTML = html;
}

// ==================== SERVICE WORKER ====================

function enregistrerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker enregistre'))
            .catch(err => console.log('Erreur SW:', err));
    }
}