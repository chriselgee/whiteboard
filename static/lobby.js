// Handles lobby creation/joining and game state transitions
let playerId = null;
let gameCode = null;

function createGame() {
    const name = document.getElementById('name').value;
    if (!name) return alert('Enter your name');
    fetch('/create', {method: 'POST'}).then(r => r.json()).then(data => {
        gameCode = data.game_code;
        joinGameWithCode(name, gameCode);
    });
}

function joinGame() {
    const name = document.getElementById('name').value;
    const code = document.getElementById('game_code').value;
    if (!name || !code) return alert('Enter name and game code');
    joinGameWithCode(name, code);
}

function joinGameWithCode(name, code) {
    fetch('/join', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: name, game_code: code})
    }).then(r => r.json()).then(data => {
        if (data.error) return alert(data.error);
        playerId = data.player_id;
        gameCode = code;
        document.getElementById('lobby').style.display = 'none';
        showReadyScreen();
    });
}

function showReadyScreen() {
    const gameDiv = document.getElementById('game');
    gameDiv.style.display = '';
    gameDiv.innerHTML = `<h2>Game Code: ${gameCode}</h2>
        <button onclick="readyUp()">I'm Ready</button>
        <div id="players"></div>
        <div id="game_status"></div>`;
    pollState();
}

function readyUp() {
    fetch('/ready', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({game_code: gameCode, player_id: playerId})
    }).then(r => r.json()).then(data => {
        // Always rely on pollState to update UI
        document.getElementById('game_status').innerText = 'Waiting for others...';
        pollState();
    });
}

function showGameScreen(word) {
    const gameDiv = document.getElementById('game');
    gameDiv.innerHTML = `<h2>Prompt: ${word}</h2>
        <input type="text" id="answer" placeholder="Your word">
        <button onclick="submitAnswer()">Submit</button>
        <div id="game_status"></div>`;
}

function submitAnswer() {
    const answer = document.getElementById('answer').value;
    if (!answer) return alert('Enter a word');
    fetch('/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({game_code: gameCode, player_id: playerId, answer: answer})
    }).then(r => r.json()).then(data => {
        // Always rely on pollState to update UI
        document.getElementById('game_status').innerText = 'Waiting for others...';
        pollState();
    });
}

function showScoreboard(scores, answers, names) {
    const gameDiv = document.getElementById('game');
    let scoreList = '';
    for (const pid in scores) {
        scoreList += `<li>${names[pid]}: ${scores[pid]} pts (${answers[pid]})</li>`;
    }
    gameDiv.innerHTML = `<h2>Scoreboard</h2>
        <ul>${scoreList}</ul>
        <button onclick="readyForNextRound()">Ready for Next Round</button>
        <div id="game_status"></div>`;
    // Keep polling in scoring state so all players see the scoreboard
    setTimeout(pollState, 2000);
}

function readyForNextRound() {
    fetch('/next', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({game_code: gameCode, player_id: playerId})
    }).then(r => r.json()).then(data => {
        // Always rely on pollState to update UI
        document.getElementById('game_status').innerText = 'Waiting for others...';
        pollState();
    });
}

function showWinner(winner, scores) {
    const gameDiv = document.getElementById('game');
    let scoreList = '';
    for (const pid in scores) {
        scoreList += `<li>${scores[pid]} pts</li>`;
    }
    gameDiv.innerHTML = `<h2>Winner: ${winner}</h2><ul>${scoreList}</ul><button onclick="location.reload()">Play Again</button>`;
}

function pollState() {
    fetch(`/state?game_code=${gameCode}`).then(r => r.json()).then(data => {
        if (data.state === 'playing' && data.current_word) {
            showGameScreen(data.current_word);
        } else if (data.state === 'finished') {
            showWinner(data.winner, data.players);
        } else if (data.state === 'scoring') {
            // Show scoreboard for all players
            let scores = {};
            let answers = {};
            let names = {};
            for (const pid in data.players) {
                scores[pid] = data.players[pid].score;
                answers[pid] = data.players[pid].answer;
                names[pid] = data.players[pid].name;
            }
            showScoreboard(scores, answers, names);
        } else {
            // Update player list
            let players = '';
            for (const pid in data.players) {
                players += `<li>${data.players[pid].name}: ${data.players[pid].score} pts</li>`;
            }
            document.getElementById('players').innerHTML = `<ul>${players}</ul>`;
            setTimeout(pollState, 2000);
        }
    });
}
