import { writable } from 'svelte/store';

export const user = writable(null);
export const players = writable([]);
export const teams = writable([]);
export const eventName = writable('');
