const els = {
  calendar: document.getElementById('calendar'),
  monthTitle: document.getElementById('monthTitle'),
  workCard: document.getElementById('workCard'),
  shiftModal: document.getElementById('shiftModal'),
  baseShiftSelect: document.getElementById('baseShiftSelect'),
  extraTypeSelect: document.getElementById('extraTypeSelect'),
  extraTeamSelect: document.getElementById('extraTeamSelect'),
  extraTeamBox: document.getElementById('extraTeamBox'),
  modalTitle: document.getElementById('modalTitle'),
  modalDesc: document.getElementById('modalDesc')
};

let currentDate = new Date();
let selectedTeam = localStorage.getItem('selectedTeam') || 'A';
let editingDateKey = null;
let workState = { type: null, time: null, direction: null };

function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function storeKey(team, key) { return `scheduleEdit:${team}:${key}`; }

function getDefaultShift(team, date) {
  const diff = Math.floor((date - BASE_DATE) / 86400000);
  const index = ((diff % 4) + 4) % 4;
  return SHIFT_PATTERN[team][index];
}

function readSchedule(team, date) {
  const key = dateKey(date);
  const saved = localStorage.getItem(storeKey(team, key));
  const base = getDefaultShift(team, date);
  if (!saved) return { base, extraType: '', extraTeam: '' };
  try {
    const data = JSON.parse(saved);
    return {
      base: data.base || base,
      extraType: data.extraType || '',
      extraTeam: data.extraTeam || ''
    };
  } catch {
    return { base: saved || base, extraType: '', extraTeam: '' };
  }
}

function isEdited(team, date) {
  return localStorage.getItem(storeKey(team, dateKey(date))) !== null;
}

function extraText(data) {
  return data.extraType && data.extraTeam ? `${data.extraTeam}조 ${data.extraType}` : '';
}

function isWorking(data) {
  return data.base === '주간' || data.base === '야간' || Boolean(data.extraType);
}

function renderCalendar() {
  els.calendar.innerHTML = '';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  els.monthTitle.textContent = `${year}년 ${month + 1}월`;

  ['일', '월', '화', '수', '목', '금', '토'].forEach((day, index) => {
    const div = document.createElement('div');
    div.className = 'weekday' + (index === 0 ? ' sun' : '') + (index === 6 ? ' sat' : '');
    div.textContent = day;
    els.calendar.appendChild(div);
  });

  const first = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < first.getDay(); i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty';
    els.calendar.appendChild(empty);
  }

  for (let d = 1; d <= lastDate; d++) {
    const date = new Date(year, month, d);
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.onclick = () => openShiftModal(date);

    const today = new Date();
    if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) {
      cell.classList.add('today');
    }

    const mine = readSchedule(selectedTeam, date);
    const others = TEAMS
      .filter(team => team !== selectedTeam)
      .map(team => ({ team, data: readSchedule(team, date) }))
      .filter(item => isWorking(item.data));

    cell.innerHTML = `
      <div class="date-number">${d}</div>
      <div class="base-shift ${isEdited(selectedTeam, date) ? 'edited' : ''}">${mine.base}</div>
      ${extraText(mine) ? `<div class="extra-shift">${extraText(mine)}</div>` : ''}
      <div class="others-row">
        ${others.map(item => `<span class="other-shift">${item.team}${item.data.base}${item.data.extraType ? '+' + item.data.extraType : ''}</span>`).join('')}
      </div>`;
    els.calendar.appendChild(cell);
  }
}

function prevMonth() { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
function nextMonth() { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }

function toggleExtraBox() {
  els.extraTeamBox.style.display = els.extraTypeSelect.value ? 'block' : 'none';
}

function openShiftModal(date) {
  editingDateKey = dateKey(date);
  const data = readSchedule(selectedTeam, date);
  els.baseShiftSelect.value = data.base;
  els.extraTypeSelect.value = data.extraType;
  els.extraTeamSelect.value = data.extraTeam || 'D';
  toggleExtraBox();
  els.modalTitle.textContent = `${editingDateKey} 근무 변경`;
  els.modalDesc.textContent = `${selectedTeam}조 기본 근무는 ${getDefaultShift(selectedTeam, date)}입니다.`;
  els.shiftModal.classList.add('active');
}

function hideShiftModal() { els.shiftModal.classList.remove('active'); editingDateKey = null; }
function closeShiftModal(event) { if (event.target === els.shiftModal) hideShiftModal(); }

function saveShiftEdit() {
  if (!editingDateKey) return;
  const data = {
    base: els.baseShiftSelect.value,
    extraType: els.extraTypeSelect.value,
    extraTeam: els.extraTypeSelect.value ? els.extraTeamSelect.value : ''
  };
  localStorage.setItem(storeKey(selectedTeam, editingDateKey), JSON.stringify(data));
  hideShiftModal();
  renderCalendar();
}

function clearShiftEdit() {
  if (!editingDateKey) return;
  localStorage.removeItem(storeKey(selectedTeam, editingDateKey));
  hideShiftModal();
  renderCalendar();
}

function showTab(tab) {
  document.getElementById('calendarPage').classList.toggle('active', tab === 'calendar');
  document.getElementById('workPage').classList.toggle('active', tab === 'work');
  document.getElementById('calendarNav').classList.toggle('active', tab === 'calendar');
  document.getElementById('workNav').classList.toggle('active', tab === 'work');
  if (tab === 'work') renderWorkStep();
}

function renderWorkStep() {
  if (!workState.type) {
    els.workCard.innerHTML = `<p class="step-title">업무 종류 선택</p><p class="step-sub">먼저 어떤 업무인지 골라주세요.</p><div class="choice-grid"><button class="choice" onclick="setWork('type','안내')">안내 <span>승강장·고객 안내</span></button><button class="choice" onclick="setWork('type','매표')">매표 <span>승차권·창구 업무</span></button><button class="choice" onclick="setWork('type','상황근무')">상황근무 <span>상황 대응·기록</span></button></div>`;
    return;
  }
  if (!workState.time) {
    els.workCard.innerHTML = `<button class="back" onclick="backWork('type')">← 이전</button><p class="step-title">근무시간 선택</p><p class="step-sub">${workState.type} 업무의 근무시간을 골라주세요.</p><div class="choice-grid"><button class="choice" onclick="setWork('time','주간')">주간 <span>낮 근무</span></button><button class="choice" onclick="setWork('time','야간')">야간 <span>밤 근무</span></button></div>`;
    return;
  }
  if (workState.type === '안내' && !workState.direction) {
    els.workCard.innerHTML = `<button class="back" onclick="backWork('time')">← 이전</button><p class="step-title">방향 선택</p><p class="step-sub">안내할 방향을 골라주세요.</p><div class="choice-grid"><button class="choice" onclick="setWork('direction','상행')">상행 <span>익산·서울 방면</span></button><button class="choice" onclick="setWork('direction','하행')">하행 <span>순천·여수 방면</span></button></div>`;
    return;
  }
  renderChecklist();
}

function setWork(key, value) { workState[key] = value; renderWorkStep(); }
function backWork(key) {
  if (key === 'type') workState = { type: null, time: null, direction: null };
  if (key === 'time') { workState.time = null; workState.direction = null; }
  if (key === 'direction') workState.direction = null;
  renderWorkStep();
}
function resetWork() { workState = { type: null, time: null, direction: null }; renderWorkStep(); }

function renderChecklist() {
  const title = [workState.type, workState.time, workState.direction].filter(Boolean).join(' · ');
  const items = WORK_TASKS[workState.type]?.[workState.time] || [];
  const backTarget = workState.type === '안내' ? 'direction' : 'time';
  els.workCard.innerHTML = `<button class="back" onclick="backWork('${backTarget}')">← 이전</button><p class="step-title">체크리스트</p><div class="summary">${title}</div>${items.map((item, index) => `<label class="check-item"><input type="checkbox" id="ck${index}"><span>${item}</span></label>`).join('')}<p class="step-sub" style="margin-top:16px;">메모</p><textarea placeholder="특이사항을 적어주세요"></textarea><button style="width:100%;margin-top:12px;" onclick="resetWork()">처음부터 다시 선택</button>`;
}

document.querySelectorAll("input[name='team']").forEach(radio => {
  radio.checked = radio.value === selectedTeam;
  radio.addEventListener('change', event => {
    selectedTeam = event.target.value;
    localStorage.setItem('selectedTeam', selectedTeam);
    renderCalendar();
  });
});

renderCalendar();
