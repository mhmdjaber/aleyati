const urlParams = new URLSearchParams(window.location.search);
const machineId = urlParams.get('id');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRaLxrEoRutybNIsNFsogWoyfOIosG0YI1Cc03ptWn9NKE9RAkqjWUMzCMVjBTUBq7E_JsHrK5g1NIt/pub?output=csv';

const subtypesPage = document.getElementById('page-subtypes');
const datesPage = document.getElementById('page-dates');
const hoursPage = document.getElementById('page-hours');
const modal = document.getElementById('modal');

let machineData = null;
let currentMachine = null;
let currentSubtype = null;

async function fetchCSV(url) {
  const response = await fetch(url);
  const text = await response.text();
  const rows = text.split('\n').filter(row => row.trim() !== '');
  const headers = rows[0].split(',').map(h => h.trim());
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    data.push(obj);
  }
  return data;
}

function buildMachineData(rows) {
  const machines = {};
  rows.forEach(row => {
    const machineId = row.machine_id;
    if (!machines[machineId]) {
      machines[machineId] = {
        name: row.machine_name,
        img: row.main_image,
        counters: row.counters,
        hasSubtypes: row.has_subtypes === 'TRUE',
        subtypes: {},
        dates: []
      };
    }
    const machine = machines[machineId];
    if (machine.hasSubtypes) {
      const subtypeId = row.subtype_id;
      if (subtypeId && !machine.subtypes[subtypeId]) {
        machine.subtypes[subtypeId] = {
          id: subtypeId,
          name: row.subtype_name,
          img: row.subtype_image,
          counters: row.counters,
          dates: {}
        };
      }
      const subtype = machine.subtypes[subtypeId];
      if (subtype) {
        const dateLabel = row.date_label;
        if (dateLabel && !subtype.dates[dateLabel]) {
          subtype.dates[dateLabel] = {
            id: dateLabel,
            label: dateLabel,
            hours: []
          };
        }
        if (dateLabel && row.hour_label) {
          subtype.dates[dateLabel].hours.push({
            id: row.hour_label,
            label: row.hour_label,
            location: row.location,
            time: row.time
          });
        }
      }
    } else {
      const dateLabel = row.date_label;
      if (dateLabel) {
        let dateObj = machine.dates.find(d => d.label === dateLabel);
        if (!dateObj) {
          dateObj = { id: dateLabel, label: dateLabel, hours: [] };
          machine.dates.push(dateObj);
        }
        if (row.hour_label) {
          dateObj.hours.push({
            id: row.hour_label,
            label: row.hour_label,
            location: row.location,
            time: row.time
          });
        }
      }
    }
  });

  // Convert subtypes objects to arrays
  Object.values(machines).forEach(machine => {
    if (machine.hasSubtypes) {
      machine.subtypes = Object.values(machine.subtypes);
      machine.subtypes.forEach(sub => {
        sub.dates = Object.values(sub.dates);
      });
    }
  });

  // ----- SORTING: newest dates first, hours ascending -----
  Object.values(machines).forEach(machine => {
    // For machines without subtypes
    if (machine.dates && machine.dates.length) {
      machine.dates.sort((a, b) => new Date(b.label) - new Date(a.label));
      machine.dates.forEach(date => {
        date.hours.sort((a, b) => a.label.localeCompare(b.label));
      });
    }

    // For each subtype
    if (machine.subtypes && machine.subtypes.length) {
      machine.subtypes.forEach(sub => {
        if (sub.dates && sub.dates.length) {
          sub.dates.sort((a, b) => new Date(b.label) - new Date(a.label));
          sub.dates.forEach(date => {
            date.hours.sort((a, b) => a.label.localeCompare(b.label));
          });
        }
      });
    }
  });

  return machines;
}

fetchCSV(SHEET_URL)
  .then(rows => {
    machineData = buildMachineData(rows);
    loadMachine(machineId);
  })
  .catch(error => {
    console.error('Error loading sheet:', error);
    document.body.innerHTML = '<div style="padding:2rem;text-align:center;">Error loading data. Check the sheet URL and network.</div>';
  });

function showPage(page) {
  subtypesPage.classList.add('hidden');
  datesPage.classList.add('hidden');
  hoursPage.classList.add('hidden');
  page.classList.remove('hidden');
}

function populateDatesPage(machineObj, machineNumber, subtypeObj = null) {
  let counterValue = subtypeObj ? subtypeObj.counters : machineObj.counters;
  const bigNumberText = (counterValue && counterValue !== '0') ? `💥 ${counterValue} units` : machineNumber.padStart(2, '0');
  document.getElementById('datesBigNumber').textContent = bigNumberText;

  const displayName = subtypeObj ? subtypeObj.name : machineObj.name;
  document.getElementById('datesMachineName').textContent = `${displayName} – Engagement Dates`;
  const datesArray = subtypeObj ? subtypeObj.dates : machineObj.dates;
  const datesList = document.getElementById('datesList');
  datesList.innerHTML = '';

  datesArray.forEach(date => {
    const li = document.createElement('li');
    const block = document.createElement('div');
    block.className = 'rect-block ripple';
    block.textContent = date.label;
    block.addEventListener('click', () => {
      currentDate = date;
      document.getElementById('hoursBigNumber').textContent = bigNumberText;
      document.getElementById('hoursTitle').textContent = `${displayName} – ${date.label}`;
      const hoursList = document.getElementById('hoursList');
      hoursList.innerHTML = '';
      date.hours.forEach(hour => {
        const liHour = document.createElement('li');
        const hourBlock = document.createElement('div');
        hourBlock.className = 'rect-block ripple';
        hourBlock.textContent = hour.label;
        hourBlock.addEventListener('click', () => {
          const imgSrc = subtypeObj ? subtypeObj.img : machineObj.img;
          document.getElementById('modalImage').src = imgSrc;
          document.getElementById('modalTitle').textContent = `📍 ${hour.location}`;
          document.getElementById('modalDescription').textContent = `⏱️ Time: ${hour.time}`;
          modal.classList.add('active');
        });
        liHour.appendChild(hourBlock);
        hoursList.appendChild(liHour);
      });
      showPage(hoursPage);
    });
    li.appendChild(block);
    datesList.appendChild(li);
  });
}

function loadMachine(id) {
  currentMachine = machineData[id];
  if (!currentMachine) {
    window.location.href = 'index.html';
    return;
  }

  if (currentMachine.hasSubtypes) {
    const machineCounter = currentMachine.counters;
    document.getElementById('subtypesBigNumber').textContent = (machineCounter && machineCounter !== '0') ? `💥 ${machineCounter} units` : id.padStart(2, '0');
    document.getElementById('subtypesTitle').textContent = `Select ${currentMachine.name} Type`;
    const grid = document.getElementById('subtypesGrid');
    grid.innerHTML = '';
    currentMachine.subtypes.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'subtype-card ripple';
      card.innerHTML = `<img src="${sub.img}" alt="${sub.name}"><h3>${sub.name}</h3>`;
      card.addEventListener('click', () => {
        currentSubtype = sub;
        const backLink = document.getElementById('backFromDates');
        backLink.textContent = '← Back to types';
        backLink.onclick = () => showPage(subtypesPage);
        populateDatesPage(currentMachine, id, currentSubtype);
        showPage(datesPage);
      });
      grid.appendChild(card);
    });
    showPage(subtypesPage);
  } else {
    const backLink = document.getElementById('backFromDates');
    backLink.textContent = '← Back to Home';
    backLink.onclick = () => { window.location.href = 'index.html'; };
    populateDatesPage(currentMachine, id, null);
    showPage(datesPage);
  }
}

document.getElementById('backToHomeFromSubtypes').addEventListener('click', () => {
  window.location.href = 'index.html';
});
document.getElementById('backToDates').addEventListener('click', () => {
  showPage(datesPage);
});
document.getElementById('closeModal').addEventListener('click', () => {
  modal.classList.remove('active');
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('active');
});