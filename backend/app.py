from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import random
import math

app = Flask(__name__)
CORS(app)

# Compteur pour les variations
simulation_counter = 0

# Stockage des donnees
dernieres_donnees = {
    "temperature": 0,
    "humidite_air": 0,
    "humidite_sol": 0,
    "qualite_air": 0,
    "timestamp": None
}

historique = []

@app.route('/api/capteurs', methods=['POST'])
def recevoir_capteurs():
    global dernieres_donnees, historique
    
    data = request.get_json()
    
    dernieres_donnees = {
        "temperature": data.get('temperature', 0),
        "humidite_air": data.get('humidite_air', 0),
        "humidite_sol": data.get('humidite_sol', 0),
        "qualite_air": data.get('qualite_air', 0),
        "timestamp": datetime.now().strftime("%H:%M:%S")
    }
    
    historique.append(dernieres_donnees.copy())
    if len(historique) > 20:
        historique.pop(0)
    
    return jsonify({"status": "ok"}), 200

@app.route('/api/capteurs', methods=['GET'])
def obtenir_capteurs():
    global simulation_counter
    simulation_counter += 1
    
    # Si pas de donnees reelles, envoyer des donnees simulees qui varient
    if dernieres_donnees["temperature"] == 0:
        # Variations sinusoidales pour simuler du temps reel
        variation_temp = math.sin(simulation_counter * 0.1) * 5
        variation_sol = math.sin(simulation_counter * 0.15) * 15
        variation_air = math.cos(simulation_counter * 0.12) * 15
        variation_qualite = math.sin(simulation_counter * 0.08) * 10
        
        donnees_simulees = {
            "temperature": round(28 + variation_temp, 1),
            "humidite_air": round(65 + variation_air, 1),
            "humidite_sol": round(50 + variation_sol, 1),
            "qualite_air": round(70 + variation_qualite, 1),
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }
        
        # Stocker dans l'historique pour le graphique
        historique.append(donnees_simulees.copy())
        if len(historique) > 20:
            historique.pop(0)
        
        return jsonify({
            "actuel": donnees_simulees,
            "historique": historique
        })
    
    return jsonify({
        "actuel": dernieres_donnees,
        "historique": historique
    })

@app.route('/api/sante', methods=['GET'])
def sante():
    return jsonify({"status": "ok", "message": "API AgriPrevi Togo"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)