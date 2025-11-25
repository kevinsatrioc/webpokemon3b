// js/home.js
import { listPokemon, getPokemon, listTypes } from "./api.js";

// Theme: apply saved theme or system preference
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if(btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  try{ localStorage.setItem('theme', theme); }catch(e){}
}

const savedTheme = (function(){
  try{ return localStorage.getItem('theme'); }catch(e){return null}
})();
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

document.addEventListener('click', (e)=>{
  if(e.target && e.target.id === 'theme-toggle'){
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }
  // language buttons
  if(e.target && e.target.classList && e.target.classList.contains('lang-btn')){
    const lang = e.target.dataset.lang;
    applyLang(lang);
  }
});

/* i18n translations */
const I18N = {
  en: {
    about: 'About',
    profile_sub: 'Browser Demo',
    welcome: 'Welcome, Trainer!',
    hero_desc: 'Explore the Pokemon collection or search by name or ID.',
    search_placeholder: 'Search Pokemon (name or id)',
    search_button: 'Search',
    label_fav: 'Favorites',
    label_added: 'Added',
    list_title: 'Pokemon List',
    nav_dashboard: 'Dashboard',
    nav_list: 'Pokemon List',
    nav_detail: 'Detail',
    nav_about: 'About',
    prev: 'Prev',
    next: 'Next',
    label_total: 'Total Pokemon',
    label_types: 'Types',
    loading: 'Loading...',
    failed_fetch: 'Failed to fetch data. Try refresh.',
    not_found_alert: 'Pokemon not found'
  },
  id: {
    about: 'Tentang',
    profile_sub: 'Demo Browser',
    welcome: 'Selamat datang, Trainer!',
    hero_desc: 'Jelajahi koleksi Pokemon atau cari langsung dengan nama atau ID.',
    search_placeholder: 'Cari Pokemon (nama atau id)',
    search_button: 'Cari',
    label_fav: 'Favorit',
    label_added: 'Ditambahkan',
    list_title: 'Daftar Pokemon',
    nav_dashboard: 'Dashboard',
    nav_list: 'Daftar Pokemon',
    nav_detail: 'Detail',
    nav_about: 'Tentang',
    prev: 'Sebelumnya',
    next: 'Berikutnya',
    label_total: 'Total Pokemon',
    label_types: 'Tipe',
    loading: 'Memuat...',
    failed_fetch: 'Gagal mengambil data. Coba refresh.',
    not_found_alert: 'Pokemon tidak ditemukan'
  }
};

function applyLang(lang){
  if(!lang) return;
  try{ localStorage.setItem('lang', lang); }catch(e){}
  // set text for elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const txt = (I18N[lang] && I18N[lang][key]) || '';
    el.textContent = txt;
  });
  // placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const txt = (I18N[lang] && I18N[lang][key]) || '';
    if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = txt;
  });
  // pager buttons
  const prev = document.getElementById('prev');
  const next = document.getElementById('next');
  if(prev) prev.textContent = (I18N[lang] && I18N[lang].prev) || prev.textContent;
  if(next) next.textContent = (I18N[lang] && I18N[lang].next) || next.textContent;
  // update hero texts specifically
  const heroTitle = document.querySelector('.hero h2');
  const heroDesc = document.querySelector('.hero p');
  if(heroTitle) heroTitle.textContent = (I18N[lang] && I18N[lang].welcome) || heroTitle.textContent;
  if(heroDesc) heroDesc.textContent = (I18N[lang] && I18N[lang].hero_desc) || heroDesc.textContent;
  // mark active button
  document.querySelectorAll('.lang-btn').forEach(b=> b.classList.toggle('active', b.dataset.lang === lang));
}

// initial language
const savedLang = (function(){ try{ return localStorage.getItem('lang'); }catch(e){return null} })();
const browserLang = (navigator.language || navigator.userLanguage || 'en').startsWith('id') ? 'id' : 'en';
applyLang(savedLang || browserLang);

// load summary stats (total pokemon, types)
async function loadStats(){
  const totalEl = document.getElementById('totalCount');
  const typeEl = document.getElementById('typeCount');
  try{
    const p = await listPokemon(1,0);
    if(totalEl) totalEl.textContent = p.count || '--';
  }catch(e){ if(totalEl) totalEl.textContent = '--'; }
  try{
    const t = await listTypes();
    if(typeEl) typeEl.textContent = (t.count || (t.results && t.results.length)) || '--';
  }catch(e){ if(typeEl) typeEl.textContent = '--'; }
}

loadStats();

const listEl = document.getElementById('list');
const qInput = document.getElementById('q');
const btnSearch = document.getElementById('btn-search');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const pageInfo = document.getElementById('pageInfo');

let limit = 20;
let offset = 0;
let totalCount = 0;

async function render(){
  const curLang = (function(){ try{ return localStorage.getItem('lang') || browserLang }catch(e){return browserLang} })();
  listEl.innerHTML = `<p class="muted">${(I18N[curLang] && I18N[curLang].loading) || 'Loading...'}</p>`;
  try {
    const data = await listPokemon(limit, offset);
    totalCount = data.count;
    pageInfo.textContent = `${Math.floor(offset/limit)+1} / ${Math.ceil(totalCount/limit)}`;

    // render cards; show name and small sprite by fetching each detail (lightweight)
    const items = await Promise.all(data.results.map(async r => {
      try {
        const p = await getPokemon(r.name);
        return { name: r.name, id: p.id, sprite: p.sprites?.front_default || '' };
      } catch {
        return { name: r.name, id: null, sprite: '' };
      }
    }));

    listEl.innerHTML = items.map((it, idx) => `
      <article class="card fade-up" style="animation-delay:${idx * 45}ms">
        <a href="detail.html?name=${it.name}">
          <img src="${it.sprite}" alt="${it.name}" class="thumb" onerror="this.style.visibility='hidden'">
          <div class="title">${it.name}</div>
        </a>
      </article>
    `).join('');

  } catch (err) {
    const cur = (function(){ try{ return localStorage.getItem('lang') || browserLang }catch(e){return browserLang} })();
    listEl.innerHTML = `<p class="muted">${(I18N[cur] && I18N[cur].failed_fetch) || 'Failed to fetch data. Try refresh.'}</p>`;
    console.error(err);
  }
}

btnSearch.onclick = async () => {
  const q = qInput.value.trim().toLowerCase();
  if(!q) { offset = 0; return render(); }
  try {
    const p = await getPokemon(q);
    window.location.href = `detail.html?name=${p.name}`;
  } catch {
    const cur = (function(){ try{ return localStorage.getItem('lang') || browserLang }catch(e){return browserLang} })();
    alert((I18N[cur] && I18N[cur].not_found_alert) || 'Pokemon not found');
  }
};

nextBtn.onclick = () => { if(offset + limit < totalCount) offset += limit; render(); };
prevBtn.onclick = () => { if(offset >= limit) offset -= limit; render(); };

// initial
render();
