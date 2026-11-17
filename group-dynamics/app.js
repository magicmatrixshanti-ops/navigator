(() => {
  const data = window.GROUP_DYNAMICS_DATA;
  const cards = new Map(data.cards.map((card) => [card.number, card]));
  const parameters = [
    { name: "Поле связи", type: "common" },
    { name: "Что каждый получает от отношений", type: "people" },
    { name: "Что удерживает группу вместе", type: "common" },
    { name: "Силы, которые развиваются внутри группы", type: "people" },
    { name: "Причина конфликта", type: "common" },
    { name: "Влияние конфликта на каждого участника", type: "people" },
    { name: "Истинная цель отношений", type: "common" },
    { name: "Как поможет достигнутая цель", type: "people" },
    { name: "Итоговый результат", type: "common" }
  ];
  const relationshipParameters = [
    { name: "Поле связи", type: "common" },
    { name: "Что каждый получает от отношений", type: "two" },
    { name: "Что удерживает группу вместе", type: "common" },
    { name: "Силы, которые развиваются в этой связи", type: "two" },
    { name: "Причина конфликта", type: "common" },
    { name: "Влияние конфликта на каждого участника", type: "two" },
    { name: "Истинная цель отношений", type: "common" },
    { name: "Как поможет достигнутая цель", type: "two" },
    { name: "Итоговый результат", type: "common" }
  ];
  const $ = (selector) => document.querySelector(selector);
  const peopleBox = $("#people");
  const urlContext = new URLSearchParams(window.location.search);
  const STATE_API = "http://127.0.0.1:8790/api/state";
  const PRACTICE_API = "http://127.0.0.1:8790/api/group-practice";
  const PRACTICE_DRAFTS = "matrix_group_practice_drafts_v1";
  let activePractice = null;

  function fold52(value) { while (value > 52) value -= 52; return value; }
  function escapeHtml(value) { const node = document.createElement("i"); node.textContent = value; return node.innerHTML; }
  function monthDay(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    return match ? `${Number(match[2])}.${Number(match[3])}` : null;
  }
  function getCardByDate(value) {
    const record = data.dates[monthDay(value)];
    return record ? cards.get(record.cardNumber) : null;
  }
  function cardView(card, title) {
    return `<article class="card-view"><b>${card.number}</b><div><span>${escapeHtml(title)}</span><h3>${escapeHtml(card.displayName)}</h3><p>${escapeHtml(card.meaning)}</p></div></article>`;
  }
  function tableCard(card) {
    return `<b>${escapeHtml(card.displayName)}</b><p>${escapeHtml(card.meaning)}</p>`;
  }
  function accessPractice(card) {
    const rank = card.displayName.slice(0, -1) === "Т" ? "Туз" : card.displayName.slice(0, -1);
    const suit = { "♥": "черв", "♣": "треф", "♦": "бубен", "♠": "пик" }[card.displayName.slice(-1)];
    const cardName = `${rank} ${suit}`;
    return typeof accessPracticeHtml === "function" ? accessPracticeHtml(cardName, "daily-access-practice") : "";
  }
  function practiceKey(value, people) {
    const ids = people.map((person) => `${person.birthDate}:${person.name.trim().toLowerCase()}`).sort().join("|");
    const sourceEventId = urlContext.get("sourceEventId") || "";
    return `${value}|${sourceEventId}|${ids}`;
  }
  function practiceContext(value, people) {
    return {
      date: value,
      sourceEventId: urlContext.get("sourceEventId") || "",
      participants: people.map((person) => ({ name: person.name, birthDate: person.birthDate })),
    };
  }
  function practiceBlock() {
    const text = activePractice && activePractice.text ? activePractice.text : "";
    return `<div class="group-practice"><button id="group-practice-button" type="button">✦ Практика группы</button><div id="group-practice-editor" hidden><label>Авторская практика для этой группы и даты<textarea id="group-practice-text" maxlength="20000" placeholder="Введите практику дня для этой группы.">${escapeHtml(text)}</textarea></label><div class="practice-actions"><button id="group-practice-save" type="button">Сохранить практику</button><button id="group-practice-cancel" class="pale" type="button">Отмена</button></div></div>${text ? `<div id="group-practice-display" class="group-practice-display">${escapeHtml(text).replace(/\n/g, "<br>")}</div>` : `<p id="group-practice-display" class="hint">Практика для этой группы и даты ещё не записана.</p>`}<p id="group-practice-status" class="hint" aria-live="polite"></p></div>`;
  }
  function practiceDrafts() {
    try { return JSON.parse(localStorage.getItem(PRACTICE_DRAFTS) || "{}"); } catch (error) { return {}; }
  }
  function savePracticeDraft(key, text) {
    try {
      const drafts = practiceDrafts();
      if (text.trim()) drafts[key] = text;
      else delete drafts[key];
      localStorage.setItem(PRACTICE_DRAFTS, JSON.stringify(drafts));
    } catch (error) { /* browser storage is an additional safety net */ }
  }
  async function loadGroupPractice(key) {
    activePractice = { key, context: activePractice.context, text: "" };
    try {
      const response = await fetch(STATE_API);
      const result = await response.json();
      const stored = result && result.state && result.state.groupPractices && result.state.groupPractices[key];
      if (stored && typeof stored.text === "string") activePractice = { key, context: activePractice.context, text: stored.text };
    } catch (error) { /* local service may be started later */ }
    if (!activePractice.text) activePractice.text = practiceDrafts()[key] || "";
  }
  function setPracticeStatus(message, isError) {
    const status = $("#group-practice-status");
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? "#9a3d2e" : "#486a44";
  }
  async function practiceResponse(response) {
    const raw = await response.text();
    let result = null;
    try { result = raw ? JSON.parse(raw) : null; } catch (error) { /* handled below */ }
    if (!response.ok || !result || !result.ok) {
      throw new Error((result && result.error) || `Служба ответила с кодом ${response.status}.`);
    }
    return result;
  }
  function bindGroupPractice() {
    const button = $("#group-practice-button");
    const editor = $("#group-practice-editor");
    const display = $("#group-practice-display");
    if (!button || !editor || !activePractice) return;
    button.onclick = () => { editor.hidden = !editor.hidden; if (!editor.hidden) $("#group-practice-text").focus(); };
    $("#group-practice-cancel").onclick = () => { editor.hidden = true; $("#group-practice-text").value = activePractice.text || ""; };
    $("#group-practice-text").oninput = () => savePracticeDraft(activePractice.key, $("#group-practice-text").value);
    $("#group-practice-save").onclick = async () => {
      const text = $("#group-practice-text").value;
      savePracticeDraft(activePractice.key, text);
      activePractice.text = text.trim();
      display.className = activePractice.text ? "group-practice-display" : "hint";
      display.innerHTML = activePractice.text ? escapeHtml(activePractice.text).replace(/\n/g, "<br>") : "Практика для этой группы и даты ещё не записана.";
      const saveButton = $("#group-practice-save");
      saveButton.disabled = true;
      setPracticeStatus("Черновик сохранён в браузере. Сохраняю в D и H…", false);
      try {
        const response = await fetch(PRACTICE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: activePractice.key, text, context: activePractice.context }) });
        await practiceResponse(response);
        editor.hidden = true;
        savePracticeDraft(activePractice.key, "");
        setPracticeStatus("Сохранено в D и H.", false);
      } catch (error) {
        editor.hidden = false;
        const detail = error && error.message ? ` Причина: ${error.message}` : "";
        setPracticeStatus(`Черновик сохранён в браузере; D/H временно недоступны. Текст остаётся здесь — повторите сохранение позже.${detail}`, true);
      } finally {
        saveButton.disabled = false;
      }
    };
  }
  function dayResource(card) {
    const rank = card.displayName.slice(0, -1) === "Т" ? "Туз" : card.displayName.slice(0, -1);
    const suit = { "♥": "черв", "♣": "треф", "♦": "бубен", "♠": "пик" }[card.displayName.slice(-1)];
    const source = typeof TEXTS !== "undefined" && TEXTS[`${rank} ${suit}`];
    return source && source.d ? source.d : card.meaning;
  }
  function dynamicRows(groupCard, people) {
    let common = groupCard;
    return parameters.map((parameter) => {
      if (parameter.type === "common") return { ...parameter, common };
      const personCards = people.map((person) => cards.get(fold52(person.card.number + common.number)));
      common = cards.get(fold52(personCards.reduce((sum, card) => sum + card.number, 0)));
      return { ...parameter, personCards };
    });
  }
  function relationshipRows(groupCard, personCard) {
    let common = cards.get(fold52(groupCard.number + personCard.number));
    return relationshipParameters.map((parameter) => {
      if (parameter.type === "common") return { ...parameter, common };
      const group = cards.get(fold52(groupCard.number + common.number));
      const person = cards.get(fold52(personCard.number + common.number));
      common = cards.get(fold52(group.number + person.number));
      return { ...parameter, group, person };
    });
  }
  function relationshipTable(rows, groupLabel, personLabel) {
    return `<div class="relationship-table"><div class="relationship-table-head"><span>Параметр</span><span>${escapeHtml(groupLabel)}</span><span>${escapeHtml(personLabel)}</span></div>${rows.map((row) => row.type === "common"
      ? `<div class="relationship-row common-row"><h3>${escapeHtml(row.name)}</h3><div class="common-result">${tableCard(row.common)}</div></div>`
      : `<div class="relationship-row two-row"><h3>${escapeHtml(row.name)}</h3><div>${tableCard(row.group)}</div><div>${tableCard(row.person)}</div></div>`).join("")}</div>`;
  }
  function updatePersonCard(row) {
    const card = getCardByDate(row.querySelector(".birth-date").value);
    row.querySelector(".birth-card").textContent = card ? `Карта рождения: ${card.displayName} · число ${card.number}` : "Карта рождения появится после выбора даты";
  }
  function renumber() {
    [...peopleBox.children].forEach((row, index) => {
      row.querySelector(".num").textContent = index + 1;
      row.querySelector(".remove").disabled = peopleBox.children.length <= 2;
    });
    $("#count").textContent = `${peopleBox.children.length} / 22`;
    $("#add").disabled = peopleBox.children.length >= 22;
  }
  function addPerson(entry = {}) {
    const row = document.createElement("div");
    row.className = "person";
    row.innerHTML = `<b class="num"></b><label>Имя участника<input class="name" maxlength="50" value="${escapeHtml(entry.name || "")}" placeholder="Имя"></label><label>Дата рождения<input class="birth-date" type="date" value="${escapeHtml(entry.birthDate || "")}"></label><span class="birth-card"></span><button class="remove" type="button" aria-label="Удалить">×</button>`;
    row.querySelector(".remove").onclick = () => { if (peopleBox.children.length > 2) { row.remove(); renumber(); } };
    row.querySelector(".birth-date").addEventListener("input", () => updatePersonCard(row));
    row.querySelector(".birth-date").addEventListener("change", () => updatePersonCard(row));
    peopleBox.append(row);
    updatePersonCard(row);
    renumber();
  }
  function collectPeople() {
    return [...peopleBox.children].map((row, index) => {
      const birthDate = row.querySelector(".birth-date").value;
      return { name: row.querySelector(".name").value.trim() || `Участник ${index + 1}`, birthDate, card: getCardByDate(birthDate) };
    });
  }
  function showGroup() {
    const error = $("#error");
    const people = collectPeople();
    error.textContent = "";
    $("#out").hidden = true;
    if (people.length < 2 || people.length > 22) { error.textContent = "Введите от 2 до 22 участников."; return; }
    const incomplete = people.filter((person) => !person.birthDate);
    if (incomplete.length) {
      error.textContent = `Введите полную дату рождения для: ${incomplete.map((person) => person.name).join(", ")}.`;
      return;
    }
    const unmapped = people.filter((person) => !person.card);
    if (unmapped.length) {
      error.textContent = `Для даты рождения не найдена карта в локальной таблице: ${unmapped.map((person) => person.name).join(", ")}.`;
      return;
    }
    const groupCard = cards.get(fold52(people.reduce((sum, person) => sum + person.card.number, 0)));
    const groupName = $("#team-title").value.trim() || "Общее поле команды";
    $("#out-title").textContent = groupName;
    $("#team-card").innerHTML = cardView(groupCard, `Все участники команды · ${people.length}`);
    const rows = dynamicRows(groupCard, people);
    $("#params").innerHTML = rows.map((row) => {
      if (row.type === "common") {
        return `<article class="group-section common-group-section"><h3>${escapeHtml(row.name)}</h3><div class="group-common-result">${tableCard(row.common)}</div></article>`;
      }
      return `<article class="group-section people-group-section"><h3>${escapeHtml(row.name)}</h3><div class="people-list"><div class="people-list-head"><span>Имя</span><span>Карта рождения</span><span>Резонанс</span><span>Расшифровка</span></div>${people.map((person, index) => { const card = row.personCards[index]; return `<div class="person-result"><span>${escapeHtml(person.name)}</span><span>${escapeHtml(person.card.displayName)} · ${person.card.number}</span><span><b>${escapeHtml(card.displayName)}</b> · ${card.number}</span><span>${escapeHtml(card.meaning)}</span></div>`; }).join("")}</div></article>`;
    }).join("");
    renderPersonMode(people);
    renderDayMode(groupCard);
    $("#out").hidden = false;
    $("#out").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function renderPersonMode(people) {
    const picker = $("#person-picker");
    const result = $("#person-result");
    let selected = 0;
    function render() {
      picker.innerHTML = people.map((person, index) => `<button type="button" class="person-choice ${index === selected ? "selected" : ""}" data-index="${index}"><b>${escapeHtml(person.name)}</b><span>${escapeHtml(person.card.displayName)} · ${person.card.number}</span>${index === selected ? "<small>На паузе в карте группы</small>" : "<small>Участвует в карте группы</small>"}</button>`).join("");
      picker.querySelectorAll("button").forEach((button) => button.onclick = () => { selected = Number(button.dataset.index); render(); });
      const person = people[selected];
      const remaining = people.filter((_, index) => index !== selected);
      const groupCard = cards.get(fold52(remaining.reduce((sum, item) => sum + item.card.number, 0)));
      const rows = relationshipRows(groupCard, person.card);
      result.innerHTML = `<div class="source-cards">${cardView(groupCard, `Группа без ${person.name} · ${remaining.length}`)}${cardView(person.card, `Персонаж · ${person.name}`)}</div><div class="relationship-wrap">${relationshipTable(rows, "Группа", `Персонаж · ${person.name}`)}</div>`;
    }
    render();
  }
  async function renderDayMode(groupCard) {
    const value = $("#selected-date").value;
    const target = $("#day-result");
    if (!value) { target.innerHTML = `<p class="hint">Выберите дату — появятся карта дня, общий ресурс дня и дневная активация.</p>`; return; }
    const dayCard = getCardByDate(value);
    if (!dayCard) { target.innerHTML = `<p class="hint">Для выбранной даты нет карты в локальной таблице.</p>`; return; }
    const resonance = cards.get(fold52(groupCard.number + dayCard.number));
    const passedDate = urlContext.get("selectedDate");
    const passedCard = value === passedDate ? urlContext.get("dayCard") : "";
    const passedResource = value === passedDate ? urlContext.get("dayResource") : "";
    const resourceTitle = passedCard ? `Общий ресурс дня · ${passedCard}` : `Общий ресурс дня · ${dayCard.displayName}`;
    const resourceText = passedResource || dayResource(dayCard);
    const people = collectPeople();
    activePractice = { key: practiceKey(value, people), context: practiceContext(value, people), text: "" };
    await loadGroupPractice(activePractice.key);
    target.innerHTML = `<div class="source-cards">${cardView(groupCard, "Постоянное поле команды")}${cardView(dayCard, "Карта дня")}${cardView(resonance, "Дневной резонанс")}</div><div class="daily-status"><h3>${escapeHtml(resourceTitle)}</h3><p>${escapeHtml(resourceText)}</p><h3>Единый общий дневной вердикт</h3>${tableCard(resonance)}<h3>Осознанный шаг группы</h3>${practiceBlock()}${accessPractice(resonance)}</div>`;
    if (typeof kpuPracticeBind === "function") kpuPracticeBind("daily-access-practice");
    bindGroupPractice();
  }
  async function applyNavigatorContext() {
    const selectedDate = urlContext.get("selectedDate");
    const status = $("#navigator-context");
    if (selectedDate) $("#selected-date").value = selectedDate;
    const ids = (urlContext.get("participantIds") || "").split(",").filter(Boolean);
    const source = (() => { try { return JSON.parse(localStorage.getItem("matrix_test_environment_events_v1") || ""); } catch (error) { return null; } })();
    let people = source && Array.isArray(source.people) ? source.people : [];
    let sourceLabel = "этого браузера";
    if (ids.length && ids.some((id) => !people.some((person) => person.id === id))) {
      try {
        const response = await fetch(STATE_API);
        const result = await practiceResponse(response);
        if (result.state && Array.isArray(result.state.people)) {
          people = result.state.people;
          sourceLabel = "локальной службы D/H";
        }
      } catch (error) { /* The page remains usable with the browser's own data. */ }
    }
    const selectedPeople = ids.map((id) => people.find((person) => person.id === id)).filter(Boolean);
    if (selectedPeople.length) { peopleBox.innerHTML = ""; selectedPeople.forEach((person) => addPerson({ name: person.name, birthDate: person.birthDate })); }
    if (selectedDate || ids.length) { status.hidden = false; status.textContent = `Контекст Navigator получен: дата ${selectedDate || "не передана"}; участников ${selectedPeople.length}${selectedPeople.length ? ` из ${sourceLabel}` : ""}. Карта дня и общий ресурс переданы из выбранного дня.`; }
    if (selectedPeople.length >= 2) showGroup();
  }
  $("#add").onclick = () => { if (peopleBox.children.length < 22) addPerson(); };
  $("#run").onclick = showGroup;
  $("#selected-date").addEventListener("input", () => { const people = collectPeople(); if (people.length < 2 || people.some((person) => !person.card)) return; const groupCard = cards.get(fold52(people.reduce((sum, person) => sum + person.card.number, 0))); renderDayMode(groupCard); });
  $("#selected-date").addEventListener("change", () => { const people = collectPeople(); if (people.length < 2 || people.some((person) => !person.card)) return; const groupCard = cards.get(fold52(people.reduce((sum, person) => sum + person.card.number, 0))); renderDayMode(groupCard); });
  addPerson();
  addPerson();
  void applyNavigatorContext();
})();
