// State
let eventName = '';
let players = [];
let teams = [];
let numTeams = 2;

// Elements
const inputSection = document.getElementById('inputSection');
const setupSection = document.getElementById('setupSection');
const draftSection = document.getElementById('draftSection');
const playerInput = document.getElementById('playerInput');
const teamCountInput = document.getElementById('teamCount');
const setupBtn = document.getElementById('setupBtn');
const startDraftBtn = document.getElementById('startDraftBtn');
const resetBtn = document.getElementById('resetBtn');
const teamsSetup = document.getElementById('teamsSetup');
const availablePlayers = document.getElementById('availablePlayers');
const draftTeams = document.getElementById('draftTeams');
const eventNameEl = document.getElementById('eventName');
const newPlayerInput = document.getElementById('newPlayerInput');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const redraftBtn = document.getElementById('redraftBtn');
const loadDraftBtn = document.getElementById('loadDraftBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const saveDraftResultBtn = document.getElementById('saveDraftResultBtn');
const copyTeamsBtn = document.getElementById('copyTeamsBtn');
const manualDraftBtn = document.getElementById('manualDraftBtn');
const manualDraftSection = document.getElementById('manualDraftSection');
const manualEventName = document.getElementById('manualEventName');
const currentPickTeam = document.getElementById('currentPickTeam');
const manualAvailablePlayers = document.getElementById('manualAvailablePlayers');
const manualDraftTeams = document.getElementById('manualDraftTeams');
const playerCountDisplay = document.getElementById('playerCountDisplay');

// Event Listeners
setupBtn.addEventListener('click', handleSetup);
startDraftBtn.addEventListener('click', startDraft);
resetBtn.addEventListener('click', reset);
addPlayerBtn.addEventListener('click', addNewPlayer);
redraftBtn.addEventListener('click', handleRedraft);
loadDraftBtn.addEventListener('click', loadSavedDraft);
saveDraftBtn.addEventListener('click', saveDraft);
saveDraftResultBtn.addEventListener('click', saveDraftResults);
copyTeamsBtn.addEventListener('click', copyTeamsToClipboard);
manualDraftBtn.addEventListener('click', startManualDraft);

// Allow Enter key to add player
newPlayerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addNewPlayer();
    }
});

// Update player count when inputs change
playerInput.addEventListener('input', updatePlayerCount);
teamCountInput.addEventListener('input', updatePlayerCount);

// Parse input and setup pre-draft
function handleSetup() {
    const input = playerInput.value.trim();
    if (!input) {
        alert('Please enter an event name and players');
        return;
    }

    const lines = input.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        alert('Please enter at least an event name and one player');
        return;
    }

    eventName = lines[0];
    players = lines.slice(1).map((name, index) => ({
        id: index,
        name: name.trim(),
        team: null
    }));

    numTeams = parseInt(teamCountInput.value);

    if (players.length < numTeams) {
        alert(`You need at least ${numTeams} players for ${numTeams} teams`);
        return;
    }

    initializeTeams();
    renderSetup();

    inputSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
}

// Initialize empty teams
function initializeTeams() {
    teams = [];
    for (let i = 0; i < numTeams; i++) {
        teams.push({
            id: i,
            name: `Team ${i + 1}`,
            players: []
        });
    }
}

// Render pre-draft setup
function renderSetup() {
    // Render team slots
    teamsSetup.innerHTML = teams.map(team => `
        <div class="border-2 border-dashed border-gray-600 rounded-lg p-4 bg-gray-700/30" data-team="${team.id}">
            <h3 class="font-semibold text-gray-300 mb-2 cursor-pointer hover:text-purple-400 transition" onclick="editTeamName(${team.id})">
                ${team.name}
            </h3>
            <div class="team-drop-zone min-h-[50px] flex flex-wrap gap-2" data-team="${team.id}">
                ${team.players.map(p => createPlayerChip(p, true)).join('')}
            </div>
        </div>
    `).join('');

    // Render available players
    const unassignedPlayers = players.filter(p => p.team === null);
    availablePlayers.innerHTML = unassignedPlayers.map(p => createPlayerChip(p, false)).join('');

    // Add drag and drop handlers
    initializeDragAndDrop();
}

// Create player chip HTML
function createPlayerChip(player, inTeam) {
    return `
        <div
            class="player-chip bg-purple-600 text-white px-3 py-2 rounded-full text-sm cursor-move hover:bg-purple-700 transition flex items-center gap-2"
            draggable="true"
            data-player-id="${player.id}">
            <span>${player.name}</span>
            <button
                class="remove-player-btn hover:bg-purple-800 rounded-full w-4 h-4 flex items-center justify-center text-xs"
                data-player-id="${player.id}"
                onclick="event.stopPropagation(); removePlayer(${player.id})">
                ×
            </button>
        </div>
    `;
}

// Drag and drop functionality
function initializeDragAndDrop() {
    const playerChips = document.querySelectorAll('.player-chip');
    const dropZones = document.querySelectorAll('.team-drop-zone');

    playerChips.forEach(chip => {
        chip.addEventListener('dragstart', handleDragStart);
        chip.addEventListener('dragend', handleDragEnd);
    });

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
    });

    // Available players zone
    availablePlayers.addEventListener('dragover', handleDragOver);
    availablePlayers.addEventListener('drop', handleDropToAvailable);
    availablePlayers.addEventListener('dragleave', handleDragLeave);
}

let draggedPlayerId = null;

function handleDragStart(e) {
    draggedPlayerId = parseInt(e.target.dataset.playerId);
    e.target.classList.add('opacity-50');
}

function handleDragEnd(e) {
    e.target.classList.remove('opacity-50');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('bg-purple-900/30');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('bg-purple-900/30');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-purple-900/30');

    const teamId = parseInt(e.currentTarget.dataset.team);
    const player = players.find(p => p.id === draggedPlayerId);

    if (player) {
        // Remove from previous team if assigned
        if (player.team !== null) {
            const prevTeam = teams.find(t => t.id === player.team);
            prevTeam.players = prevTeam.players.filter(p => p.id !== player.id);
        }

        // Add to new team
        player.team = teamId;
        teams[teamId].players.push(player);

        renderSetup();
    }
}

function handleDropToAvailable(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-purple-900/30');

    const player = players.find(p => p.id === draggedPlayerId);

    if (player && player.team !== null) {
        // Remove from team
        const prevTeam = teams.find(t => t.id === player.team);
        prevTeam.players = prevTeam.players.filter(p => p.id !== player.id);
        player.team = null;

        renderSetup();
    }
}

// Start draft with animation
async function startDraft() {
    setupSection.classList.add('hidden');
    draftSection.classList.remove('hidden');
    eventNameEl.textContent = eventName;

    // Get unassigned players and shuffle them
    const unassignedPlayers = players.filter(p => p.team === null);
    const shuffled = shuffle([...unassignedPlayers]);

    // Render initial teams (with pre-assigned players)
    renderDraftTeams();

    // Draft animation - snake draft order
    let currentTeam = 0;
    let reverse = false;

    for (const player of shuffled) {
        // Show picking indicator
        renderDraftTeams(null, currentTeam);

        await sleep(1000); // Animation delay

        // Add player to current team
        teams[currentTeam].players.push(player);
        player.team = currentTeam;

        // Render with animation
        renderDraftTeams(player.id);

        await sleep(500); // Pause after pick

        // Snake draft: Team 0, 1, 2, 2, 1, 0, 0, 1, 2...
        if (!reverse) {
            currentTeam++;
            if (currentTeam >= numTeams) {
                currentTeam = numTeams - 1;
                reverse = true;
            }
        } else {
            currentTeam--;
            if (currentTeam < 0) {
                currentTeam = 0;
                reverse = false;
            }
        }
    }

    // Final render without highlighting
    renderDraftTeams();
}

// Render draft results
function renderDraftTeams(highlightPlayerId = null, pickingTeamId = null) {
    draftTeams.innerHTML = teams.map(team => `
        <div class="bg-gray-700 rounded-lg p-4 ${team.id === pickingTeamId ? 'picking-indicator ring-2 ring-purple-500' : ''}">
            <h3 class="font-bold text-lg text-white mb-3">${team.name}</h3>
            <div class="space-y-2">
                ${team.players.map(p => `
                    <div class="bg-gray-600 px-4 py-2 rounded-lg text-white ${p.id === highlightPlayerId ? 'draft-animate bg-purple-600' : ''}">
                        ${p.name}
                    </div>
                `).join('')}
                ${team.players.length === 0 ? '<p class="text-gray-400 text-sm">No players yet</p>' : ''}
            </div>
        </div>
    `).join('');
}

// Add new player
function addNewPlayer() {
    const playerName = newPlayerInput.value.trim();
    if (!playerName) {
        return;
    }

    const newPlayer = {
        id: players.length,
        name: playerName,
        team: null
    };

    players.push(newPlayer);
    newPlayerInput.value = '';
    renderSetup();
}

// Remove player
function removePlayer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Remove from team if assigned
    if (player.team !== null) {
        const team = teams.find(t => t.id === player.team);
        team.players = team.players.filter(p => p.id !== playerId);
    }

    // Remove from players array
    players = players.filter(p => p.id !== playerId);

    renderSetup();
}

// Redraft - go back to setup with current players
function handleRedraft() {
    // Reset all team assignments
    players.forEach(p => p.team = null);
    initializeTeams();

    draftSection.classList.add('hidden');
    setupSection.classList.remove('hidden');

    renderSetup();
}

// Edit team name
function editTeamName(teamId) {
    const team = teams.find(t => t.id === teamId);
    const newName = prompt('Enter team name:', team.name);
    if (newName && newName.trim()) {
        team.name = newName.trim();
        renderSetup();
    }
}

// Update player count display
function updatePlayerCount() {
    const input = playerInput.value.trim();
    if (!input) {
        playerCountDisplay.innerHTML = '';
        return;
    }

    const lines = input.split('\n').filter(line => line.trim());
    const playerCount = Math.max(0, lines.length - 1); // Subtract 1 for event name
    const numTeamsValue = parseInt(teamCountInput.value) || 2;

    if (playerCount === 0) {
        playerCountDisplay.innerHTML = '';
        return;
    }

    const playersPerTeam = Math.floor(playerCount / numTeamsValue);
    const remainder = playerCount % numTeamsValue;

    let displayText = `${playerCount} players, ${numTeamsValue} teams = ~${playersPerTeam} per team`;
    let colorClass = 'text-gray-400';

    if (remainder > 0) {
        displayText += ` (${remainder} extra player${remainder > 1 ? 's' : ''})`;
        colorClass = 'text-yellow-400';
    }

    if (playerCount < numTeamsValue) {
        displayText = `⚠️ Not enough players! Need at least ${numTeamsValue} players for ${numTeamsValue} teams`;
        colorClass = 'text-red-400';
    }

    playerCountDisplay.innerHTML = `<p class="${colorClass}">${displayText}</p>`;
}

// Save draft to localStorage
function saveDraft() {
    const draftData = {
        eventName,
        players,
        teams,
        numTeams,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem('savedDraft', JSON.stringify(draftData));
    alert('Draft saved! You can load it later.');
}

// Save draft results
function saveDraftResults() {
    saveDraft();
}

// Load saved draft
function loadSavedDraft() {
    const saved = localStorage.getItem('savedDraft');
    if (!saved) {
        alert('No saved draft found!');
        return;
    }

    const draftData = JSON.parse(saved);
    eventName = draftData.eventName;
    players = draftData.players;
    teams = draftData.teams;
    numTeams = draftData.numTeams;

    // Update inputs
    const playerNames = [eventName, ...players.map(p => p.name)];
    playerInput.value = playerNames.join('\n');
    teamCountInput.value = numTeams;

    inputSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
    renderSetup();

    const savedDate = new Date(draftData.savedAt).toLocaleString();
    alert(`Draft loaded from ${savedDate}`);
}

// Copy teams to clipboard
async function copyTeamsToClipboard() {
    let text = `${eventName}\n\n`;
    teams.forEach(team => {
        text += `${team.name}:\n`;
        team.players.forEach(p => {
            text += `  - ${p.name}\n`;
        });
        text += '\n';
    });

    try {
        await navigator.clipboard.writeText(text);
        alert('Teams copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Teams copied to clipboard!');
    }
}

// Manual draft mode
let manualDraftState = {
    currentTeam: 0,
    reverse: false,
    availablePlayers: []
};

function startManualDraft() {
    setupSection.classList.add('hidden');
    manualDraftSection.classList.remove('hidden');
    manualEventName.textContent = eventName;

    // Get unassigned players
    const unassigned = players.filter(p => p.team === null);
    manualDraftState.availablePlayers = [...unassigned];
    manualDraftState.currentTeam = 0;
    manualDraftState.reverse = false;

    renderManualDraft();
}

function renderManualDraft() {
    const currentTeamObj = teams[manualDraftState.currentTeam];
    currentPickTeam.textContent = currentTeamObj.name;

    // Render available players as clickable buttons
    manualAvailablePlayers.innerHTML = manualDraftState.availablePlayers.map(p => `
        <button
            class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full text-sm transition transform hover:scale-105"
            onclick="pickPlayer(${p.id})">
            ${p.name}
        </button>
    `).join('');

    // Render teams
    manualDraftTeams.innerHTML = teams.map(team => `
        <div class="bg-gray-700 rounded-lg p-4 ${team.id === manualDraftState.currentTeam ? 'ring-2 ring-purple-500' : ''}">
            <h3 class="font-bold text-lg text-white mb-3">${team.name}</h3>
            <div class="space-y-2">
                ${team.players.map(p => `
                    <div class="bg-gray-600 px-4 py-2 rounded-lg text-white">
                        ${p.name}
                    </div>
                `).join('')}
                ${team.players.length === 0 ? '<p class="text-gray-400 text-sm">No players yet</p>' : ''}
            </div>
        </div>
    `).join('');

    // Check if draft is complete
    if (manualDraftState.availablePlayers.length === 0) {
        finishManualDraft();
    }
}

function pickPlayer(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    // Add to current team
    teams[manualDraftState.currentTeam].players.push(player);
    player.team = manualDraftState.currentTeam;

    // Remove from available
    manualDraftState.availablePlayers = manualDraftState.availablePlayers.filter(p => p.id !== playerId);

    // Move to next team (snake draft)
    if (!manualDraftState.reverse) {
        manualDraftState.currentTeam++;
        if (manualDraftState.currentTeam >= numTeams) {
            manualDraftState.currentTeam = numTeams - 1;
            manualDraftState.reverse = true;
        }
    } else {
        manualDraftState.currentTeam--;
        if (manualDraftState.currentTeam < 0) {
            manualDraftState.currentTeam = 0;
            manualDraftState.reverse = false;
        }
    }

    renderManualDraft();
}

function finishManualDraft() {
    manualDraftSection.classList.add('hidden');
    draftSection.classList.remove('hidden');
    eventNameEl.textContent = eventName;
    renderDraftTeams();
}

// Reset everything
function reset() {
    eventName = '';
    players = [];
    teams = [];
    playerInput.value = '';
    teamCountInput.value = '2';

    draftSection.classList.add('hidden');
    setupSection.classList.add('hidden');
    manualDraftSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    updatePlayerCount();
}

// Utility functions
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
