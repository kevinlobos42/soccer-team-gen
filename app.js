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

// Event Listeners
setupBtn.addEventListener('click', handleSetup);
startDraftBtn.addEventListener('click', startDraft);
resetBtn.addEventListener('click', reset);
addPlayerBtn.addEventListener('click', addNewPlayer);
redraftBtn.addEventListener('click', handleRedraft);

// Allow Enter key to add player
newPlayerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addNewPlayer();
    }
});

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
            <h3 class="font-semibold text-gray-300 mb-2">${team.name}</h3>
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

// Reset everything
function reset() {
    eventName = '';
    players = [];
    teams = [];
    playerInput.value = '';
    teamCountInput.value = '2';

    draftSection.classList.add('hidden');
    setupSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
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