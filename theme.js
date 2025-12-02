// theme.js
// Shared theme helper for pages: apply and toggle persistent theme
export function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if(btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  try{ localStorage.setItem('theme', theme); }catch(e){}
}

export function initTheme(){
  try{
    const savedTheme = (function(){ try{ return localStorage.getItem('theme'); }catch(e){return null} })();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    document.addEventListener('click', (e)=>{
      if(e.target && e.target.id === 'theme-toggle'){
        const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        applyTheme(current === 'dark' ? 'light' : 'dark');
      }
    });
  }catch(e){/* ignore theme init errors */}
}
