<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let currentSection = 'welcome'; // welcome, createGroup, joinGroup
	let loading = false;
	let error = '';

	// Create group form
	let newGroupName = '';
	let newGroupPassword = '';
	let newGroupAdminEmail = '';

	// Join group form
	let joinGroupId = '';
	let joinGroupPassword = '';

	// Available groups
	let groups = [];

	onMount(async () => {
		await loadGroups();
	});

	async function loadGroups() {
		const { data, error: loadError } = await supabase
			.from('groups')
			.select('id, name, created_at')
			.order('created_at', { ascending: false });

		if (loadError) {
			console.error('Error loading groups:', loadError);
		} else {
			groups = data || [];
		}
	}

	async function handleCreateGroup() {
		if (!newGroupName.trim()) {
			error = 'Please enter a group name';
			return;
		}
		if (!newGroupPassword.trim()) {
			error = 'Please enter a password';
			return;
		}

		loading = true;
		error = '';

		const { data, error: createError } = await supabase
			.from('groups')
			.insert({
				name: newGroupName.trim(),
				password_hash: newGroupPassword, // In production, hash this!
				admin_email: newGroupAdminEmail.trim() || null
			})
			.select()
			.single();

		loading = false;

		if (createError) {
			error = 'Error creating group: ' + createError.message;
		} else {
			// Store group info in sessionStorage
			sessionStorage.setItem('currentGroup', JSON.stringify({
				id: data.id,
				name: data.name
			}));
			// Redirect to group page
			goto(`/group/${data.id}`);
		}
	}

	async function handleJoinGroup(groupId) {
		const password = prompt('Enter group password:');
		if (!password) return;

		loading = true;
		error = '';

		// Verify password
		const { data: groupData, error: fetchError } = await supabase
			.from('groups')
			.select('*')
			.eq('id', groupId)
			.single();

		loading = false;

		if (fetchError) {
			error = 'Group not found';
			return;
		}

		// Simple password check (in production, use proper verification)
		if (groupData.password_hash === password) {
			sessionStorage.setItem('currentGroup', JSON.stringify({
				id: groupData.id,
				name: groupData.name
			}));
			goto(`/group/${groupData.id}`);
		} else {
			error = 'Incorrect password';
		}
	}

	function showCreateGroup() {
		currentSection = 'createGroup';
		error = '';
	}

	function showJoinGroup() {
		currentSection = 'joinGroup';
		error = '';
	}

	function backToWelcome() {
		currentSection = 'welcome';
		error = '';
		newGroupName = '';
		newGroupPassword = '';
		newGroupAdminEmail = '';
	}
</script>

<svelte:head>
	<title>Soccer Team Manager</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-4 min-h-screen">
	<header class="text-center mb-12 mt-8">
		<h1 class="text-4xl font-bold text-white mb-3">Soccer Team Manager</h1>
	</header>

	{#if error}
		<div class="max-w-md mx-auto mb-6 bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
			{error}
		</div>
	{/if}

	<!-- Welcome / Login Screen -->
	{#if currentSection === 'welcome'}
		<div class="max-w-md mx-auto space-y-4">
			<div class="bg-gray-800 rounded-lg shadow-xl p-8">
				<h2 class="text-2xl font-bold text-white mb-6 text-center">Get Started</h2>

				<button
					onclick={showCreateGroup}
					class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition duration-200 mb-3"
				>
					Create New Group
				</button>

				<div class="relative my-6">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-gray-600"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="px-2 bg-gray-800 text-gray-400">or</span>
					</div>
				</div>

				<button
					onclick={showJoinGroup}
					class="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition duration-200"
				>
					Join Existing Group
				</button>
			</div>

			<div class="text-center">
				<a href="/admin" class="text-purple-400 hover:text-purple-300 text-sm">
					Admin Panel →
				</a>
			</div>
		</div>
	{/if}

	<!-- Create Group Screen -->
	{#if currentSection === 'createGroup'}
		<div class="max-w-md mx-auto">
			<div class="bg-gray-800 rounded-lg shadow-xl p-8">
				<button
					onclick={backToWelcome}
					class="text-gray-400 hover:text-white mb-4 text-sm"
				>
					← Back
				</button>

				<h2 class="text-2xl font-bold text-white mb-6">Create New Group</h2>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Group Name *
						</label>
						<input
							type="text"
							bind:value={newGroupName}
							placeholder="Friday Night Soccer"
							class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Group Password *
						</label>
						<input
							type="password"
							bind:value={newGroupPassword}
							placeholder="Create a password"
							class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
						<p class="text-gray-400 text-xs mt-1">Share this with members to join</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">
							Admin Email (Optional)
						</label>
						<input
							type="email"
							bind:value={newGroupAdminEmail}
							placeholder="admin@example.com"
							class="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
						/>
						<p class="text-gray-400 text-xs mt-1">For admin panel access</p>
					</div>

					<button
						onclick={handleCreateGroup}
						disabled={loading}
						class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 mt-6"
					>
						{loading ? 'Creating...' : 'Create Group'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Join Group Screen -->
	{#if currentSection === 'joinGroup'}
		<div class="max-w-2xl mx-auto">
			<div class="bg-gray-800 rounded-lg shadow-xl p-8">
				<button
					onclick={backToWelcome}
					class="text-gray-400 hover:text-white mb-4 text-sm"
				>
					← Back
				</button>

				<h2 class="text-2xl font-bold text-white mb-6">Join a Group</h2>

				{#if groups.length === 0}
					<p class="text-gray-400 text-center py-8">No groups available yet. Create one!</p>
				{:else}
					<div class="space-y-3">
						{#each groups as group}
							<button
								onclick={() => handleJoinGroup(group.id)}
								class="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-4 text-left transition duration-200 flex items-center justify-between"
							>
								<div>
									<h3 class="text-white font-semibold text-lg">{group.name}</h3>
									<p class="text-gray-400 text-sm">
										Created {new Date(group.created_at).toLocaleDateString()}
									</p>
								</div>
								<div class="text-purple-400">
									Join →
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background-color: #111827;
	}
</style>
