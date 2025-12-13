<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	let user = null;
	let email = '';
	let password = '';
	let loading = false;
	let error = '';

	// Group selection
	let groups = [];
	let selectedGroupId = null;
	let selectedGroup = null;

	// Event-based rating management
	let events = [];
	let selectedEventId = null;
	let selectedEvent = null;
	let eventPlayerRatings = {}; // {playerName: rating}
	let newPlayerName = ''; // For adding players to event

	// Event creation
	let showEventModal = false;
	let newEventName = '';
	let newEventDate = '';
	let newEventTime = '19:00';
	let newEventPlayers = '';

	// Team generation
	let numTeams = 2;
	let generatedTeams = [];
	let showTeamsModal = false;

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (data.session) {
			user = data.session.user;
			await loadGroups();
		}
	});

	async function handleLogin() {
		loading = true;
		error = '';

		const { data, error: loginError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (loginError) {
			error = loginError.message;
		} else {
			user = data.user;
			await loadGroups();
		}
		loading = false;
	}

	async function handleLogout() {
		await supabase.auth.signOut();
		user = null;
		groups = [];
		events = [];
		selectedGroupId = null;
	}

	async function loadGroups() {
		const { data, error: loadError } = await supabase
			.from('groups')
			.select('*')
			.eq('admin_email', user.email)
			.order('created_at', { ascending: false});

		if (loadError) {
			console.error('Error loading groups:', loadError);
		} else {
			groups = data || [];
			if (groups.length > 0 && !selectedGroupId) {
				selectedGroupId = groups[0].id;
				await selectGroup(groups[0].id);
			}
		}
	}

	async function selectGroup(groupId) {
		selectedGroupId = groupId;
		selectedGroup = groups.find(g => g.id === groupId);
		await loadEvents();
	}

	async function loadEvents() {
		const { data, error: loadError } = await supabase
			.from('events')
			.select('*')
			.eq('group_id', selectedGroupId)
			.order('date', { ascending: false });

		if (loadError) {
			console.error('Error loading events:', loadError);
		} else {
			events = data || [];
		}
	}

	// Event rating management
	async function selectEventForRating(eventId) {
		selectedEventId = eventId;
		selectedEvent = events.find(e => e.id === eventId);

		// Load existing admin ratings for this event
		await loadAdminRatings(eventId);
	}

	async function loadAdminRatings(eventId) {
		const { data, error: loadError } = await supabase
			.from('survey_responses')
			.select('*')
			.eq('event_id', eventId)
			.eq('respondent_name', '__ADMIN__'); // Special identifier for admin ratings

		if (loadError) {
			console.error('Error loading admin ratings:', loadError);
			eventPlayerRatings = {};
		} else {
			// Build ratings object
			eventPlayerRatings = {};
			data.forEach(response => {
				eventPlayerRatings[response.player_name] = response.rating;
			});
		}
	}

	async function saveEventRatings() {
		if (!selectedEvent) return;

		// Collect ratings (only for players that have ratings)
		const ratingsToSave = [];
		for (const playerName of selectedEvent.player_names) {
			const rating = eventPlayerRatings[playerName];
			if (rating && rating >= 1 && rating <= 10) {
				ratingsToSave.push({
					event_id: selectedEvent.id,
					respondent_name: '__ADMIN__',
					player_name: playerName,
					rating: parseFloat(rating)
				});
			}
		}

		if (ratingsToSave.length > 0) {
			// Use upsert to update existing or insert new
			const { error: upsertError } = await supabase
				.from('survey_responses')
				.upsert(ratingsToSave, {
					onConflict: 'event_id,respondent_name,player_name'
				});

			if (upsertError) {
				console.error('Upsert error:', upsertError);
				alert('Error saving ratings: ' + upsertError.message);
			} else {
				alert(`Saved ${ratingsToSave.length} admin ratings!`);
			}
		} else {
			// Delete all admin ratings for this event if no ratings provided
			const { error: deleteError } = await supabase
				.from('survey_responses')
				.delete()
				.eq('event_id', selectedEvent.id)
				.eq('respondent_name', '__ADMIN__');

			if (deleteError) {
				alert('Error clearing ratings: ' + deleteError.message);
			} else {
				alert('All admin ratings cleared');
			}
		}
	}

	function backToEventList() {
		selectedEventId = null;
		selectedEvent = null;
		eventPlayerRatings = {};
	}

	// Event creation functions
	function openEventModal() {
		showEventModal = true;
	}

	function closeEventModal() {
		showEventModal = false;
		newEventName = '';
		newEventDate = '';
		newEventTime = '19:00';
		newEventPlayers = '';
	}

	async function createNewEvent() {
		if (!newEventName.trim()) {
			alert('Please enter an event name');
			return;
		}

		if (!newEventDate) {
			alert('Please select a date');
			return;
		}

		const playerNames = newEventPlayers
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0);

		if (playerNames.length === 0) {
			alert('Please enter at least one player name');
			return;
		}

		const dateTime = new Date(`${newEventDate}T${newEventTime}`).toISOString();

		const { error: createError } = await supabase
			.from('events')
			.insert({
				group_id: selectedGroupId,
				name: newEventName.trim(),
				date: dateTime,
				player_names: playerNames,
				status: 'survey'
			});

		if (createError) {
			alert('Error creating event: ' + createError.message);
		} else {
			alert('Event created successfully!');
			await loadEvents();
			closeEventModal();
		}
	}

	// Add player to selected event
	async function addPlayerToEvent() {
		if (!newPlayerName.trim()) {
			alert('Please enter a player name');
			return;
		}

		const trimmedName = newPlayerName.trim();

		if (selectedEvent.player_names.includes(trimmedName)) {
			alert('Player already exists in this event!');
			return;
		}

		// Update event with new player
		const updatedPlayers = [...selectedEvent.player_names, trimmedName];

		const { error: updateError } = await supabase
			.from('events')
			.update({ player_names: updatedPlayers })
			.eq('id', selectedEvent.id);

		if (updateError) {
			alert('Error adding player: ' + updateError.message);
		} else {
			selectedEvent.player_names = updatedPlayers;
			newPlayerName = '';
			await loadEvents();
			// Reload the selected event
			selectedEvent = events.find(e => e.id === selectedEvent.id);
		}
	}

	async function removePlayerFromEvent(playerName) {
		if (confirm(`Remove ${playerName} from this event?`)) {
			const updatedPlayers = selectedEvent.player_names.filter(p => p !== playerName);

			const { error: updateError } = await supabase
				.from('events')
				.update({ player_names: updatedPlayers })
				.eq('id', selectedEvent.id);

			if (updateError) {
				alert('Error removing player: ' + updateError.message);
			} else {
				// Also remove their rating
				delete eventPlayerRatings[playerName];
				selectedEvent.player_names = updatedPlayers;
				await loadEvents();
				selectedEvent = events.find(e => e.id === selectedEvent.id);
			}
		}
	}

	// Team generation functions
	async function generateTeams(event) {
		// Load survey data for this event
		const { data: surveyData, error: surveyError } = await supabase
			.from('survey_responses')
			.select('*')
			.eq('event_id', event.id);

		if (surveyError) {
			console.error('Error loading survey data:', surveyError);
			return;
		}

		// Calculate average ratings
		const playerAverages = event.player_names.map(playerName => {
			const ratings = surveyData
				.filter(r => r.player_name === playerName)
				.map(r => r.rating);

			const average = ratings.length > 0
				? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
				: 5.0;

			return {
				name: playerName,
				average: average
			};
		});

		// Sort by rating (descending)
		const playersWithRatings = playerAverages.map(p => ({
			name: p.name,
			rating: p.average
		}));
		playersWithRatings.sort((a, b) => b.rating - a.rating);

		if (playersWithRatings.length < numTeams) {
			alert(`Need at least ${numTeams} players for ${numTeams} teams`);
			return;
		}

		// Initialize teams
		const teams = [];
		for (let i = 0; i < numTeams; i++) {
			teams.push({
				id: i,
				name: `Team ${i + 1}`,
				players: [],
				totalRating: 0
			});
		}

		// Snake draft
		let currentTeam = 0;
		let reverse = false;

		for (const player of playersWithRatings) {
			teams[currentTeam].players.push(player);
			teams[currentTeam].totalRating += player.rating;

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

		// Round total ratings
		teams.forEach(team => {
			team.totalRating = Math.round(team.totalRating * 10) / 10;
		});

		// Save to database
		const { error: updateError } = await supabase
			.from('events')
			.update({
				status: 'drafted',
				teams: teams
			})
			.eq('id', event.id);

		if (updateError) {
			alert('Error saving teams: ' + updateError.message);
		} else {
			generatedTeams = teams;
			selectedEvent = { ...event, teams: teams };
			showTeamsModal = true;
			await loadEvents();
		}
	}

	function closeTeamsModal() {
		showTeamsModal = false;
		generatedTeams = [];
	}

	async function copyTeamsToClipboard() {
		let text = `${selectedEvent.name}\n\n`;
		generatedTeams.forEach(team => {
			text += `${team.name} (Rating: ${team.totalRating}):\n`;
			team.players.forEach(p => {
				text += `  - ${p.name} (${Math.round(p.rating * 10) / 10})\n`;
			});
			text += '\n';
		});

		try {
			await navigator.clipboard.writeText(text);
			alert('Teams copied to clipboard!');
		} catch (err) {
			alert('Failed to copy');
		}
	}
</script>

<svelte:head>
	<title>Admin Panel - Soccer Manager</title>
</svelte:head>

<div class="max-w-6xl mx-auto p-4 min-h-screen">
	<header class="text-center mb-8">
		<h1 class="text-3xl font-bold text-white mb-2">Admin Panel</h1>
		<a href="/" class="text-purple-400 hover:text-purple-300 text-sm">
			← Back to Home
		</a>
	</header>

	{#if !user}
		<!-- Login Form -->
		<div class="max-w-md mx-auto bg-gray-800 rounded-lg shadow-xl p-6">
			<h2 class="text-xl font-bold text-white mb-4">Admin Login</h2>

			{#if error}
				<div class="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
					{error}
				</div>
			{/if}

			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-300 mb-2">Email</label>
				<input
					type="email"
					bind:value={email}
					placeholder="admin@example.com"
					class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
				/>
			</div>

			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
				<input
					type="password"
					bind:value={password}
					placeholder="••••••••"
					class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
				/>
			</div>

			<button
				onclick={handleLogin}
				disabled={loading}
				class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50"
			>
				{loading ? 'Logging in...' : 'Login'}
			</button>

			<p class="text-gray-400 text-sm mt-4 text-center">
				Login with the admin email you set when creating the group
			</p>
		</div>
	{:else}
		<!-- Admin Panel -->
		<div class="space-y-6">
			<!-- Header with logout -->
			<div class="flex justify-between items-center">
				<p class="text-gray-400 text-sm">Logged in as {user.email}</p>
				<button
					onclick={handleLogout}
					class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-200"
				>
					Logout
				</button>
			</div>

			<!-- Group Selection -->
			{#if groups.length === 0}
				<div class="bg-yellow-500/20 border border-yellow-500 text-yellow-300 px-4 py-3 rounded-lg">
					<p>No groups found with admin email: {user.email}</p>
					<p class="text-sm mt-2">Create a group and use this email as the admin email</p>
				</div>
			{:else}
				<div class="bg-gray-800 rounded-lg p-6">
					<label class="block text-sm font-medium text-gray-300 mb-2">Select Group</label>
					<select
						bind:value={selectedGroupId}
						onchange={() => selectGroup(selectedGroupId)}
						class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
					>
						{#each groups as group}
							<option value={group.id}>{group.name}</option>
						{/each}
					</select>
				</div>

				{#if selectedGroup}
					<!-- Event-Based Ratings -->
					<div class="bg-gray-800 rounded-lg shadow-xl p-6">
						<h2 class="text-xl font-bold text-white mb-2">Set Player Ratings (Optional)</h2>
						<p class="text-gray-400 text-sm mb-4">
							Manage players and set ratings per event. These mix with survey ratings.
						</p>

						{#if !selectedEvent}
							<!-- Event List -->
							<div class="space-y-2">
								{#if events.length === 0}
									<p class="text-gray-400 text-center py-8">No events yet</p>
								{:else}
									{#each events as event}
										<button
											onclick={() => selectEventForRating(event.id)}
											class="w-full bg-gray-700 hover:bg-gray-600 text-left px-4 py-3 rounded-lg transition"
										>
											<div class="text-white font-medium">{event.name}</div>
											<div class="text-gray-400 text-sm">
												{new Date(event.date).toLocaleDateString()} • {event.player_names.length} players
											</div>
										</button>
									{/each}
								{/if}
							</div>
						{:else}
							<!-- Rating Editor -->
							<div>
								<button
									onclick={backToEventList}
									class="text-gray-400 hover:text-white text-sm mb-4"
								>
									← Back to events
								</button>

								<h3 class="text-white font-semibold mb-3">{selectedEvent.name}</h3>

								<!-- Add Player Section -->
								<div class="mb-4 p-3 bg-gray-700 rounded-lg">
									<label class="block text-sm font-medium text-gray-300 mb-2">Add Player to Event</label>
									<div class="flex gap-2">
										<input
											type="text"
											bind:value={newPlayerName}
											placeholder="Player name"
											class="flex-1 bg-gray-600 border border-gray-500 text-white rounded-lg px-3 py-2 text-sm"
											onkeypress={(e) => e.key === 'Enter' && addPlayerToEvent()}
										/>
										<button
											onclick={addPlayerToEvent}
											class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold"
										>
											Add
										</button>
									</div>
								</div>

								<div class="space-y-2 mb-4 max-h-64 overflow-y-auto">
									{#each selectedEvent.player_names as playerName}
										<div class="flex items-center gap-2 bg-gray-700 px-3 py-2 rounded">
											<span class="text-white text-sm flex-1">{playerName}</span>
											<input
												type="number"
												bind:value={eventPlayerRatings[playerName]}
												min="1"
												max="10"
												step="0.5"
												placeholder="Rating"
												class="w-20 bg-gray-600 border border-gray-500 text-white rounded px-2 py-1 text-sm"
											/>
											<button
												onclick={() => removePlayerFromEvent(playerName)}
												class="text-red-400 hover:text-red-300 text-xs px-2"
											>
												Remove
											</button>
										</div>
									{/each}
								</div>

								<button
									onclick={saveEventRatings}
									class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition"
								>
									Save Ratings
								</button>

								<p class="text-gray-400 text-xs mt-2">
									💡 Leave blank to use only survey ratings. Admin ratings are mixed with user survey ratings.
								</p>
							</div>
						{/if}
					</div>

					<!-- Event Management Section -->
					<div class="bg-gray-800 rounded-lg shadow-xl p-6 mt-6">
						<div class="flex justify-between items-center mb-4">
							<div>
								<h2 class="text-xl font-bold text-white">Event Management</h2>
								<p class="text-gray-400 text-sm">Create events and generate teams</p>
							</div>
							<button
								onclick={openEventModal}
								class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
							>
								+ Create Event
							</button>
						</div>

						{#if events.length === 0}
							<div class="text-center py-8 text-gray-400">
								No events yet. Click "Create Event" to get started.
							</div>
						{:else}
							<div class="space-y-3">
								{#each events as event}
									<div class="bg-gray-700 rounded-lg p-4">
										<div class="flex justify-between items-start mb-3">
											<div>
												<h3 class="text-white font-semibold">{event.name}</h3>
												<p class="text-gray-400 text-sm">
													{new Date(event.date).toLocaleDateString()} • {event.player_names.length} players
												</p>
											</div>
											<span class="px-3 py-1 rounded-full text-sm {
												event.status === 'survey' ? 'bg-yellow-500/20 text-yellow-400' :
												event.status === 'drafted' ? 'bg-green-500/20 text-green-400' :
												'bg-gray-500/20 text-gray-400'
											}">
												{event.status === 'survey' ? 'Survey Open' : event.status === 'drafted' ? 'Teams Ready' : 'Completed'}
											</span>
										</div>

										<div class="flex gap-2 items-center">
											<label class="text-gray-300 text-sm">Teams:</label>
											<input
												type="number"
												bind:value={numTeams}
												min="2"
												max="10"
												class="w-16 bg-gray-600 border border-gray-500 text-white rounded px-2 py-1 text-sm"
											/>

											{#if event.status === 'drafted'}
												<button
													onclick={() => generateTeams(event)}
													class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition text-sm"
												>
													Regenerate Teams
												</button>
												<button
													onclick={() => { generatedTeams = event.teams; selectedEvent = event; showTeamsModal = true; }}
													class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm"
												>
													View Teams
												</button>
											{:else}
												<button
													onclick={() => generateTeams(event)}
													class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition text-sm"
												>
													Generate Teams
												</button>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Event Creation Modal -->
	{#if showEventModal}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-2xl font-bold text-white">Create New Event</h2>
						<button
							onclick={closeEventModal}
							class="text-gray-400 hover:text-white text-2xl leading-none"
						>
							×
						</button>
					</div>

					<div class="space-y-4">
						<!-- Event Name -->
						<div>
							<label class="block text-sm font-medium text-gray-300 mb-2">
								Event Name *
							</label>
							<input
								type="text"
								bind:value={newEventName}
								placeholder="Game Night - Jan 15"
								class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
							/>
						</div>

						<!-- Date and Time -->
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-300 mb-2">
									Date *
								</label>
								<input
									type="date"
									bind:value={newEventDate}
									class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-300 mb-2">
									Time
								</label>
								<input
									type="time"
									bind:value={newEventTime}
									class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
								/>
							</div>
						</div>

						<!-- Player List -->
						<div>
							<label class="block text-sm font-medium text-gray-300 mb-2">
								Player Names (one per line) *
							</label>
							<textarea
								bind:value={newEventPlayers}
								rows="10"
								placeholder="John Doe&#10;Jane Smith&#10;Bob Johnson&#10;..."
								class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 font-mono text-sm"
							></textarea>
							<p class="text-gray-400 text-xs mt-1">
								{newEventPlayers.split('\n').filter(l => l.trim()).length} players
							</p>
						</div>

						<!-- Buttons -->
						<div class="flex gap-3 pt-4">
							<button
								onclick={closeEventModal}
								class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition"
							>
								Cancel
							</button>
							<button
								onclick={createNewEvent}
								class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition"
							>
								Create Event
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Teams Display Modal -->
	{#if showTeamsModal && generatedTeams.length > 0}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div class="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
				<div class="p-6">
					<div class="flex justify-between items-center mb-6">
						<h2 class="text-2xl font-bold text-white">Teams - {selectedEvent?.name}</h2>
						<button
							onclick={closeTeamsModal}
							class="text-gray-400 hover:text-white text-2xl leading-none"
						>
							×
						</button>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
						{#each generatedTeams as team}
							<div class="bg-gray-700 rounded-lg p-4">
								<h3 class="text-xl font-bold text-white mb-3">{team.name}</h3>
								<div class="space-y-2 mb-3">
									{#each team.players as player}
										<div class="bg-gray-600 px-4 py-2 rounded-lg flex justify-between">
											<span class="text-white">{player.name}</span>
											<span class="text-gray-400">⭐ {Math.round(player.rating * 10) / 10}</span>
										</div>
									{/each}
								</div>
								<div class="text-sm text-purple-400 font-semibold">
									Total Rating: {team.totalRating}
								</div>
							</div>
						{/each}
					</div>

					<button
						onclick={copyTeamsToClipboard}
						class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition"
					>
						Copy Teams to Clipboard
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background-color: #111827;
	}
</style>
