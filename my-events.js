const PUBLIC_EVENTS_STORE = 'matrix_public_events_v1';
const PUBLIC_EVENTS_PROFILE = 'matrix_public_events_profile_v1';

var publicEventsState = (function () {
  try {
    var saved = JSON.parse(localStorage.getItem(PUBLIC_EVENTS_STORE) || '');
    if (saved && Array.isArray(saved.people) && Array.isArray(saved.events)) return saved;
  } catch (error) { /* A new browser begins with an empty local schedule. */ }
  return { people: [], events: [] };
})();

var publicEventsView = { year: cur.y, month: cur.m, selectedDate: '', scope: 'month', companionId: '', editor: '' };

function publicEventsSave() { try { localStorage.setItem(PUBLIC_EVENTS_STORE, JSON.stringify(publicEventsState)); } catch (error) {} }
function publicEventsEscape(value) { var node = document.createElement('span'); node.textContent = value || ''; return node.innerHTML; }
function publicEventsPad(value) { return String(value).padStart(2, '0'); }
function publicEventsDate(year, month, day) { return year + '-' + publicEventsPad(month + 1) + '-' + publicEventsPad(day); }
function publicEventsToday() { var date = new Date(); return publicEventsDate(date.getFullYear(), date.getMonth(), date.getDate()); }
function publicEventsMonthName(month) { return ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month]; }
function publicEventsDateLabel(value) { var parts = (value || '').split('-'); return parts.length === 3 ? parts[2] + '.' + parts[1] + '.' + parts[0] : value; }
function publicEventsProfile() {
  var id = '';
  try { id = localStorage.getItem(PUBLIC_EVENTS_PROFILE) || ''; } catch (error) {}
  return publicEventsState.people.find(function (person) { return person.id === id; }) || null;
}
function closePublicEvents() { var overlay = document.getElementById('publicEventsOverlay'); if (overlay) overlay.remove(); }
function openPublicEvents() {
  if (document.getElementById('publicEventsOverlay')) return;
  publicEventsView = { year: cur.y, month: cur.m, selectedDate: '', scope: 'month', companionId: '', editor: '' };
  var overlay = document.createElement('div');
  overlay.id = 'publicEventsOverlay';
  overlay.className = 'my-events-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);
  renderPublicEvents();
}
function publicEventsEditorHtml() {
  if (!publicEventsView.editor) return '';
  if (publicEventsView.editor === 'profile') return '<section class="my-events-editor"><h3>Новый профиль</h3><label>Имя<input id="publicProfileName" maxlength="60"></label><label>Дата рождения <small>(нужна для Dynamics команды)</small><input id="publicProfileBirthDate" type="date"></label><div class="my-events-actions"><button class="my-events-button strong" type="button" data-save-profile>Сохранить профиль</button><button class="my-events-button" type="button" data-cancel-editor>Отмена</button></div></section>';
  var profile = publicEventsProfile();
  return '<section class="my-events-editor"><h3>Новое событие</h3><label>Название<input id="publicEventTitle" maxlength="80"></label><label>Дата<input id="publicEventDate" type="date"></label><label>Время <input id="publicEventTime" type="time"></label><label>Короткая заметка<textarea id="publicEventNote" maxlength="500"></textarea></label><label>Участники<select id="publicEventPeople" multiple size="6">' + publicEventsState.people.map(function (person) { return '<option value="' + publicEventsEscape(person.id) + '"' + (profile && person.id === profile.id ? ' selected' : '') + '>' + publicEventsEscape(person.name) + '</option>'; }).join('') + '</select></label><div class="my-events-actions"><button class="my-events-button strong" type="button" data-save-event>Сохранить событие</button><button class="my-events-button" type="button" data-cancel-editor>Отмена</button></div></section>';
}
function renderPublicEvents() {
  var overlay = document.getElementById('publicEventsOverlay');
  if (!overlay) return;
  var profile = publicEventsProfile();
  var choices = publicEventsState.people.map(function (person) { return '<button type="button" data-public-profile="' + publicEventsEscape(person.id) + '"><b>' + publicEventsEscape(person.name) + '</b></button>'; }).join('');
  if (!profile) {
    overlay.innerHTML = '<div class="my-events-dialog"><div class="my-events-head"><div><h2>📅 Мои события</h2><p>Сначала выберите текущий профиль на этом устройстве.</p></div><button class="my-events-close" type="button" data-events-close>×</button></div>' + (choices ? '<div class="my-events-person-choice">' + choices + '</div>' : '<p class="my-events-empty">Профилей пока нет.</p>') + '<div class="my-events-actions"><button class="my-events-button strong" type="button" data-add-profile>+ Добавить профиль</button></div>' + publicEventsEditorHtml() + '</div>';
    bindPublicEvents();
    return;
  }
  var profileEvents = publicEventsState.events.filter(function (event) { return event.participantIds.indexOf(profile.id) >= 0; });
  var marks = {};
  profileEvents.forEach(function (event) { marks[event.date] = (marks[event.date] || 0) + 1; });
  var visible = profileEvents.filter(function (event) {
    if (publicEventsView.companionId && event.participantIds.indexOf(publicEventsView.companionId) < 0) return false;
    var today = publicEventsToday();
    if (publicEventsView.scope === 'today') return event.date === today;
    if (publicEventsView.scope === 'upcoming') return event.date > today;
    if (publicEventsView.scope === 'past') return event.date < today;
    return event.date.slice(0, 7) === publicEventsView.year + '-' + publicEventsPad(publicEventsView.month + 1);
  });
  if (publicEventsView.selectedDate) visible = visible.filter(function (event) { return event.date === publicEventsView.selectedDate; });
  visible.sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
  var first = (new Date(publicEventsView.year, publicEventsView.month, 1).getDay() + 6) % 7;
  var days = new Date(publicEventsView.year, publicEventsView.month + 1, 0).getDate();
  var cells = '';
  for (var blank = 0; blank < first; blank++) cells += '<span></span>';
  for (var day = 1; day <= days; day++) {
    var date = publicEventsDate(publicEventsView.year, publicEventsView.month, day), count = marks[date] || 0;
    cells += '<button type="button" class="my-events-day' + (count ? ' has-events' : '') + (date === publicEventsView.selectedDate ? ' selected' : '') + '" data-events-date="' + date + '">' + day + (count ? '<span class="my-events-dot"></span>' : '') + '</button>';
  }
  var titles = { month: 'этот месяц', today: 'сегодня', upcoming: 'ближайшие', past: 'прошедшие' };
  var listTitle = publicEventsView.selectedDate ? 'События ' + publicEventsDateLabel(publicEventsView.selectedDate) : 'События: ' + titles[publicEventsView.scope];
  var cards = visible.length ? visible.map(function (event) {
    var names = event.participantIds.map(function (id) { var person = publicEventsState.people.find(function (item) { return item.id === id; }); return person ? person.name : '—'; }).join(', ');
    var dynamics = event.participantIds.length > 1 ? '<button class="my-events-button strong" type="button" data-events-dynamics="' + publicEventsEscape(event.id) + '">Dynamics команды</button>' : '';
    return '<article class="my-event-card"><b>' + publicEventsEscape(event.title) + '</b><small>' + publicEventsDateLabel(event.date) + (event.time ? ' · ' + publicEventsEscape(event.time) : '') + '</small><small>Участники: ' + publicEventsEscape(names) + '</small>' + (event.note ? '<small>' + publicEventsEscape(event.note) + '</small>' : '') + '<div class="my-events-actions"><button class="my-events-button" type="button" data-events-main-date="' + publicEventsEscape(event.id) + '">Открыть дату</button>' + dynamics + '</div></article>';
  }).join('') : '<p class="my-events-empty">В выбранном представлении пока нет событий.</p>';
  var companions = publicEventsState.people.filter(function (person) { return person.id !== profile.id; }).map(function (person) { return '<option value="' + publicEventsEscape(person.id) + '"' + (publicEventsView.companionId === person.id ? ' selected' : '') + '>' + publicEventsEscape(person.name) + '</option>'; }).join('');
  overlay.innerHTML = '<div class="my-events-dialog"><div class="my-events-head"><div><h2>📅 Мои события · ' + publicEventsEscape(profile.name) + '</h2><p>Личное расписание по созданным на этом устройстве событиям.</p></div><button class="my-events-close" type="button" data-events-close>×</button></div><div class="my-events-controls"><button class="my-events-button" type="button" data-change-profile>Сменить профиль</button><button class="my-events-button strong" type="button" data-add-event>+ Событие</button><button class="my-events-button" type="button" data-add-profile>+ Профиль</button><button class="my-events-button ' + (publicEventsView.scope === 'month' ? 'active' : '') + '" type="button" data-events-scope="month">Этот месяц</button><button class="my-events-button ' + (publicEventsView.scope === 'today' ? 'active' : '') + '" type="button" data-events-scope="today">Сегодня</button><button class="my-events-button ' + (publicEventsView.scope === 'upcoming' ? 'active' : '') + '" type="button" data-events-scope="upcoming">Ближайшие</button><button class="my-events-button ' + (publicEventsView.scope === 'past' ? 'active' : '') + '" type="button" data-events-scope="past">Прошедшие</button><label>С участником<select data-events-companion><option value="">Все мои события</option>' + companions + '</select></label></div>' + publicEventsEditorHtml() + '<div class="my-events-layout"><section class="my-events-calendar"><div class="my-events-month"><button type="button" data-events-month="prev">‹</button><b>' + publicEventsMonthName(publicEventsView.month) + ' ' + publicEventsView.year + '</b><button type="button" data-events-month="next">›</button></div><div class="my-events-week"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="my-events-days">' + cells + '</div></section><section class="my-events-list"><h3>' + listTitle + '</h3>' + cards + '</section></div></div>';
  bindPublicEvents();
}
function bindPublicEvents() {
  var overlay = document.getElementById('publicEventsOverlay');
  if (!overlay) return;
  var close = overlay.querySelector('[data-events-close]'); if (close) close.onclick = closePublicEvents;
  overlay.querySelectorAll('[data-public-profile]').forEach(function (button) { button.onclick = function () { try { localStorage.setItem(PUBLIC_EVENTS_PROFILE, button.dataset.publicProfile); } catch (error) {} publicEventsView.editor = ''; renderPublicEvents(); }; });
  overlay.querySelectorAll('[data-add-profile]').forEach(function (button) { button.onclick = function () { publicEventsView.editor = 'profile'; renderPublicEvents(); }; });
  overlay.querySelectorAll('[data-add-event]').forEach(function (button) { button.onclick = function () { publicEventsView.editor = 'event'; renderPublicEvents(); }; });
  var cancel = overlay.querySelector('[data-cancel-editor]'); if (cancel) cancel.onclick = function () { publicEventsView.editor = ''; renderPublicEvents(); };
  var saveProfile = overlay.querySelector('[data-save-profile]'); if (saveProfile) saveProfile.onclick = function () { var name = document.getElementById('publicProfileName').value.trim(); if (!name) { alert('Укажите имя профиля.'); return; } var person = { id: 'p-' + Date.now(), name: name, birthDate: document.getElementById('publicProfileBirthDate').value }; publicEventsState.people.push(person); publicEventsSave(); try { localStorage.setItem(PUBLIC_EVENTS_PROFILE, person.id); } catch (error) {} publicEventsView.editor = ''; renderPublicEvents(); };
  var saveEvent = overlay.querySelector('[data-save-event]'); if (saveEvent) saveEvent.onclick = function () { var title = document.getElementById('publicEventTitle').value.trim(), date = document.getElementById('publicEventDate').value, ids = [].slice.call(document.getElementById('publicEventPeople').selectedOptions).map(function (option) { return option.value; }); if (!title || !date || !ids.length) { alert('Укажите название, дату и хотя бы одного участника.'); return; } publicEventsState.events.push({ id: 'e-' + Date.now(), title: title, date: date, time: document.getElementById('publicEventTime').value, note: document.getElementById('publicEventNote').value.trim(), participantIds: ids }); publicEventsSave(); publicEventsView.editor = ''; renderPublicEvents(); };
  var change = overlay.querySelector('[data-change-profile]'); if (change) change.onclick = function () { try { localStorage.removeItem(PUBLIC_EVENTS_PROFILE); } catch (error) {} publicEventsView.editor = ''; renderPublicEvents(); };
  var companion = overlay.querySelector('[data-events-companion]'); if (companion) companion.onchange = function () { publicEventsView.companionId = this.value; renderPublicEvents(); };
  overlay.querySelectorAll('[data-events-scope]').forEach(function (button) { button.onclick = function () { publicEventsView.scope = button.dataset.eventsScope; publicEventsView.selectedDate = ''; renderPublicEvents(); }; });
  overlay.querySelectorAll('[data-events-month]').forEach(function (button) { button.onclick = function () { publicEventsView.month += button.dataset.eventsMonth === 'next' ? 1 : -1; if (publicEventsView.month > 11) { publicEventsView.month = 0; publicEventsView.year++; } if (publicEventsView.month < 0) { publicEventsView.month = 11; publicEventsView.year--; } publicEventsView.selectedDate = ''; renderPublicEvents(); }; });
  overlay.querySelectorAll('[data-events-date]').forEach(function (button) { button.onclick = function () { publicEventsView.selectedDate = publicEventsView.selectedDate === button.dataset.eventsDate ? '' : button.dataset.eventsDate; renderPublicEvents(); }; });
  overlay.querySelectorAll('[data-events-main-date]').forEach(function (button) { button.onclick = function () { var event = publicEventsState.events.find(function (item) { return item.id === button.dataset.eventsMainDate; }); if (!event) return; var parts = event.date.split('-'); cur.y = Number(parts[0]); cur.m = Number(parts[1]) - 1; sel = Number(parts[2]); closePublicEvents(); render(); showDay(); }; });
  overlay.querySelectorAll('[data-events-dynamics]').forEach(function (button) { button.onclick = function () { var event = publicEventsState.events.find(function (item) { return item.id === button.dataset.eventsDynamics; }); if (!event) return; var parts = event.date.split('-'), key = Number(parts[2]) + '.' + Number(parts[1]), dayCard = (DATA.dates[key] || [])[0] || '', text = (DATA.texts && DATA.texts[dayCard]) || {}, params = new URLSearchParams({ selectedDate: event.date, dayCard: dayCard, dayResource: text.d || '', participantIds: event.participantIds.join(','), sourceEventId: event.id }); window.open('group-dynamics/index.html?' + params.toString(), '_blank', 'noopener'); }; });
}
document.getElementById('myEventsBtn').onclick = openPublicEvents;
