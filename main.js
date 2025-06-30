// Snake Game Main Logic
// Based on the provided technical spec

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const scoreDiv = document.getElementById('score');
const messageDiv = document.getElementById('message');
const minimap = document.getElementById('minimap-canvas');
const minimapCtx = minimap.getContext('2d');

// Grid and tile settings
let GRID_WIDTH = 60;
let GRID_HEIGHT = 60;
// TILE_SIZE will be calculated dynamically
let TILE_SIZE = 8;

// Game state
let gameState = 'start'; // start, survival, hunt, win, lose
let greenSnake, redSnake, fruits, score, intervalId, aiMoveToggle;
let powerUps = [];
let powerUpActive = false;
let powerUpTimer = null;
let powerUpType = null;
let powerUpInterval = null;
let lastPowerUpTime = Date.now();

// Difficulty selection
let difficulty = 'medium';

function resetGame() {
    greenSnake = {
        color: '#4caf50',
        body: [
            {x: Math.floor(GRID_WIDTH/2), y: Math.floor(GRID_HEIGHT/2)},
            {x: Math.floor(GRID_WIDTH/2)-1, y: Math.floor(GRID_HEIGHT/2)},
            {x: Math.floor(GRID_WIDTH/2)-2, y: Math.floor(GRID_HEIGHT/2)}
        ],
        dir: 'right',
        grow: 0
    };
    redSnake = {
        color: '#e53935',
        body: [
            {x: 5, y: 5},
            {x: 4, y: 5}
        ],
        dir: 'right',
        mode: 'chase' // chase or flee
    };
    score = 0;
    aiMoveToggle = false;
    spawnFruits(5);
    powerUps = [];
    powerUpActive = false;
    powerUpType = null;
    lastPowerUpTime = Date.now();
    gameState = 'survival';
    messageDiv.textContent = '';
    scoreDiv.textContent = 'Score: 0';
}

function spawnFruits(n) {
    fruits = [];
    let attempts = 0;
    while (fruits.length < n && attempts < 100) {
        let fx = greenSnake.body[0].x + Math.floor(Math.random() * 7) - 3;
        let fy = greenSnake.body[0].y + Math.floor(Math.random() * 7) - 3;
        fx = Math.max(0, Math.min(GRID_WIDTH - 1, fx));
        fy = Math.max(0, Math.min(GRID_HEIGHT - 1, fy));
        if (!isOccupied(fx, fy) && !fruits.some(f => f.x === fx && f.y === fy)) {
            fruits.push({x: fx, y: fy});
        }
        attempts++;
    }
    // If not enough near, fill random
    while (fruits.length < n) {
        let fx = Math.floor(Math.random() * GRID_WIDTH);
        let fy = Math.floor(Math.random() * GRID_HEIGHT);
        if (!isOccupied(fx, fy) && !fruits.some(f => f.x === fx && f.y === fy)) {
            fruits.push({x: fx, y: fy});
        }
    }
}

function spawnOneFruit() {
    let valid = false;
    let fx, fy;
    while (!valid) {
        fx = Math.floor(Math.random() * GRID_WIDTH);
        fy = Math.floor(Math.random() * GRID_HEIGHT);
        valid = !isOccupied(fx, fy) && !fruits.some(f => f.x === fx && f.y === fy);
    }
    fruits.push({x: fx, y: fy});
}

function isOccupied(x, y) {
    return greenSnake.body.some(seg => seg.x === x && seg.y === y) ||
           redSnake.body.some(seg => seg.x === x && seg.y === y);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    TILE_SIZE = Math.min(canvas.width / GRID_WIDTH, canvas.height / GRID_HEIGHT);

    // --- First Person View ---
    // The player sees from the head of the green snake, looking in the direction of movement
    // We'll render a simple 3D corridor effect based on the grid
    // (This is a basic simulation, not a true 3D engine)
    const head = greenSnake.body[0];
    const dir = greenSnake.dir;
    const viewDepth = 8; // How many tiles ahead to render
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    for (let d = viewDepth; d > 0; d--) {
        // Calculate the tile in front of the head
        let tx = head.x, ty = head.y;
        if (dir === 'up') ty -= d;
        if (dir === 'down') ty += d;
        if (dir === 'left') tx -= d;
        if (dir === 'right') tx += d;
        // Wall/floor/ceiling effect
        let scale = 1 - d/(viewDepth+1);
        let w = canvas.width * scale * 0.8;
        let h = canvas.height * scale * 0.8;
        let cx = 0, cy = 0;
        ctx.globalAlpha = 1 - d/(viewDepth+1) * 0.7;
        // Draw corridor walls
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 4;
        ctx.strokeRect(-w/2, -h/2, w, h);
        // Draw fruit if present
        if (fruits.some(f => f.x === tx && f.y === ty)) {
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.arc(0, 0, w/8, 0, 2*Math.PI);
            ctx.fill();
        }
        // Draw red snake if present
        if (redSnake.body.some(seg => seg.x === tx && seg.y === ty)) {
            ctx.fillStyle = '#e53935';
            ctx.beginPath();
            ctx.arc(0, 0, w/7, 0, 2*Math.PI);
            ctx.fill();
        }
        // Draw green snake body if present (not head)
        if (greenSnake.body.slice(1).some(seg => seg.x === tx && seg.y === ty)) {
            ctx.fillStyle = '#4caf50';
            ctx.beginPath();
            ctx.arc(0, 0, w/9, 0, 2*Math.PI);
            ctx.fill();
        }
        // Draw powerups in minimap and main view
        powerUps.forEach(pu => {
            // Main view: show as blue star in corridor if in view
            for (let d = 1; d <= 8; d++) {
                let tx = greenSnake.body[0].x, ty = greenSnake.body[0].y;
                if (greenSnake.dir === 'up') ty -= d;
                if (greenSnake.dir === 'down') ty += d;
                if (greenSnake.dir === 'left') tx -= d;
                if (greenSnake.dir === 'right') tx += d;
                if (pu.x === tx && pu.y === ty) {
                    ctx.save();
                    ctx.translate(canvas.width/2, canvas.height/2);
                    ctx.fillStyle = '#00bfff';
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        ctx.lineTo(Math.cos((18 + i * 72) / 180 * Math.PI) * 20, Math.sin((18 + i * 72) / 180 * Math.PI) * 20);
                        ctx.lineTo(Math.cos((54 + i * 72) / 180 * Math.PI) * 8, Math.sin((54 + i * 72) / 180 * Math.PI) * 8);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }
        });
        ctx.scale(0.8, 0.8);
    }
    ctx.restore();

    // --- Minimap ---
    drawMinimap();
}

function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
    const cellW = minimap.width / GRID_WIDTH;
    const cellH = minimap.height / GRID_HEIGHT;
    // Draw fruits
    minimapCtx.fillStyle = '#ffeb3b';
    fruits.forEach(fruit => {
        minimapCtx.fillRect(fruit.x * cellW, fruit.y * cellH, cellW, cellH);
    });
    // Draw red snake
    minimapCtx.fillStyle = '#e53935';
    redSnake.body.forEach(seg => {
        minimapCtx.fillRect(seg.x * cellW, seg.y * cellH, cellW, cellH);
    });
    // Draw green snake
    minimapCtx.fillStyle = '#4caf50';
    greenSnake.body.forEach((seg, i) => {
        minimapCtx.fillRect(seg.x * cellW, seg.y * cellH, cellW, cellH);
    });
    // Draw head direction
    const head = greenSnake.body[0];
    minimapCtx.strokeStyle = '#fff';
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    let hx = head.x * cellW + cellW/2;
    let hy = head.y * cellH + cellH/2;
    let dx = 0, dy = 0;
    if (greenSnake.dir === 'up') dy = -cellH*2;
    if (greenSnake.dir === 'down') dy = cellH*2;
    if (greenSnake.dir === 'left') dx = -cellW*2;
    if (greenSnake.dir === 'right') dx = cellW*2;
    minimapCtx.moveTo(hx, hy);
    minimapCtx.lineTo(hx+dx, hy+dy);
    minimapCtx.stroke();
    // Draw powerups
    minimapCtx.fillStyle = '#00bfff';
    powerUps.forEach(pu => {
        minimapCtx.beginPath();
        minimapCtx.arc(pu.x * cellW + cellW/2, pu.y * cellH + cellH/2, Math.min(cellW,cellH)/2, 0, 2*Math.PI);
        minimapCtx.fill();
    });
}

function moveSnake(snake) {
    let head = {...snake.body[0]};
    let nextHead = {...head};
    switch (snake.dir) {
        case 'up': nextHead.y -= 1; break;
        case 'down': nextHead.y += 1; break;
        case 'left': nextHead.x -= 1; break;
        case 'right': nextHead.x += 1; break;
    }
    // Wall bounce
    if (nextHead.x < 0) nextHead.x = 0;
    if (nextHead.x >= GRID_WIDTH) nextHead.x = GRID_WIDTH - 1;
    if (nextHead.y < 0) nextHead.y = 0;
    if (nextHead.y >= GRID_HEIGHT) nextHead.y = GRID_HEIGHT - 1;
    // Prevent self-collision: if next head is in body, do not move
    if (snake.body.some(seg => seg.x === nextHead.x && seg.y === nextHead.y)) {
        // Do nothing, snake stays in place
        return;
    }
    snake.body.unshift(nextHead);
    if (snake.grow > 0) {
        snake.grow--;
    } else {
        snake.body.pop();
    }
}

function update() {
    if (gameState === 'survival' || gameState === 'hunt') {
        // Move player
        moveSnake(greenSnake);
        // Check fruit collision
        let ate = false;
        for (let i = 0; i < fruits.length; i++) {
            if (greenSnake.body[0].x === fruits[i].x && greenSnake.body[0].y === fruits[i].y) {
                if (powerUpActive && powerUpType === 'x2') {
                    greenSnake.grow = (greenSnake.grow || 0) + 2;
                    score += 2;
                } else {
                    greenSnake.grow = (greenSnake.grow || 0) + 1;
                    score++;
                }
                scoreDiv.textContent = 'Score: ' + score;
                fruits.splice(i, 1);
                spawnOneFruit();
                ate = true;
                break;
            }
        }
        // Move AI based on difficulty
        aiMoveToggle = !aiMoveToggle;
        if (aiMoveToggle) {
            if (difficulty === 'easy') updateRedSnakeEasy();
            else if (difficulty === 'medium') updateRedSnakeMedium();
            else if (difficulty === 'hard') updateRedSnakeHard();
        }
        moveSnake(redSnake);
        // Red snake eats fruit
        for (let i = 0; i < fruits.length; i++) {
            if (redSnake.body[0].x === fruits[i].x && redSnake.body[0].y === fruits[i].y) {
                redSnake.grow = (redSnake.grow || 0) + 1;
                fruits.splice(i, 1);
                spawnOneFruit();
                break;
            }
        }
        // Check collisions
        if (greenSnake.body.slice(1).some(seg => seg.x === greenSnake.body[0].x && seg.y === greenSnake.body[0].y)) {
            endGame('lose', 'You ran into yourself!');
            return;
        }
        if (redSnake.body.slice(1).some(seg => seg.x === redSnake.body[0].x && seg.y === redSnake.body[0].y)) {
            endGame('win', 'Red snake ran into itself!');
            return;
        }
        // --- Enhanced Snake Collision Logic ---
        // If red snake's head touches green snake's head
        if (redSnake.body[0].x === greenSnake.body[0].x && redSnake.body[0].y === greenSnake.body[0].y) {
            if (gameState === 'hunt' && greenSnake.body.length >= 2 * redSnake.body.length) {
                endGame('win', 'You attacked and ate the red snake!');
            } else {
                endGame('lose', 'Red snake caught you!');
            }
            return;
        }
        // If green snake's head touches red snake's head (player attacks)
        if (greenSnake.body[0].x === redSnake.body[0].x && greenSnake.body[0].y === redSnake.body[0].y) {
            if (gameState === 'hunt' && greenSnake.body.length >= 2 * redSnake.body.length) {
                endGame('win', 'You attacked and ate the red snake!');
            } else {
                endGame('lose', 'Red snake caught you!');
            }
            return;
        }
        // Hunt phase trigger
        if (gameState === 'survival' && greenSnake.body.length >= 2 * redSnake.body.length) {
            gameState = 'hunt';
            redSnake.mode = 'flee';
            messageDiv.textContent = 'Hunt phase! Chase the red snake!';
        }
    }
    // Powerup spawn every minute
    if (Date.now() - lastPowerUpTime > 60000) {
        spawnPowerUp();
        lastPowerUpTime = Date.now();
    }
    // Check powerup collision
    for (let i = 0; i < powerUps.length; i++) {
        if (greenSnake.body[0].x === powerUps[i].x && greenSnake.body[0].y === powerUps[i].y) {
            activatePowerUp(powerUps[i].type);
            powerUps.splice(i, 1);
            break;
        }
    }
    draw();
}

window.onload = function() {
    const mainMenu = document.getElementById('main-menu');
    const mainStartBtn = document.getElementById('main-start-btn');
    const difficultySelect = document.getElementById('difficulty-select');
    const gameOverPopup = document.getElementById('game-over-popup');
    const retryBtn = document.getElementById('retry-btn');
    mainMenu.style.display = 'flex';
    mainStartBtn.onclick = function() {
        setDifficulty(difficultySelect.value);
        mainMenu.style.display = 'none';
        // Only start the game loop if not already running
        if (!intervalId) {
            resetGame();
            startBtn.textContent = 'Restart';
            intervalId = setInterval(update, 60);
        } else {
            resetGame();
            startBtn.textContent = 'Restart';
        }
    };
    retryBtn.onclick = function() {
        gameOverPopup.style.display = 'none';
        mainMenu.style.display = 'flex';
        clearInterval(intervalId);
        intervalId = null;
    };
    startBtn.onclick = function() {
        resetGame();
        startBtn.textContent = 'Restart';
        clearInterval(intervalId);
        intervalId = setInterval(update, 60);
    };
};

function endGame(state, msg) {
    gameState = state;
    messageDiv.textContent = msg;
    clearInterval(intervalId);
    startBtn.textContent = 'Restart';
    // Show game over popup
    const gameOverPopup = document.getElementById('game-over-popup');
    const gameOverMsg = document.getElementById('game-over-message');
    gameOverMsg.textContent = msg;
    gameOverPopup.style.display = 'flex';
}

function setDifficulty(level) {
    difficulty = level;
    // Adjust game settings based on difficulty
    if (difficulty === 'easy') {
        GRID_WIDTH = 40;
        GRID_HEIGHT = 40;
        spawnFruits(3);
    } else if (difficulty === 'medium') {
        GRID_WIDTH = 60;
        GRID_HEIGHT = 60;
        spawnFruits(5);
    } else if (difficulty === 'hard') {
        GRID_WIDTH = 80;
        GRID_HEIGHT = 80;
        spawnFruits(7);
    }
    // Reset and start the game with new difficulty settings
    resetGame();
    startBtn.textContent = 'Restart';
    clearInterval(intervalId);
    intervalId = setInterval(update, 60);
}

function updateRedSnakeEasy() {
    // Always target green snake head in chase mode, but never into itself
    let head = redSnake.body[0];
    let possibleDirs = ['up','down','left','right'];
    possibleDirs = possibleDirs.filter(dir => {
        let nx = head.x, ny = head.y;
        if (dir === 'up') ny--;
        if (dir === 'down') ny++;
        if (dir === 'left') nx--;
        if (dir === 'right') nx++;
        nx = Math.max(0, Math.min(GRID_WIDTH-1, nx));
        ny = Math.max(0, Math.min(GRID_HEIGHT-1, ny));
        return !redSnake.body.some(seg => seg.x === nx && seg.y === ny);
    });
    if (possibleDirs.length === 0) return;
    let target;
    if (redSnake.mode === 'chase') {
        target = greenSnake.body[0];
        // Always pick the best direction toward the green snake's head
        let dx = target.x - head.x;
        let dy = target.y - head.y;
        let bestDir;
        if (Math.abs(dx) > Math.abs(dy)) {
            bestDir = dx > 0 ? 'right' : 'left';
        } else if (dy !== 0) {
            bestDir = dy > 0 ? 'down' : 'up';
        }
        if (bestDir && possibleDirs.includes(bestDir)) {
            redSnake.dir = bestDir;
        } else {
            redSnake.dir = possibleDirs[Math.floor(Math.random()*possibleDirs.length)];
        }
        return;
    } else {
        // Flee: move away from green snake
        let dx = head.x - greenSnake.body[0].x;
        let dy = head.y - greenSnake.body[0].y;
        let bestDir;
        if (Math.abs(dx) > Math.abs(dy)) {
            bestDir = dx > 0 ? 'right' : 'left';
        } else {
            bestDir = dy > 0 ? 'down' : 'up';
        }
        if (possibleDirs.includes(bestDir)) {
            redSnake.dir = bestDir;
        } else {
            redSnake.dir = possibleDirs[Math.floor(Math.random()*possibleDirs.length)];
        }
        return;
    }
}

// --- Medium AI for Red Snake ---
function updateRedSnakeMedium() {
    // Medium: prefers shortest path, avoids green snake, but not perfect
    let head = redSnake.body[0];
    let dirs = ['up','down','left','right'];
    let bestDir = redSnake.dir;
    let minDist = Infinity;
    let target = greenSnake.body[0];
    dirs.forEach(dir => {
        let nx = head.x, ny = head.y;
        if (dir === 'up') ny--;
        if (dir === 'down') ny++;
        if (dir === 'left') nx--;
        if (dir === 'right') nx++;
        nx = Math.max(0, Math.min(GRID_WIDTH-1, nx));
        ny = Math.max(0, Math.min(GRID_HEIGHT-1, ny));
        // Avoid self
        if (redSnake.body.some(seg => seg.x === nx && seg.y === ny)) return;
        // Avoid green snake head if possible
        if (nx === greenSnake.body[0].x && ny === greenSnake.body[0].y) return;
        let dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
        if (dist < minDist) {
            minDist = dist;
            bestDir = dir;
        }
    });
    // 20% chance to make a random move
    if (Math.random() < 0.2) {
        let possible = dirs.filter(dir => {
            let nx = head.x, ny = head.y;
            if (dir === 'up') ny--;
            if (dir === 'down') ny++;
            if (dir === 'left') nx--;
            if (dir === 'right') nx++;
            nx = Math.max(0, Math.min(GRID_WIDTH-1, nx));
            ny = Math.max(0, Math.min(GRID_HEIGHT-1, ny));
            return !redSnake.body.some(seg => seg.x === nx && seg.y === ny);
        });
        if (possible.length > 0) bestDir = possible[Math.floor(Math.random()*possible.length)];
    }
    redSnake.dir = bestDir;
}

// --- Hard AI for Red Snake ---
function updateRedSnakeHard() {
    // Hard: always shortest path, avoids green snake, never random
    let head = redSnake.body[0];
    let dirs = ['up','down','left','right'];
    let bestDir = redSnake.dir;
    let minDist = Infinity;
    let target = greenSnake.body[0];
    dirs.forEach(dir => {
        let nx = head.x, ny = head.y;
        if (dir === 'up') ny--;
        if (dir === 'down') ny++;
        if (dir === 'left') nx--;
        if (dir === 'right') nx++;
        nx = Math.max(0, Math.min(GRID_WIDTH-1, nx));
        ny = Math.max(0, Math.min(GRID_HEIGHT-1, ny));
        // Avoid self
        if (redSnake.body.some(seg => seg.x === nx && seg.y === ny)) return;
        // Avoid green snake head if possible
        if (nx === greenSnake.body[0].x && ny === greenSnake.body[0].y) return;
        let dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
        if (dist < minDist) {
            minDist = dist;
            bestDir = dir;
        }
    });
    redSnake.dir = bestDir;
}

// Power-ups (x2) every minute
function spawnPowerUp() {
    // Only one powerup at a time
    if (powerUps.length > 0) return;
    let valid = false, px, py;
    while (!valid) {
        px = Math.floor(Math.random() * GRID_WIDTH);
        py = Math.floor(Math.random() * GRID_HEIGHT);
        valid = !isOccupied(px, py) && !fruits.some(f => f.x === px && f.y === py);
    }
    powerUps.push({x: px, y: py, type: 'x2'});
}

function activatePowerUp(type) {
    powerUpActive = true;
    powerUpType = type;
    setTimeout(() => {
        powerUpActive = false;
        powerUpType = null;
    }, 15000); // Powerup lasts 15 seconds
}

// Controls
window.addEventListener('keydown', e => {
    if (gameState !== 'survival' && gameState !== 'hunt') return;
    switch (e.key) {
        case 'ArrowUp': if (greenSnake.dir !== 'down') greenSnake.dir = 'up'; break;
        case 'ArrowDown': if (greenSnake.dir !== 'up') greenSnake.dir = 'down'; break;
        case 'ArrowLeft': if (greenSnake.dir !== 'right') greenSnake.dir = 'left'; break;
        case 'ArrowRight': if (greenSnake.dir !== 'left') greenSnake.dir = 'right'; break;
    }
});

draw();
messageDiv.textContent = 'Press Start to play!';
