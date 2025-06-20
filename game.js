const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const playerImage = new Image();
playerImage.src = 'character_base_16x16.png';

const chickenWalkImage = new Image();
chickenWalkImage.src = 'chicken_walk.png';

const chickenEatImage = new Image();
chickenEatImage.src = 'chicken_eat.png';

let dialogueData = {};

const dialogue = {
    active: false,
    currentNodeKey: 'start',
    playerInRange: false,
    streamingText: '',
    streamIndex: 0,
    streamSpeed: 50,
    streamTimer: 0,
    hoveredChoice: -1,
    boxHeight: 0,
    targetBoxHeight: 0,
    conversationEnded: false,
    seenNodes: new Set(),
    bawkMessage: '',
    bawkTimer: 0,
    deadLinkChoice: -1
};

const chicken = {
    x: 100,
    y: 100,
    width: 32,
    height: 32,
    speed: 0.2,
    dx: 0,
    dy: 0,
    frameX: 0,
    frameY: 0,
    moving: false,
    eating: false,
    frameCount: 0,
    animationSpeed: 32,
    actionTimer: 0,
    actionInterval: Math.random() * 200 + 100 // 1.6 to 5 seconds
};

const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 16,
    height: 16,
    speed: 1,
    dx: 0,
    dy: 0,
    frameX: 0,
    frameY: 0,
    moving: false,
    frameCount: 0,
    animationSpeed: 32
};

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false
};

function wrapText(text, maxWidth) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function drawDialogue() {
    if (dialogue.playerInRange && !dialogue.active && !dialogue.conversationEnded) {
        ctx.font = '24px sans-serif';
        ctx.fillText('💬', chicken.x + 10, chicken.y - 10);
    }

    if (dialogue.bawkMessage) {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(dialogue.bawkMessage, chicken.x, chicken.y - 10);
    }

    if (dialogue.active && dialogue.playerInRange) {
        const node = dialogueData[dialogue.currentNodeKey];
        if (!node) return;

        const lines = wrapText(node.npc_text, canvas.width - 60);
        const choicesHeight = (node.choices ? node.choices.length * 20 : 0);
        dialogue.targetBoxHeight = 40 + lines.length * 20 + choicesHeight;

        if (dialogue.boxHeight < dialogue.targetBoxHeight) {
            dialogue.boxHeight += 10;
            if (dialogue.boxHeight > dialogue.targetBoxHeight) dialogue.boxHeight = dialogue.targetBoxHeight;
        }

        // Draw dialogue box
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(20, canvas.height - dialogue.boxHeight - 20, canvas.width - 40, dialogue.boxHeight);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(20, canvas.height - dialogue.boxHeight - 20, canvas.width - 40, dialogue.boxHeight);

        // Draw NPC text
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        const streamingLines = wrapText(dialogue.streamingText, canvas.width - 60);
        streamingLines.forEach((line, i) => {
            ctx.fillText(line, 30, canvas.height - dialogue.boxHeight + (i * 20));
        });

        // Draw choices
        if (node.choices && dialogue.streamIndex >= node.npc_text.length) {
            node.choices.forEach((choice, index) => {
                if (index === dialogue.deadLinkChoice) {
                    ctx.fillStyle = 'red';
                } else if (index === dialogue.hoveredChoice) {
                    ctx.fillStyle = 'yellow';
                } else {
                    ctx.fillStyle = '#fff';
                }
                ctx.fillText(`${index + 1}. ${choice.text}`, 40, canvas.height - 90 + (index * 20));
            });
        }
    }
}

function drawChicken() {
    const image = chicken.eating ? chickenEatImage : chickenWalkImage;
    ctx.drawImage(
        image,
        chicken.frameX * chicken.width,
        chicken.frameY * chicken.height,
        chicken.width,
        chicken.height,
        chicken.x,
        chicken.y,
        chicken.width * 2,
        chicken.height * 2
    );
}

function drawPlayer() {
    ctx.drawImage(
        playerImage,
        player.frameX * player.width,
        player.frameY * player.height,
        player.width,
        player.height,
        player.x,
        player.y,
        player.width * 3,
        player.height * 3
    );
}

function updatePlayer() {
    player.moving = false;
    player.dx = 0;
    player.dy = 0;

    if (keys.ArrowUp || keys.w) {
        player.dy = -player.speed;
        player.frameY = 1; // Row 1 for up
        player.moving = true;
    }
    if (keys.ArrowDown || keys.s) {
        player.dy = player.speed;
        player.frameY = 0; // Row 0 for down
        player.moving = true;
    }
    if (keys.ArrowLeft || keys.a) {
        player.dx = -player.speed;
        player.frameY = 3; // Row 3 for left
        player.moving = true;
    }
    if (keys.ArrowRight || keys.d) {
        player.dx = player.speed;
        player.frameY = 2; // Row 2 for right
        player.moving = true;
    }

    if (player.moving) {
        player.frameCount++;
        if (player.frameCount >= player.animationSpeed) {
            player.frameCount = 0;
            player.frameX = (player.frameX + 1) % 4;
        }
    } else {
        player.frameX = 0;
    }

    player.x += player.dx;
    player.y += player.dy;

    // Boundary detection
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
}

function updateChicken() {
    const dx = player.x - chicken.x;
    const dy = player.y - chicken.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const wasInRange = dialogue.playerInRange;
    dialogue.playerInRange = distance < 128;

    if (!wasInRange && dialogue.playerInRange) {
        dialogue.active = false;
    }

    if (dialogue.active && dialogue.playerInRange) {
        // Face the player
        if (Math.abs(dx) > Math.abs(dy)) {
            chicken.frameY = dx > 0 ? 3 : 1; // Right or Left
        } else {
            chicken.frameY = dy > 0 ? 0 : 2; // Down or Up
        }

        // Occasionally play eating animation
        if (Math.random() < 0.005) {
            chicken.eating = true;
            chicken.frameCount = 0;
        }

        if (chicken.eating) {
            chicken.frameCount++;
            if (chicken.frameCount >= chicken.animationSpeed) {
                chicken.frameCount = 0;
                chicken.frameX = (chicken.frameX + 1) % 4;
                if (chicken.frameX === 0) chicken.eating = false;
            }
        } else {
            chicken.frameX = 0;
        }
        return;
    }

    chicken.actionTimer++;

    if (chicken.actionTimer >= chicken.actionInterval) {
        chicken.actionTimer = 0;
        chicken.actionInterval = Math.random() * 200 + 100;
        const action = Math.random();

        if (action < 0.6) { // 60% chance to walk
            chicken.moving = true;
            chicken.eating = false;
            const direction = Math.floor(Math.random() * 4);
            // Chicken Sprite Direction Mapping: 0:Down, 1:Left, 2:Up, 3:Right
            if (direction === 0) { // Down
                chicken.dy = chicken.speed;
                chicken.dx = 0;
                chicken.frameY = 2; // Swapped
            } else if (direction === 1) { // Left
                chicken.dx = -chicken.speed;
                chicken.dy = 0;
                chicken.frameY = 1;
            } else if (direction === 2) { // Up
                chicken.dy = -chicken.speed;
                chicken.dx = 0;
                chicken.frameY = 0; // Swapped
            } else { // Right
                chicken.dx = chicken.speed;
                chicken.dy = 0;
                chicken.frameY = 3;
            }
        } else if (action < 0.9) { // 30% chance to eat
            chicken.moving = false;
            chicken.eating = true;
            chicken.dx = 0;
            chicken.dy = 0;
        } else { // 10% chance to stand still
            chicken.moving = false;
            chicken.eating = false;
            chicken.dx = 0;
            chicken.dy = 0;
        }
    }

    if (chicken.moving || chicken.eating) {
        chicken.frameCount++;
        if (chicken.frameCount >= chicken.animationSpeed) {
            chicken.frameCount = 0;
            chicken.frameX = (chicken.frameX + 1) % 4;
        }
    } else {
        chicken.frameX = 0;
    }

    if (chicken.moving) {
        chicken.x += chicken.dx;
        chicken.y += chicken.dy;
    }

    // Boundary detection for chicken
    if (chicken.x < 0) { chicken.x = 0; chicken.moving = false; }
    if (chicken.x + chicken.width > canvas.width) { chicken.x = canvas.width - chicken.width; chicken.moving = false; }
    if (chicken.y < 0) { chicken.y = 0; chicken.moving = false; }
    if (chicken.y + chicken.height > canvas.height) { chicken.y = canvas.height - chicken.height; chicken.moving = false; }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - (lastTime || timestamp);
    lastTime = timestamp;

    if (dialogue.bawkTimer > 0) {
        dialogue.bawkTimer -= deltaTime;
        if (dialogue.bawkTimer <= 0) {
            dialogue.bawkMessage = '';
        }
    }

    if (dialogue.active) {
        dialogue.streamTimer += deltaTime;
        const node = dialogueData[dialogue.currentNodeKey];
        if (node && dialogue.streamIndex < node.npc_text.length && dialogue.streamTimer > 1000 / dialogue.streamSpeed) {
            dialogue.streamIndex++;
            dialogue.streamingText = node.npc_text.substring(0, dialogue.streamIndex);
            dialogue.streamTimer = 0;
            if (dialogue.streamIndex >= node.npc_text.length) {
                dialogue.seenNodes.add(dialogue.currentNodeKey);
            }
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePlayer();
    updateChicken();
    drawPlayer();
    drawChicken();
    drawDialogue();
    requestAnimationFrame(gameLoop);
}
let lastTime;

function selectDialogueChoice(choiceIndex) {
    const node = dialogueData[dialogue.currentNodeKey];
    if (!node || !node.choices || !node.choices[choiceIndex] || dialogue.streamIndex < node.npc_text.length) {
        return;
    }

    if (dialogue.deadLinkChoice === choiceIndex) {
        dialogue.active = false;
        dialogue.conversationEnded = true;
        dialogue.deadLinkChoice = -1;
        return;
    }

    const nextNodeKey = node.choices[choiceIndex].next;
    if (dialogueData[nextNodeKey]) {
        dialogue.currentNodeKey = nextNodeKey;
        dialogue.streamIndex = 0;
        dialogue.streamingText = '';
        dialogue.boxHeight = 0;
        dialogue.deadLinkChoice = -1;

        if (dialogueData[nextNodeKey].end) {
            dialogue.active = false;
            dialogue.conversationEnded = true;
        }
    } else {
        // Dead link
        dialogue.deadLinkChoice = choiceIndex;
    }
}

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }

    if (e.code === 'Space' && dialogue.playerInRange && !dialogue.active) {
        if (dialogue.conversationEnded) {
            dialogue.bawkMessage = 'Bawk!';
            dialogue.bawkTimer = 2000; // 2 seconds
        } else {
            dialogue.active = true;
            if (dialogue.seenNodes.has(dialogue.currentNodeKey)) {
                const node = dialogueData[dialogue.currentNodeKey];
                dialogue.streamingText = node.npc_text;
                dialogue.streamIndex = node.npc_text.length;
            } else {
                dialogue.streamIndex = 0;
                dialogue.streamingText = '';
            }
            dialogue.boxHeight = 0;
        }
    } else if (e.code === 'Space' && dialogue.active) {
        const node = dialogueData[dialogue.currentNodeKey];
        if (node && dialogue.streamIndex < node.npc_text.length) {
            dialogue.streamIndex = node.npc_text.length;
            dialogue.streamingText = node.npc_text;
        }
    }

    const choiceIndex = parseInt(e.key) - 1;
    if (dialogue.active && dialogue.playerInRange && choiceIndex >= 0) {
        dialogue.hoveredChoice = choiceIndex;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }

    const choiceIndex = parseInt(e.key) - 1;
    const node = dialogueData[dialogue.currentNodeKey];
    if (dialogue.active && dialogue.playerInRange && node && node.choices && choiceIndex >= 0 && choiceIndex < node.choices.length && dialogue.streamIndex >= node.npc_text.length) {
        selectDialogueChoice(choiceIndex);
    }
    dialogue.hoveredChoice = -1;
});

canvas.addEventListener('mousemove', (e) => {
    if (!dialogue.active || !dialogue.playerInRange) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const node = dialogueData[dialogue.currentNodeKey];
    if (node && node.choices) {
        dialogue.hoveredChoice = -1;
        node.choices.forEach((choice, index) => {
            const choiceY = canvas.height - 90 + (index * 20);
            if (mouseY > choiceY - 15 && mouseY < choiceY + 5) {
                dialogue.hoveredChoice = index;
            }
        });
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (dialogue.hoveredChoice !== -1) {
        selectDialogueChoice(dialogue.hoveredChoice);
    }
});

let assetsLoaded = 0;
const totalAssets = 4; // 3 images + 1 json

function onAssetLoad() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        gameLoop();
    }
}

playerImage.onload = onAssetLoad;
chickenWalkImage.onload = onAssetLoad;
chickenEatImage.onload = onAssetLoad;

fetch('chicken-dialogue-json.json')
    .then(response => response.json())
    .then(data => {
        dialogueData = data.dialogues;
        onAssetLoad();
    });
