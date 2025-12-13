<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let groupId = '';
	let group = null;
	let events = [];
	let currentView = 'events'; // events, survey, results
	let selectedEvent = null;
	let loading = true;
	let error = '';

	// Survey state
	let myName = '';
	let surveyRatings = {}; // {playerName: rating}
	let allSurveyResponses = [];
	let playerAverages = [];
	let nameError = '';
	let ratingsError = '';
	let playerErrors = {}; // {playerName: errorMessage}

	// Draft state
	let draftedTeams = [];

	// Track submitted surveys in sessionStorage
	const SURVEY_STORAGE_KEY = 'submittedSurveys';

	$: groupId = $page.params.id;

	onMount(async () => {
		await loadGroup();
		await loadEvents();
	});

	async function loadGroup() {
		const { data, error: loadError } = await supabase
			.from('groups')
			.select('*')
			.eq('id', groupId)
			.single();

		if (loadError || !data) {
			error = 'Group not found';
			setTimeout(() => goto('/'), 2000);
		} else {
			group = data;
		}
		loading = false;
	}

	async function loadEvents() {
		const { data, error: loadError } = await supabase
			.from('events')
			.select('*')
			.eq('group_id', groupId)
			.order('date', { ascending: false });

		if (loadError) {
			console.error('Error loading events:', loadError);
		} else {
			events = data || [];
		}
	}

	// Check if user has submitted survey for this event
	function hasSubmittedSurvey(eventId) {
		try {
			const submitted = sessionStorage.getItem(SURVEY_STORAGE_KEY);
			if (!submitted) return false;
			const surveys = JSON.parse(submitted);
			return surveys[eventId] !== undefined;
		} catch (e) {
			return false;
		}
	}

	// Get submission info for an event
	function getSubmissionInfo(eventId) {
		try {
			const submitted = sessionStorage.getItem(SURVEY_STORAGE_KEY);
			if (!submitted) return null;
			const surveys = JSON.parse(submitted);
			return surveys[eventId] || null;
		} catch (e) {
			return null;
		}
	}

	// Mark survey as submitted
	function markSurveySubmitted(eventId, userName) {
		try {
			const submitted = sessionStorage.getItem(SURVEY_STORAGE_KEY);
			const surveys = submitted ? JSON.parse(submitted) : {};
			surveys[eventId] = {
				userName,
				submittedAt: new Date().toISOString()
			};
			sessionStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(surveys));
		} catch (e) {
			console.error('Error saving survey submission:', e);
		}
	}

	async function openSurvey(event) {
		selectedEvent = event;
		await loadSurveyData(event.id);

		// Initialize ratings object for all players
		surveyRatings = {};
		event.player_names.forEach(name => {
			surveyRatings[name] = null;
		});

		// Pre-fill name and ratings if they've submitted before
		const submissionInfo = getSubmissionInfo(event.id);
		if (submissionInfo) {
			myName = submissionInfo.userName;

			// Load previous ratings from database
			const previousRatings = allSurveyResponses.filter(
				r => r.respondent_name === submissionInfo.userName
			);

			// Pre-fill the ratings
			previousRatings.forEach(response => {
				surveyRatings[response.player_name] = response.rating;
			});
		}

		// Clear errors
		nameError = '';
		ratingsError = '';
		playerErrors = {};

		currentView = 'survey';
	}

	async function loadSurveyData(eventId) {
		const { data, error: loadError } = await supabase
			.from('survey_responses')
			.select('*')
			.eq('event_id', eventId);

		if (loadError) {
			console.error('Error loading survey:', loadError);
			allSurveyResponses = [];
		} else {
			allSurveyResponses = data || [];
		}

		// Calculate averages
		await calculatePlayerAverages();
	}

	async function calculatePlayerAverages() {
		if (!selectedEvent) return;

		const averages = selectedEvent.player_names.map(playerName => {
			const ratings = allSurveyResponses
				.filter(r => r.player_name === playerName)
				.map(r => r.rating);

			const average = ratings.length > 0
				? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
				: 5.0;

			return {
				name: playerName,
				average: average,
				numRatings: ratings.length
			};
		});

		playerAverages = averages;
	}

	async function submitSurvey() {
		// Clear previous errors
		nameError = '';
		ratingsError = '';
		playerErrors = {};

		// Validate name
		if (!myName.trim()) {
			nameError = 'Please enter your name';
			return;
		}

		// Collect and validate ratings
		const ratingsToSubmit = [];
		let hasValidationError = false;

		for (const [playerName, rating] of Object.entries(surveyRatings)) {
			if (rating !== null && rating !== undefined && rating !== '') {
				// Validate rating is within bounds
				const numRating = Number(rating);
				if (isNaN(numRating) || numRating < 1 || numRating > 10) {
					playerErrors[playerName] = 'Rating must be between 1 and 10';
					hasValidationError = true;
				} else {
					ratingsToSubmit.push({
						event_id: selectedEvent.id,
						respondent_name: myName.trim(),
						player_name: playerName,
						rating: numRating
					});
				}
			}
		}

		if (hasValidationError) {
			return;
		}

		if (ratingsToSubmit.length === 0) {
			ratingsError = 'Please rate at least one player';
			return;
		}

		// Use upsert with onConflict to update existing records or insert new ones
		const { error: submitError } = await supabase
			.from('survey_responses')
			.upsert(ratingsToSubmit, {
				onConflict: 'event_id,respondent_name,player_name'
			});

		if (submitError) {
			console.error('Upsert error:', submitError);
			ratingsError = 'Error submitting: ' + submitError.message;
		} else {
			// Mark survey as submitted in sessionStorage
			markSurveySubmitted(selectedEvent.id, myName.trim());

			alert('Ratings submitted! You can update them anytime.');
			await loadSurveyData(selectedEvent.id);

			// Don't clear form - keep it for review/updates
			// Stay on the same view
		}
	}

	async function viewResults(event) {
		selectedEvent = event;
		draftedTeams = event.teams || [];
		await loadSurveyData(event.id);
		currentView = 'results';
	}

	function backToEvents() {
		currentView = 'events';
		selectedEvent = null;
	}

	async function copyTeamsToClipboard() {
		let text = `${selectedEvent.name}\n\n`;
		draftedTeams.forEach(team => {
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

	function leaveGroup() {
		sessionStorage.removeItem('currentGroup');
		goto('/');
	}

	// Helper to get respondents count
	function getRespondentsCount() {
		const uniqueRespondents = new Set(allSurveyResponses.map(r => r.respondent_name));
		return uniqueRespondents.size;
	}
</script>

<svelte:head>
	<title>{group?.name || 'Group'} - Soccer Manager</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-4 min-h-screen">
	{#if loading}
		<div class="text-center text-white py-12">Loading...</div>
	{:else if error}
		<div class="text-center text-red-400 py-12">{error}</div>
	{:else}
		<!-- Header -->
		<div class="mb-6">
			<button onclick={leaveGroup} class="text-gray-400 hover:text-white text-sm mb-4">
				← Leave Group
			</button>
			<h1 class="text-3xl font-bold text-white mb-2">{group.name}</h1>
			<p class="text-gray-400">{events.length} events</p>
		</div>

		<!-- Events List View -->
		{#if currentView === 'events'}
			<div class="space-y-4">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-2xl font-bold text-white">Events</h2>
				</div>

				{#if events.length === 0}
					<div class="bg-gray-800 rounded-lg p-8 text-center">
						<p class="text-gray-400">No events yet. Contact your admin to create events.</p>
					</div>
				{:else}
					{#each events as event}
						<div class="bg-gray-800 rounded-lg p-6">
							<div class="flex justify-between items-start mb-4">
								<div>
									<h3 class="text-xl font-semibold text-white">{event.name}</h3>
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

							<!-- Submission Status -->
							{#if event.status === 'survey' && hasSubmittedSurvey(event.id)}
								{@const submissionInfo = getSubmissionInfo(event.id)}
								<div class="mb-3 flex items-center gap-2 text-sm">
									<span class="text-green-400">✓ You submitted ratings as {submissionInfo.userName}</span>
									<span class="text-gray-500">•</span>
									<span class="text-gray-400">{new Date(submissionInfo.submittedAt).toLocaleString()}</span>
								</div>
							{/if}

							<div class="flex gap-3">
								{#if event.status === 'survey'}
									<button
										onclick={() => openSurvey(event)}
										class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
									>
										{hasSubmittedSurvey(event.id) ? 'Update Ratings' : 'Rate Players'}
									</button>
								{:else if event.status === 'drafted'}
									<button
										onclick={() => viewResults(event)}
										class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
									>
										View Teams
									</button>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}

		<!-- Survey View -->
		{#if currentView === 'survey'}
			<div class="bg-gray-800 rounded-lg p-6">
				<button onclick={backToEvents} class="text-gray-400 hover:text-white text-sm mb-4">
					← Back to Events
				</button>

				<h2 class="text-2xl font-bold text-white mb-2">{selectedEvent.name}</h2>
				<p class="text-gray-400 mb-2">Rate each player's skill level (1-10)</p>

				<!-- Submission Status Banner -->
				{#if hasSubmittedSurvey(selectedEvent.id)}
					{@const submissionInfo = getSubmissionInfo(selectedEvent.id)}
					<div class="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
						<p class="text-green-400 text-sm">
							✓ You previously submitted ratings as <strong>{submissionInfo.userName}</strong>
							<span class="text-gray-400">on {new Date(submissionInfo.submittedAt).toLocaleString()}</span>
						</p>
						<p class="text-gray-400 text-xs mt-1">You can update your ratings below.</p>
					</div>
				{/if}

				<!-- Your Name Input -->
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-300 mb-2">Your Name</label>
					<input
						type="text"
						bind:value={myName}
						placeholder="Enter your name"
						class="w-full bg-gray-700 border {nameError ? 'border-red-500' : 'border-gray-600'} text-white rounded-lg px-4 py-2"
					/>
					{#if nameError}
						<p class="text-red-400 text-sm mt-1">{nameError}</p>
					{/if}
				</div>

				<!-- Rating Survey -->
				<div class="space-y-4 mb-6">
					<div class="flex justify-between items-center">
						<h3 class="text-lg font-semibold text-white">Rate Players (you can skip yourself)</h3>
						{#if ratingsError}
							<p class="text-red-400 text-sm">{ratingsError}</p>
						{/if}
					</div>
					{#each selectedEvent.player_names as playerName}
						<div class="bg-gray-700 rounded-lg p-4">
							<div class="flex justify-between items-center mb-2">
								<span class="text-white font-medium">{playerName}</span>
								{#if playerAverages.find(p => p.name === playerName)}
									{@const avg = playerAverages.find(p => p.name === playerName)}
									<span class="text-sm text-gray-400">
										Avg: {Math.round(avg.average * 10) / 10} ({avg.numRatings} ratings)
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<input
									type="number"
									bind:value={surveyRatings[playerName]}
									min="1"
									step="0.5"
									placeholder="Skip or rate 1-10"
									class="flex-1 min-w-0 bg-gray-600 border {playerErrors[playerName] ? 'border-red-500' : 'border-gray-500'} text-white rounded-lg px-3 py-2"
								/>
								<button
									onclick={() => surveyRatings[playerName] = null}
									class="flex-shrink-0 bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm"
								>
									Skip
								</button>
							</div>
							{#if playerErrors[playerName]}
								<p class="text-red-400 text-sm mt-1">{playerErrors[playerName]}</p>
							{/if}
						</div>
					{/each}
				</div>

				<button
					onclick={submitSurvey}
					class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition"
				>
					{hasSubmittedSurvey(selectedEvent.id) ? 'Update Ratings' : 'Submit Ratings'}
				</button>

				<!-- Survey Stats -->
				<div class="mt-6 bg-gray-700 rounded-lg p-4">
					<h4 class="text-white font-semibold mb-2">Survey Progress</h4>
					<p class="text-gray-300 text-sm">{getRespondentsCount()} people have submitted ratings</p>
				</div>
			</div>
		{/if}

		<!-- Results View -->
		{#if currentView === 'results'}
			<div class="bg-gray-800 rounded-lg p-6">
				<button onclick={backToEvents} class="text-gray-400 hover:text-white text-sm mb-4">
					← Back to Events
				</button>

				<h2 class="text-2xl font-bold text-white mb-6">Teams - {selectedEvent.name}</h2>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					{#each draftedTeams as team}
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
		{/if}
	{/if}
</div>

<style>
	:global(body) {
		background-color: #111827;
	}
</style>
