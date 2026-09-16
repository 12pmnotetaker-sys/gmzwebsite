/** Live records are loaded only on the private Operations origin. */
export function setupLiveRoute() {
  if (location.hostname !== 'gmz-operations.gmzhavi.chatgpt.site') return;
  const byId = (id: string) => document.getElementById(id)!;
  byId('live-route-entry').hidden = true;
  byId('live-route-controls').hidden = false;
  // The private route view is read-only; attendance/time remain in the separate prototype.
  document.querySelector('.staff-demo')!.textContent =
    'Vista privada de GMZ Admin · rutas reales y notas de servicio. Acceso del personal pendiente. / Private Admin preview · actual routes and service notes. Staff access pending.';
  document.querySelector('.staff-demo')!.setAttribute('data-no-translate', '');
  document.querySelector('.shift-bar')?.setAttribute('hidden', '');
  document.querySelector('.staff-nav')?.setAttribute('hidden', '');
  document.querySelector('.route-aside')?.setAttribute('hidden', '');
  document.querySelector('#route-title')!.textContent = 'Rutas de GMZ / GMZ routes';
  document.querySelector('#route-title')!.previousElementSibling!.textContent =
    'DATOS DE GMZ / GMZ RECORDS';
  document.querySelector('.section-title-row .staff-badge')!.textContent = 'Privado / Private';
  document.querySelector('.staff-heading h1')!.textContent = 'Mi ruta / My route';
  document.querySelector('.staff-heading h1')!.nextElementSibling!.textContent =
    'GMZ · Vista de oficina / Office preview';
  document.querySelector('.staff-weather small')!.textContent = 'visitas / stops';
  document.querySelector('.staff-footer')?.setAttribute('hidden', '');
  // Keep the actual route view visible regardless of a stale prototype hash.
  const routeOnly = () => {
    for (const name of ['route', 'timesheets', 'attendance'])
      byId('section-' + name).hidden = name !== 'route';
  };
  routeOnly();
  window.addEventListener('hashchange', routeOnly);
  const date = byId('live-date') as HTMLInputElement;
  date.value = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(Date.now());
  const weekday = new Date(date.value + 'T12:00:00Z').getUTCDay();
  if (![1, 3].includes(weekday)) {
    const next = new Date(date.value + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + ((8 - weekday) % 7 || 7));
    date.value = next.toISOString().slice(0, 10);
  }
  const rotation = byId('live-rotation') as HTMLSelectElement;
  const esc = (s: unknown) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
  byId('route-list').innerHTML = '';
  let sequence = 0;
  async function load() {
    const current = ++sequence;
    byId('live-route-status').textContent = 'Cargando / Loading…';
    try {
      const r = await fetch(
        '/api/staff-route?date=' +
          encodeURIComponent(date.value) +
          '&rotation=' +
          encodeURIComponent(rotation.value),
        { cache: 'no-store' },
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error || 'No se pudieron cargar las rutas / Routes unavailable');
      if (current !== sequence) return;
      if (data.needsRotation) {
        const options = await Promise.all(
          ['wed-a', 'wed-b'].map(async (choice) => {
            const response = await fetch(
              '/api/staff-route?date=' + encodeURIComponent(date.value) + '&rotation=' + choice,
              { cache: 'no-store' },
            );
            if (!response.ok) throw Error('Routes unavailable');
            const result = await response.json();
            return result.stops.map((stop: any) => ({
              ...stop,
              option:
                choice === 'wed-a'
                  ? 'Miércoles A · opción / option'
                  : 'Miércoles B · opción / option',
            }));
          }),
        );
        if (current !== sequence) return;
        data.stops = options.flat();
      }
      byId('route-list').innerHTML = data.stops
        .map(
          (stop: any, i: number) =>
            `<article class="stop-card"><div class="stop-number">${i + 1}</div><div class="stop-main">${stop.option ? `<p class="staff-badge" data-no-translate>${esc(stop.option)}</p>` : ''}<h3 data-no-translate>${esc(stop.name)}</h3><p data-no-translate>${esc(stop.address)}${stop.city ? ', ' + esc(stop.city) : ''}</p><p data-no-translate>${esc(stop.crew)} · ${esc(stop.truck)}</p>${stop.instructions ? `<div class="service-note"><strong>Instrucciones de servicio / Service instructions</strong><p data-no-translate data-source-text>${esc(stop.instructions)}</p><button class="staff-button compact" data-translate>Traducir / Translate</button><p class="translated-note" data-no-translate aria-live="polite"></p></div>` : ''}<section class="service-note"><h4>Notas de GMZ Admin / Notes from GMZ Admin</h4>${stop.adminNotes.length ? stop.adminNotes.map((note: any) => `<div class="admin-request-note"><strong data-no-translate>${esc(note.reference)}</strong><p data-no-translate data-source-text>${esc(note.note)}</p><button class="staff-button compact" data-translate>Traducir / Translate</button><p class="translated-note" data-no-translate aria-live="polite"></p></div>`).join('') : '<p>Sin solicitudes adicionales asignadas. / No additional requests assigned.</p>'}</section></div></article>`,
        )
        .join('');
      byId('route-progress').textContent = String(data.stops.length);
      byId('live-route-status').textContent = data.needsRotation
        ? 'Opciones A y B: elige la ruta de esta fecha. / A and B alternatives: choose the route for this date.'
        : data.stops.length
          ? 'Actualizado. Las notas vienen de solicitudes que GMZ Admin agregó al servicio. / Updated. Notes come from requests Admin added to service.'
          : 'No hay visitas en esta fecha. Elige otro día. / No stops on this date. Choose another day.';
    } catch (e) {
      if (current === sequence) {
        byId('route-list').innerHTML = '';
        byId('live-route-status').textContent = (e as Error).message;
      }
    }
  }
  byId('live-refresh').addEventListener('click', load);
  date.addEventListener('change', load);
  rotation.addEventListener('change', load);
  byId('route-list').addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-translate]');
    if (!button) return;
    const block = button.parentElement!,
      original = block.querySelector('[data-source-text]')!.textContent!,
      output = block.querySelector('.translated-note')!;
    const target = document.documentElement.lang === 'en' ? 'en' : 'es',
      source = target === 'es' ? 'en' : 'es';
    const api = (window as any).Translator;
    if (!api) {
      output.textContent =
        'La traducción de notas requiere un navegador compatible con traducción local. Pide a la oficina una nota en español si no está disponible. / Note translation needs a browser with on-device translation. Ask the office for a translated note if unavailable.';
      return;
    }
    button.disabled = true;
    output.textContent = 'Traduciendo… / Translating…';
    let translator: any;
    try {
      const available = await api.availability({ sourceLanguage: source, targetLanguage: target });
      if (available === 'unavailable') throw Error('Unavailable');
      translator = await api.create({ sourceLanguage: source, targetLanguage: target });
      output.textContent = await translator.translate(original);
    } catch {
      output.textContent =
        'No se pudo traducir. El original sigue arriba. / Could not translate. The original remains above.';
    } finally {
      translator?.destroy();
      button.disabled = false;
    }
  });
  void load();
}
