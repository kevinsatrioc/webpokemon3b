// js/detail.js
import { getPokemon } from "./api.js";

const detailEl = document.getElementById('detail');

function getQuery(name){
  const u = new URL(window.location);
  return u.searchParams.get(name);
}

async function render(){
  const name = getQuery('name');
  if(!name) { detailEl.innerHTML = '<p class="muted">Tidak ada pokemon dipilih.</p>'; return; }

  detailEl.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const p = await getPokemon(name);
    const types = p.types.map(t=>t.type.name).join(', ');
    const statsHtml = p.stats.map(s => `<li>${s.stat.name}: ${s.base_stat}</li>`).join('');
    detailEl.innerHTML = `
      <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
        <img src="${p.sprites.front_default}" alt="${p.name}" class="big" onerror="this.style.display='none'">
        <div>
          <h2>${p.name} <small>#${p.id}</small></h2>
          <p class="muted">Types: ${types}</p>
          <button id="showMoves">Show Moves (${p.moves.length})</button>
          <div id="moves" style="margin-top:8px"></div>
        </div>
      </div>

      <div style="margin-top:12px">
        <h3>Stats</h3>
        <ul>${statsHtml}</ul>
      </div>

      <div style="margin-top:10px">
        <h3>Abilities</h3>
        <ul>${p.abilities.map(a=>`<li>${a.ability.name}${a.is_hidden? ' (hidden)':''}</li>`).join('')}</ul>
      </div>
    `;

    document.getElementById('showMoves').onclick = () => {
      const movesEl = document.getElementById('moves');
      movesEl.innerHTML = '<ul>' + p.moves.slice(0,20).map(m=>`<li>${m.move.name}</li>`).join('') + '</ul>';
    };

  } catch (err) {
    detailEl.innerHTML = `<p class="muted">Gagal memuat detail.</p>`;
    console.error(err);
  }
}

render();
