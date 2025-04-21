#!/usr/bin/env python3
from flask import Flask, request, jsonify, render_template, send_from_directory
import db_funcs
import uuid
from functools import wraps
import os
from threading import Lock
import random

app = Flask(__name__)

# In-memory game state (replace with db_funcs for persistence)
games = {}
games_lock = Lock()

ENGLISH_WORDS = [
    "honey", "apple", "river", "cloud", "star", "mouse", "car", "tree", "book", "light"
]

# Helper: generate a unique game code
def generate_game_code():
    return str(uuid.uuid4())[:6]

# Lobby: create or join a game
@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/create", methods=["POST"])
def create_game():
    with games_lock:
        code = generate_game_code()
        games[code] = {
            "players": {},  # player_id: {name, score, ready, answer}
            "round": 0,
            "current_word": None,
            "state": "lobby",  # lobby, playing, scoring, finished
        }
    return jsonify({"game_code": code})

@app.route("/join", methods=["POST"])
def join_game():
    data = request.json
    code = data.get("game_code")
    name = data.get("name")
    if not code or not name:
        return jsonify({"error": "Missing game code or name"}), 400
    with games_lock:
        game = games.get(code)
        if not game:
            return jsonify({"error": "Game not found"}), 404
        player_id = str(uuid.uuid4())
        game["players"][player_id] = {"name": name, "score": 0, "ready": False, "answer": None}
    return jsonify({"player_id": player_id})

@app.route("/ready", methods=["POST"])
def player_ready():
    data = request.json
    code = data.get("game_code")
    player_id = data.get("player_id")
    with games_lock:
        game = games.get(code)
        if not game or player_id not in game["players"]:
            return jsonify({"error": "Invalid game or player"}), 400
        game["players"][player_id]["ready"] = True
        # Start game if all ready and >=3 players
        if game["state"] == "lobby":
            if len(game["players"]) >= 3 and all(p["ready"] for p in game["players"].values()):
                game["state"] = "playing"
                game["round"] += 1
                game["current_word"] = random.choice(ENGLISH_WORDS)
                for p in game["players"].values():
                    p["answer"] = None
    return jsonify({"state": game["state"], "current_word": game["current_word"]})

@app.route("/submit", methods=["POST"])
def submit_answer():
    data = request.json
    code = data.get("game_code")
    player_id = data.get("player_id")
    answer = data.get("answer")
    with games_lock:
        game = games.get(code)
        if not game or player_id not in game["players"] or game["state"] != "playing":
            return jsonify({"error": "Invalid game or player or state"}), 400
        game["players"][player_id]["answer"] = answer.strip().lower()
        # Check if all answered
        if all(p["answer"] for p in game["players"].values()):
            # Scoring
            answers = [p["answer"] for p in game["players"].values()]
            score_map = {}
            for ans in set(answers):
                count = answers.count(ans)
                if count == 2:
                    pts = 3
                elif count > 2:
                    pts = 1
                else:
                    pts = 0
                score_map[ans] = pts
            for p in game["players"].values():
                p["score"] += score_map[p["answer"]]
            # Check for winner
            winner = None
            for pid, p in game["players"].items():
                if p["score"] >= 20:
                    winner = pid
            if winner:
                game["state"] = "finished"
                game["winner"] = game["players"][winner]["name"]
            else:
                # Next round
                game["state"] = "playing"
                game["round"] += 1
                game["current_word"] = random.choice(ENGLISH_WORDS)
                for p in game["players"].values():
                    p["answer"] = None
    return jsonify({"state": game["state"], "scores": {pid: p["score"] for pid, p in game["players"].items()}, "winner": game.get("winner")})

@app.route("/state", methods=["GET"])
def get_state():
    code = request.args.get("game_code")
    with games_lock:
        game = games.get(code)
        if not game:
            return jsonify({"error": "Game not found"}), 404
        return jsonify({
            "state": game["state"],
            "round": game["round"],
            "current_word": game["current_word"],
            "players": {pid: {"name": p["name"], "score": p["score"]} for pid, p in game["players"].items()},
            "winner": game.get("winner")
        })

# Static and template serving
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

# Run it!
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)