// js/api.js
const API_BASE = "https://pokeapi.co/api/v2";

export async function fetchJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function listPokemon(limit=20, offset=0){
  return fetchJSON(`${API_BASE}/pokemon?limit=${limit}&offset=${offset}`);
}

export function getPokemon(nameOrId){
  return fetchJSON(`${API_BASE}/pokemon/${nameOrId}`);
}

export function listTypes(){
  return fetchJSON(`${API_BASE}/type`);
}
