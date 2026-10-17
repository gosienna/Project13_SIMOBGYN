const $ = (id) => document.getElementById(id);

let lastStats = '';

export const hud = {
  setStats({ money, treated, babies, waiting, ward }) {
    const html = `
      <h1>Sim OB/GYN</h1>
      <div class="row"><span>Funds</span><b>$${money.toLocaleString()}</b></div>
      <div class="row"><span>Patients treated</span><b>${treated}</b></div>
      <div class="row"><span>Babies delivered</span><b>${babies}</b></div>
      <div class="row"><span>Waiting</span><b>${waiting}</b></div>
      <div class="row"><span>Ward beds</span><b>${ward}</b></div>`;
    if (html !== lastStats) {
      $('stats').innerHTML = html;
      lastStats = html;
    }
  },

  showPrompt(html, x, y) {
    const el = $('prompt');
    if (el.innerHTML !== html) el.innerHTML = html;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.remove('hidden');
  },

  hidePrompt() {
    $('prompt').classList.add('hidden');
  },

  toast(text, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 4500);
    setTimeout(() => el.remove(), 5000);
  },

  /** Shows a timed progress bar; resolves when it completes. */
  progress(label, seconds) {
    const box = $('progress');
    const fill = box.querySelector('.fill');
    box.querySelector('.label').textContent = label;
    fill.style.transition = 'none';
    fill.style.width = '0%';
    box.classList.remove('hidden');
    // Force layout so the transition restarts from 0.
    void fill.offsetWidth;
    fill.style.transition = `width ${seconds}s linear`;
    fill.style.width = '100%';
    return new Promise((resolve) => {
      setTimeout(() => {
        box.classList.add('hidden');
        resolve();
      }, seconds * 1000);
    });
  },
};
