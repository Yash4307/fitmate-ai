// ===== STATE =====
let lastFormData = null;
let currentPlan = null;
let speechRecognition = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateProgressUI();
});

// ============================================================
// FEATURE 5: THEME TOGGLE (DARK / LIGHT MODE)
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('fitmate_theme') || 'dark';
  applyTheme(saved);
  document.getElementById('themeToggle').checked = (saved === 'light');
}

function toggleTheme() {
  const isLight = document.getElementById('themeToggle').checked;
  const theme = isLight ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem('fitmate_theme', theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ============================================================
// NAVIGATION
// ============================================================
function scrollToForm() {
  document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// FEATURE 1 (part): LIVE BMI PREVIEW
// ============================================================
function updateLiveBMI() {
  const w = parseFloat(document.getElementById('weight').value);
  const h = parseFloat(document.getElementById('height').value);
  const goal = document.getElementById('goal').value;
  const card = document.getElementById('liveBmiCard');

  if (!w || !h || w < 30 || h < 100) { card.style.display = 'none'; return; }

  const bmi = w / Math.pow(h / 100, 2);
  card.style.display = 'block';

  document.getElementById('liveBmiValue').textContent = bmi.toFixed(1);
  renderBmiGauge('bmiGaugeFill', 'bmiGaugeMarker', bmi);

  let cat = '', calNote = '';
  if (bmi < 18.5) { cat = 'Underweight'; }
  else if (bmi < 25) { cat = 'Normal weight ✓'; }
  else if (bmi < 30) { cat = 'Overweight'; }
  else { cat = 'Obese'; }

  const age = parseInt(document.getElementById('age').value) || 25;
  const bmr = 10 * w + 6.25 * h - 5 * age + 5;
  const tdee = Math.round(bmr * 1.375);
  const target = goal === 'fat_loss' ? tdee - 400 : tdee + 300;
  const label = goal === 'fat_loss' ? 'deficit' : 'surplus';
  calNote = `Maintenance: ~${tdee} kcal/day  •  ${goal === 'fat_loss' ? 'Fat Loss' : 'Muscle Gain'} target: ~${target} kcal/day (${label})`;

  document.getElementById('liveBmiMeta').textContent = `Category: ${cat}  |  ${calNote}`;
}

function renderBmiGauge(fillId, markerId, bmi) {
  const pct = Math.min(Math.max(((bmi - 10) / 30) * 100, 2), 98);
  const fill = document.getElementById(fillId);
  const marker = document.getElementById(markerId);
  if (fill) fill.style.width = '100%';
  if (marker) marker.style.left = pct + '%';
}

// ============================================================
// GENERATE PLAN
// ============================================================
async function generatePlan(e) {
  if (e) e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');

  const data = {
    age: parseInt(document.getElementById('age').value),
    weight: parseFloat(document.getElementById('weight').value),
    height: parseFloat(document.getElementById('height').value),
    goal: document.getElementById('goal').value,
    experience: document.getElementById('experience').value,
  };

  if (!data.age || !data.weight || !data.height) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  lastFormData = data;
  showLoading();
  submitBtn.disabled = true;

  try {
    const res = await fetch('/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Server error');
    const plan = await res.json();
    if (!plan.success) throw new Error('Failed to generate plan');

    currentPlan = plan;
    sessionStorage.setItem('fitmate_plan', JSON.stringify(plan));
    sessionStorage.setItem('fitmate_last_input', JSON.stringify(data));

    // FEATURE 2: store in localStorage with date
    const todayKey = getTodayKey();
    const stored = JSON.parse(localStorage.getItem('fitmate_daily') || '{}');
    stored[todayKey] = plan;
    localStorage.setItem('fitmate_daily', JSON.stringify(stored));

    renderResults(plan);
    hideLoading();
    submitBtn.disabled = false;
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    hideLoading();
    submitBtn.disabled = false;
    showToast('Something went wrong. Try again.', 'error');
    console.error(err);
  }
}

// ============================================================
// REGENERATE
// ============================================================
async function regeneratePlan() {
  if (!lastFormData) { scrollToForm(); return; }
  showLoading();
  try {
    const res = await fetch('/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastFormData),
    });
    const plan = await res.json();
    currentPlan = plan;
    sessionStorage.setItem('fitmate_plan', JSON.stringify(plan));
    sessionStorage.setItem('fitmate_last_input', JSON.stringify(lastFormData));
    renderResults(plan);
    hideLoading();
    showToast('Plan regenerated!');
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
  } catch {
    hideLoading();
    showToast('Regeneration failed. Try again.', 'error');
  }
}

// ============================================================
// RENDER RESULTS
// ============================================================
function renderResults(plan) {
  const { user, workout_plan, diet_plan, total_diet_calories } = plan;

  renderUserStats(user);
  renderWorkout(workout_plan);
  renderDiet(diet_plan, total_diet_calories, user);
  renderProgressSection(workout_plan);

  const resultsSection = document.getElementById('results-section');
  resultsSection.classList.add('visible');

  document.getElementById('resultsDate').textContent = formatDate(new Date());
}

// ============================================================
// FEATURE 1: BMI + CALORIE STATS CARD
// ============================================================
function renderUserStats(user) {
  document.getElementById('resultsTitle').textContent = `${user.goal} Plan for You`;

  const bmiClassMap = {
    'Normal weight': 'bmi-normal',
    'Underweight': 'bmi-underweight',
    'Overweight': 'bmi-overweight',
    'Obese': 'bmi-obese',
  };
  const bmiClass = bmiClassMap[user.bmi_category] || 'bmi-normal';

  const stats = [
    { value: `${user.age}y`, label: 'Age' },
    { value: `${user.weight}kg`, label: 'Weight' },
    { value: `${user.height}cm`, label: 'Height' },
    { value: user.bmi, label: 'BMI', badge: `<span class="bmi-badge ${bmiClass}">${user.bmi_category}</span>` },
    { value: `${user.tdee}`, label: 'Maintenance Cal' },
    { value: `${user.target_calories}`, label: user.calorie_label },
    { value: user.experience, label: 'Level' },
    { value: user.goal, label: 'Goal' },
  ];

  document.getElementById('userStatsGrid').innerHTML = stats
    .map(s => `
      <div class="user-stat">
        <span class="user-stat-value">${s.value}</span>
        <span class="user-stat-label">${s.label}</span>
        ${s.badge || ''}
      </div>
    `).join('');

  // BMI result gauge
  const gaugeEl = document.getElementById('bmiResultGauge');
  gaugeEl.style.display = 'block';
  renderBmiGauge('resultBmiGaugeFill', 'resultBmiGaugeMarker', user.bmi);
  const catBadge = document.getElementById('bmiCategoryBadge');
  const catClassMap = {
    'Normal weight': 'bmi-cat-normal',
    'Underweight': 'bmi-cat-underweight',
    'Overweight': 'bmi-cat-overweight',
    'Obese': 'bmi-cat-obese',
  };
  catBadge.className = 'bmi-category-badge ' + (catClassMap[user.bmi_category] || 'bmi-cat-normal');
  catBadge.textContent = user.bmi_category;
}

// ============================================================
// FEATURE 2: DAILY PLAN + WORKOUT RENDER
// ============================================================
function renderWorkout(workoutPlan) {
  const grid = document.getElementById('workoutGrid');
  grid.innerHTML = '';

  const todayKey = getTodayKey();
  const completedDays = getCompletedDays(todayKey);

  Object.entries(workoutPlan).forEach(([day, exercises], index) => {
    const isDone = completedDays.includes(day);
    const card = document.createElement('div');
    card.className = `day-card ${index === 0 ? 'open' : ''}`;
    card.dataset.day = day;

    // FEATURE 3: beginner tips per exercise (inline tip strip)
    const exerciseItems = exercises.map(ex => {
      const tip = getExerciseTip(ex.exercise);
      return `
        <div class="exercise-item" data-name="${ex.exercise.toLowerCase()}">
          <div class="exercise-main">
            <div class="exercise-info">
              <div class="exercise-name">${ex.exercise}</div>
              <div class="exercise-instructions">${ex.instructions}</div>
            </div>
            <div class="exercise-right">
              <div class="exercise-sets">${ex.sets} × ${ex.reps}</div>
              ${ex.youtube ? `<a class="yt-link" href="${ex.youtube}" target="_blank" rel="noopener">▶ Watch Form</a>` : ''}
            </div>
          </div>
          ${tip ? `<div class="exercise-tip">${tip}</div>` : ''}
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="day-header" onclick="toggleDay(this)">
        <span class="day-title">${day}</span>
        <div class="day-header-right">
          <span class="day-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</span>
          <button class="day-complete-btn ${isDone ? 'completed' : ''}"
            onclick="markDayComplete(event, '${day.replace(/'/g, "\\'")}', this)">
            ${isDone ? '✓ Done' : 'Mark Done'}
          </button>
          <span class="day-chevron">▾</span>
        </div>
      </div>
      <div class="exercises-list">${exerciseItems}</div>
    `;

    grid.appendChild(card);
  });
}

// FEATURE 3: beginner tips map
function getExerciseTip(name) {
  const tips = {
    'Push-ups': 'Keep your core tight and body in a straight line — don\'t let your hips sag or rise.',
    'Wide Push-ups': 'Widen your grip only to a comfortable range. Stop if you feel wrist or shoulder strain.',
    'Bodyweight Squats': 'Push your knees out (don\'t let them cave inward) and keep heels flat on the floor.',
    'Squats': 'Initiate the movement by pushing your hips back, not just bending the knees.',
    'Plank': 'Don\'t hold your breath — breathe steadily. Squeeze glutes and abs for full engagement.',
    'Lunges': 'Step far enough forward so your back knee hovers just above the floor without touching.',
    'Dumbbell Shoulder Press': 'Press straight up, not forward. Keep your lower back neutral — don\'t arch.',
    'Tricep Dips (Chair)': 'Keep elbows pointing straight back, not out. Use a sturdy, non-sliding chair.',
    'Dumbbell Rows': 'Avoid rotating your torso. Pull with your elbow, not your hand.',
    'Dumbbell Bicep Curls': 'Keep your elbows pinned to your sides — they shouldn\'t drift forward.',
    'Hammer Curls': 'Move only at the elbow joint. No swinging or using momentum.',
    'Glute Bridges': 'Pause for 1-2 seconds at the top and squeeze hard before lowering slowly.',
    'Calf Raises': 'Perform the full range: lower your heel below the step level for a deep stretch.',
    'Burpees': 'Land softly on both feet. Prioritize controlled movement over speed.',
    'Mountain Climbers': 'Keep your hips level — they should not rock side to side.',
    'Jumping Jacks': 'Land with soft, bent knees. Keep a controlled pace to maintain form.',
    'Lateral Raises': 'Raise only to shoulder height. Going higher stresses the AC joint unnecessarily.',
    'Russian Twists': 'Rotate from your torso, not your arms. Keep your feet off the floor for more challenge.',
    'Side Plank': 'Stack your feet or stagger them. Keep your hips lifted — don\'t let them sink.',
    'Leg Raises': 'Press your lower back into the floor throughout. Lower legs slowly for max engagement.',
    'Dumbbell Chest Press': 'Lower the dumbbells until elbows are at 90°. Don\'t let them bounce off your chest.',
    'Dumbbell Goblet Squat': 'Hold the dumbbell at chest height with both hands. This will keep your torso upright.',
    'Superman Hold': 'Lift simultaneously and hold — don\'t jerk. Breathe out as you lift up.',
    'High Knees': 'Drive your arms to stay in sync with your legs. Land on your mid-foot, not heels.',
    'Bicycle Crunches': 'Move slowly and deliberately — don\'t just pull your head. The rotation comes from the abs.',
    'Jump Squats': 'Land with your knees slightly bent to absorb impact. Never land stiff-legged.',
  };
  return tips[name] || null;
}

// ============================================================
// TOGGLE DAY CARD
// ============================================================
function toggleDay(header) {
  const card = header.closest('.day-card');
  card.classList.toggle('open');
}

// ============================================================
// FEATURE 4: PROGRESS TRACKER
// ============================================================
function renderProgressSection(workoutPlan) {
  const section = document.getElementById('progressSection');
  section.style.display = 'block';

  const todayKey = getTodayKey();
  const completedDays = getCompletedDays(todayKey);
  const totalDays = Object.keys(workoutPlan).length;

  updateProgressUI(completedDays, totalDays, Object.keys(workoutPlan));
}

function updateProgressUI(completedDays, totalDays, dayNames) {
  completedDays = completedDays || getCompletedDays(getTodayKey());
  totalDays = totalDays || 7;
  dayNames = dayNames || [];

  const pct = totalDays > 0 ? Math.round((completedDays.length / totalDays) * 100) : 0;
  const fill = document.getElementById('progressBarFill');
  const pctEl = document.getElementById('progressBarPct');
  const completedCountEl = document.getElementById('completedCount');
  const totalDaysEl = document.getElementById('totalDaysCount');
  if (fill) fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (completedCountEl) completedCountEl.textContent = completedDays.length;
  if (totalDaysEl) totalDaysEl.textContent = totalDays;

  // Streak
  const streak = calculateStreak();
  const streakEl = document.getElementById('streakCount');
  if (streakEl) streakEl.textContent = streak;

  // Day circles
  const daysGrid = document.getElementById('progressDaysGrid');
  if (daysGrid && dayNames.length > 0) {
    daysGrid.innerHTML = dayNames.map((day, i) => {
      const isDone = completedDays.includes(day);
      const shortLabel = day.replace(/Day \d+\s*/, '').replace(/[()]/g, '').trim().split(' ').slice(0, 2).join(' ');
      return `
        <div class="progress-day">
          <div class="progress-day-circle ${isDone ? 'done' : ''}"
            onclick="toggleProgressDay('${day.replace(/'/g, "\\'")}')"
            title="${day}">
            ${isDone ? '✓' : i + 1}
          </div>
          <div class="progress-day-label">${shortLabel || 'D' + (i+1)}</div>
        </div>
      `;
    }).join('');
  }
}

function markDayComplete(e, day, btn) {
  e.stopPropagation();
  const todayKey = getTodayKey();
  let completedDays = getCompletedDays(todayKey);
  const isDone = completedDays.includes(day);

  if (isDone) {
    completedDays = completedDays.filter(d => d !== day);
    btn.textContent = 'Mark Done';
    btn.classList.remove('completed');
    showToast('Unmarked: ' + day.split(' ').slice(0, 2).join(' '));
  } else {
    completedDays.push(day);
    btn.textContent = '✓ Done';
    btn.classList.add('completed');
    showToast('Great job! ' + day.split(' ').slice(0, 2).join(' ') + ' complete 💪');
  }

  saveCompletedDays(todayKey, completedDays);

  // Update progress UI
  if (currentPlan) {
    updateProgressUI(completedDays, Object.keys(currentPlan.workout_plan).length, Object.keys(currentPlan.workout_plan));
  }
}

function toggleProgressDay(day) {
  if (!currentPlan) return;
  const todayKey = getTodayKey();
  let completedDays = getCompletedDays(todayKey);
  if (completedDays.includes(day)) {
    completedDays = completedDays.filter(d => d !== day);
  } else {
    completedDays.push(day);
    showToast('Marked complete: ' + day.split(' ').slice(0, 2).join(' ') + ' 💪');
  }
  saveCompletedDays(todayKey, completedDays);

  // sync workout card buttons
  document.querySelectorAll('.day-card').forEach(card => {
    if (card.dataset.day === day) {
      const btn = card.querySelector('.day-complete-btn');
      if (btn) {
        const done = completedDays.includes(day);
        btn.textContent = done ? '✓ Done' : 'Mark Done';
        btn.classList.toggle('completed', done);
      }
    }
  });

  updateProgressUI(completedDays, Object.keys(currentPlan.workout_plan).length, Object.keys(currentPlan.workout_plan));
}

function getCompletedDays(dateKey) {
  const all = JSON.parse(localStorage.getItem('fitmate_progress') || '{}');
  return all[dateKey] || [];
}

function saveCompletedDays(dateKey, days) {
  const all = JSON.parse(localStorage.getItem('fitmate_progress') || '{}');
  all[dateKey] = days;
  localStorage.setItem('fitmate_progress', JSON.stringify(all));
}

function calculateStreak() {
  const all = JSON.parse(localStorage.getItem('fitmate_progress') || '{}');
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (all[key] && all[key].length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// ============================================================
// FEATURE 2: GENERATE TODAY'S PLAN
// ============================================================
function generateTodayPlan() {
  if (!currentPlan) { scrollToForm(); showToast('Generate a plan first!', 'error'); return; }

  const todayKey = getTodayKey();
  const stored = JSON.parse(localStorage.getItem('fitmate_daily') || '{}');
  stored[todayKey] = currentPlan;
  localStorage.setItem('fitmate_daily', JSON.stringify(stored));

  const days = Object.keys(currentPlan.workout_plan);
  const dayIndex = new Date().getDay(); // 0=Sun..6=Sat
  const suggestedDay = days[dayIndex % days.length];

  const banner = document.getElementById('todayPlanBanner');
  banner.style.display = 'flex';
  document.getElementById('todayPlanDate').textContent = formatDate(new Date());
  document.getElementById('todayPlanBanner').querySelector('.today-plan-label').textContent =
    `Today's Workout: ${suggestedDay}`;

  // Open that day's card
  document.querySelectorAll('.day-card').forEach(card => {
    const title = card.querySelector('.day-title');
    if (title && title.textContent === suggestedDay) {
      card.classList.add('open');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  showToast(`Today's plan: ${suggestedDay.split(' ').slice(0, 2).join(' ')}`);
}

function closeTodayPlan() {
  document.getElementById('todayPlanBanner').style.display = 'none';
}

// ============================================================
// DIET PLAN
// ============================================================
function renderDiet(dietPlan, totalCalories, user) {
  const grid = document.getElementById('dietGrid');
  grid.innerHTML = '';

  const mealIcons = {
    'Breakfast': '🌅',
    'Mid-Morning Snack': '🍎',
    'Lunch': '☀️',
    'Evening Snack': '🥜',
    'Evening Snack (Pre-Workout)': '⚡',
    'Dinner': '🌙',
  };

  const MEAL_ORDER = ['Breakfast', 'Mid-Morning Snack', 'Lunch', 'Evening Snack', 'Evening Snack (Pre-Workout)', 'Dinner'];
  const sortedMeals = Object.entries(dietPlan).sort(([a], [b]) => {
    const ai = MEAL_ORDER.indexOf(a);
    const bi = MEAL_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  sortedMeals.forEach(([meal, info]) => {
    const icon = mealIcons[meal] || '🍽️';
    const card = document.createElement('div');
    card.className = 'meal-card';
    card.innerHTML = `
      <div class="meal-header">
        <div class="meal-name">${icon} ${meal}</div>
        <div class="meal-calories">${info.calories} kcal</div>
      </div>
      <ul class="meal-items">${info.items.map(item => `<li>${item}</li>`).join('')}</ul>
      <div class="meal-tip">${info.tips}</div>
    `;
    grid.appendChild(card);
  });

  const diff = totalCalories - user.target_calories;
  const diffText = diff > 0 ? `+${diff} over target` : `${Math.abs(diff)} under target`;
  document.getElementById('calorieSummary').innerHTML = `
    <div class="calorie-info">
      <h4>Total Daily Calories</h4>
      <p>Target: ${user.target_calories} kcal (${user.calorie_label}) &nbsp;•&nbsp; ${diffText}</p>
    </div>
    <div>
      <div class="calorie-number">${totalCalories}</div>
      <span class="calorie-unit">kcal / day</span>
    </div>
  `;
}

// ============================================================
// FEATURE 6: SHARE PLAN
// ============================================================
let pendingShareText = '';

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      if (!document.execCommand('copy')) throw new Error('Copy command failed');
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

function ensureShareModal() {
  let modal = document.getElementById('sharePlanModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'sharePlanModal';
  modal.className = 'share-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'sharePlanModalTitle');
  modal.innerHTML = `
    <div class="share-modal-backdrop" onclick="closeShareModal()"></div>
    <div class="share-modal-card">
      <button class="share-modal-close" type="button" onclick="closeShareModal()" aria-label="Close share options">✕</button>
      <div class="share-modal-icon">↗</div>
      <h3 id="sharePlanModalTitle">Share your FitMate plan</h3>
      <p>Choose how you would like to share your workout and diet plan.</p>
      <div class="share-modal-actions">
        <button type="button" onclick="copySharedPlan()"><span>📋</span> Copy to Clipboard</button>
        <button type="button" onclick="shareViaWhatsApp()"><span>💬</span> Share via WhatsApp</button>
        <button type="button" onclick="shareViaEmail()"><span>✉️</span> Share via Email</button>
        <button type="button" onclick="openOrCopyShareLink()"><span>🔗</span> Open / Copy Link</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  return modal;
}

function openShareModal(text) {
  pendingShareText = text;
  const modal = ensureShareModal();
  modal.classList.add('is-open');
  modal.querySelector('.share-modal-close')?.focus();
}

window.closeShareModal = function() {
  const modal = document.getElementById('sharePlanModal');
  if (modal) modal.classList.remove('is-open');
};

window.copySharedPlan = function() {
  copyTextToClipboard(pendingShareText)
    .then(() => {
      closeShareModal();
      showToast('Plan copied to clipboard! 📋');
    })
    .catch(() => showToast('Could not copy the plan. Please try again.', 'error'));
};

window.shareViaWhatsApp = function() {
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${pendingShareText}\n\n${window.location.href}`)}`;
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
};

window.shareViaEmail = function() {
  const subject = encodeURIComponent('My FitMate AI Workout & Diet Plan');
  const body = encodeURIComponent(`${pendingShareText}\n\n${window.location.href}`);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

window.openOrCopyShareLink = function() {
  const url = window.location.href;
  copyTextToClipboard(url).catch(() => {});
  window.open(url, '_blank', 'noopener,noreferrer');
  closeShareModal();
  showToast('Plan link copied and opened! 🔗');
};

async function sharePlan() {
  if (!currentPlan) { showToast('Generate a plan first!', 'error'); return; }
  const { user, workout_plan, diet_plan, total_diet_calories } = currentPlan;

  let text = `🏋️ FITMATE AI – ${user.goal.toUpperCase()} PLAN\n`;
  text += `${'='.repeat(44)}\n`;
  text += `📊 YOUR STATS\n`;
  text += `Age: ${user.age}y  |  Weight: ${user.weight}kg  |  Height: ${user.height}cm\n`;
  text += `BMI: ${user.bmi} (${user.bmi_category})  |  Goal: ${user.goal}\n`;
  text += `Calorie Target: ${user.target_calories} kcal (${user.calorie_label})\n\n`;

  text += `🏋️ 7-DAY WORKOUT PLAN\n${'─'.repeat(30)}\n`;
  Object.entries(workout_plan).forEach(([day, exercises]) => {
    text += `\n${day.toUpperCase()}\n`;
    exercises.forEach(ex => {
      text += `  • ${ex.exercise} — ${ex.sets} sets × ${ex.reps}\n`;
    });
  });

  text += `\n🥗 DAILY DIET PLAN\n${'─'.repeat(30)}\n`;
  Object.entries(diet_plan).forEach(([meal, info]) => {
    text += `\n${meal.toUpperCase()} (${info.calories} kcal)\n`;
    info.items.forEach(item => { text += `  • ${item}\n`; });
    text += `  Tip: ${info.tips}\n`;
  });

  text += `\nTotal Daily Calories: ${total_diet_calories} kcal\n`;
  text += `\nGenerated by FitMate AI 💪\n`;

  pendingShareText = text;
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'My FitMate AI Workout & Diet Plan',
        text,
        url: window.location.href,
      });
      return;
    } catch (error) {
      // A user closing the native sheet is not a sharing failure.
      if (error && error.name === 'AbortError') return;
    }
  }

  openShareModal(text);
}

// ============================================================
// FEATURE 7: EXERCISE SEARCH / FILTER
// ============================================================
function filterExercises(query) {
  const q = query.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClear');
  const countEl = document.getElementById('searchCount');

  clearBtn.style.display = q ? 'block' : 'none';

  if (!q) {
    document.querySelectorAll('.day-card').forEach(card => card.classList.remove('hidden'));
    document.querySelectorAll('.exercise-item').forEach(item => item.classList.remove('hidden'));
    countEl.style.display = 'none';
    return;
  }

  let totalMatches = 0;
  document.querySelectorAll('.day-card').forEach(card => {
    const items = card.querySelectorAll('.exercise-item');
    let matchCount = 0;
    items.forEach(item => {
      const name = item.dataset.name || '';
      if (name.includes(q)) {
        item.classList.remove('hidden');
        matchCount++;
      } else {
        item.classList.add('hidden');
      }
    });

    if (matchCount > 0) {
      card.classList.remove('hidden');
      card.classList.add('open');
      totalMatches += matchCount;
    } else {
      card.classList.add('hidden');
    }
  });

  countEl.style.display = 'block';
  countEl.textContent = totalMatches === 0
    ? 'No exercises found'
    : `${totalMatches} exercise${totalMatches !== 1 ? 's' : ''} found`;
}

function clearSearch() {
  const input = document.getElementById('exerciseSearch');
  input.value = '';
  filterExercises('');
  input.focus();
}

// ============================================================
// FEATURE 8: VOICE COMMAND
// ============================================================
function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Voice not supported in this browser. Try Chrome.', 'error');
    return;
  }

  if (speechRecognition) { speechRecognition.stop(); return; }

  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  document.getElementById('voicePanel').classList.add('active');
  document.getElementById('voiceBtn').classList.add('listening');
  document.getElementById('voiceTranscript').textContent = 'Listening…';
  document.getElementById('voiceStatus').textContent = 'Listening…';

  speechRecognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript)
      .join(' ')
      .toLowerCase()
      .trim();
    document.getElementById('voiceTranscript').textContent = '"' + transcript + '"';
    if (e.results[0].isFinal) {
      handleVoiceCommand(transcript);
    }
  };

  speechRecognition.onerror = (e) => {
    document.getElementById('voiceTranscript').textContent = 'Error: ' + e.error;
    stopVoice();
  };

  speechRecognition.onend = () => { stopVoice(); };

  speechRecognition.start();
}

function stopVoice() {
  if (speechRecognition) {
    speechRecognition.stop();
    speechRecognition = null;
  }
  document.getElementById('voicePanel').classList.remove('active');
  document.getElementById('voiceBtn').classList.remove('listening');
}

function handleVoiceCommand(cmd) {
  document.getElementById('voiceStatus').textContent = 'Processing…';
  setTimeout(() => {
    if (cmd.includes('generate') || cmd.includes('create plan') || cmd.includes('get plan') || cmd.includes('new plan')) {
      showToast('Voice: Generating plan…');
      stopVoice();
      if (lastFormData) {
        regeneratePlan();
      } else {
        scrollToForm();
      }
    } else if (cmd.includes('show diet') || cmd.includes('diet plan') || cmd.includes('food')) {
      stopVoice();
      const dietEl = document.getElementById('dietSectionTitle');
      if (dietEl) { dietEl.scrollIntoView({ behavior: 'smooth' }); showToast('Showing diet plan'); }
    } else if (cmd.includes('show workout') || cmd.includes('workout plan') || cmd.includes('exercise')) {
      stopVoice();
      const workoutEl = document.getElementById('workoutGrid');
      if (workoutEl) { workoutEl.scrollIntoView({ behavior: 'smooth' }); showToast('Showing workout plan'); }
    } else if (cmd.includes('dark mode') || cmd.includes('dark theme')) {
      stopVoice();
      applyTheme('dark');
      document.getElementById('themeToggle').checked = false;
      localStorage.setItem('fitmate_theme', 'dark');
      showToast('Dark mode activated');
    } else if (cmd.includes('light mode') || cmd.includes('light theme')) {
      stopVoice();
      applyTheme('light');
      document.getElementById('themeToggle').checked = true;
      localStorage.setItem('fitmate_theme', 'light');
      showToast('Light mode activated');
    } else if (cmd.includes('share') || cmd.includes('copy')) {
      stopVoice();
      sharePlan();
    } else if (cmd.includes('scroll up') || cmd.includes('go up') || cmd.includes('top')) {
      stopVoice();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Scrolled to top');
    } else if (cmd.includes('today') || cmd.includes('today\'s plan')) {
      stopVoice();
      generateTodayPlan();
    } else {
      stopVoice();
      showToast('Command not recognized. Try "generate plan" or "show diet"', 'error');
    }
  }, 400);
}

// ============================================================
// LOADING
// ============================================================
function showLoading() { document.getElementById('loadingOverlay').classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('active'); }

// ============================================================
// TOAST NOTIFICATION
// ============================================================
let toastTimer = null;
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  if (type === 'error') {
    toast.style.background = '#ff4d4d';
    toast.style.color = '#fff';
  } else {
    toast.style.background = '';
    toast.style.color = '';
  }
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================================
// UTILS
// ============================================================
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================
// ============================================================
//   EXERCISE LIBRARY – DATA + LOGIC
// ============================================================
// ============================================================

// ---- Muscle accent colours (CSS custom property) ----
const MUSCLE_COLORS = {
  chest:     '#ff6b6b',
  legs:      '#ffd93d',
  back:      '#6bcfff',
  shoulders: '#a29bfe',
  arms:      '#fd79a8',
  core:      '#55efc4',
};

const EQUIPMENT_ICONS = {
  none:      '🤸',
  dumbbells: '🏋️',
  machine:   '🔩',
  barbell:   '🪝',
};

// ---- Exercise Database ----
const EXERCISE_DB = [
  // ── CHEST ──────────────────────────────────────────────────
  {
    id: 'pushups', name: 'Push-ups',
    muscle: 'chest', difficulty: 'beginner', equipment: 'none',
    instructions: 'Start in a high plank with hands shoulder-width apart. Lower your chest to just above the floor, keeping elbows at 45°. Push back up forcefully. Keep your core braced throughout and don\'t let your hips sag.',
    youtube: 'IODxDxX7oi4',
    subs: ['dumbbell_chest_press', 'incline_dumbbell_press', 'chest_fly'],
  },
  {
    id: 'bench_press', name: 'Bench Press',
    muscle: 'chest', difficulty: 'intermediate', equipment: 'barbell',
    instructions: 'Lie on a bench, grip the barbell just outside shoulder-width. Unrack, lower to mid-chest with elbows at ~75°, then press back up. Keep your feet flat, back slightly arched, and shoulder blades retracted.',
    youtube: 'gRVjAtPip0Y',
    subs: ['pushups', 'dumbbell_chest_press', 'chest_fly'],
  },
  {
    id: 'dumbbell_chest_press', name: 'Dumbbell Chest Press',
    muscle: 'chest', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Lie on a bench holding dumbbells at chest level, palms forward. Press up until arms are almost straight, then lower with control until elbows are just below bench level. Don\'t let the dumbbells touch at the top.',
    youtube: 'VmB1G1K7v94',
    subs: ['pushups', 'bench_press', 'chest_fly'],
  },
  {
    id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press',
    muscle: 'chest', difficulty: 'intermediate', equipment: 'dumbbells',
    instructions: 'Set bench to 30–45°. Press dumbbells from upper-chest height upward. Targets the upper chest. Keep shoulder blades retracted and don\'t flare elbows excessively.',
    youtube: '8iPEnn-ltC8',
    subs: ['pushups', 'dumbbell_chest_press'],
  },
  {
    id: 'chest_fly', name: 'Chest Fly',
    muscle: 'chest', difficulty: 'intermediate', equipment: 'dumbbells',
    instructions: 'Lie on a bench, arms extended over chest with a slight bend. Open your arms in a wide arc until you feel a stretch, then squeeze your chest to bring them back together. Think "hugging a tree".',
    youtube: 'eozdVDA78K0',
    subs: ['pushups', 'dumbbell_chest_press'],
  },

  // ── LEGS ───────────────────────────────────────────────────
  {
    id: 'squats', name: 'Squats',
    muscle: 'legs', difficulty: 'beginner', equipment: 'none',
    instructions: 'Stand feet shoulder-width apart, toes slightly out. Push your hips back and bend knees to lower until thighs are parallel. Drive through your heels to stand. Keep chest up and knees tracking over toes.',
    youtube: 'aclHkVaku9U',
    subs: ['leg_press', 'lunges', 'goblet_squat'],
  },
  {
    id: 'leg_press', name: 'Leg Press',
    muscle: 'legs', difficulty: 'beginner', equipment: 'machine',
    instructions: 'Sit in the leg press machine, feet shoulder-width on the platform. Lower the sled until knees reach 90°, then push through your heels to full extension — but don\'t lock out your knees. Keep lower back pressed into the seat.',
    youtube: 'IZxyjW7MPJQ',
    subs: ['squats', 'goblet_squat', 'lunges'],
  },
  {
    id: 'lunges', name: 'Lunges',
    muscle: 'legs', difficulty: 'beginner', equipment: 'none',
    instructions: 'Step forward with one foot, lower until back knee hovers 1–2 cm from floor. Push through front heel to return. Keep torso upright and front knee behind the toes. Alternate legs each rep.',
    youtube: 'QOVaHwm-Q6U',
    subs: ['squats', 'leg_press', 'goblet_squat'],
  },
  {
    id: 'romanian_deadlift', name: 'Romanian Deadlift',
    muscle: 'legs', difficulty: 'intermediate', equipment: 'dumbbells',
    instructions: 'Hold dumbbells in front of thighs, soft bend in knees. Hinge at hips, pushing them back while lowering the weight along your legs. Stop when you feel a deep hamstring stretch (mid-shin). Drive hips forward to return.',
    youtube: 'JCXUYuzwNrM',
    subs: ['squats', 'glute_bridge', 'lunges'],
  },
  {
    id: 'goblet_squat', name: 'Goblet Squat',
    muscle: 'legs', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Hold a dumbbell at chest height with both hands. Squat deep, keeping chest up and elbows between your knees at the bottom. The weight counterbalances you, making it easier to stay upright.',
    youtube: 'MxsFDhcyFyE',
    subs: ['squats', 'leg_press', 'lunges'],
  },
  {
    id: 'glute_bridge', name: 'Glute Bridge',
    muscle: 'legs', difficulty: 'beginner', equipment: 'none',
    instructions: 'Lie on your back, knees bent, feet flat. Drive through heels to push hips to the ceiling, squeezing glutes hard at the top. Hold 2 seconds, then lower slowly. Don\'t hyperextend your lower back.',
    youtube: 'wPM8icPu6H8',
    subs: ['romanian_deadlift', 'lunges'],
  },

  // ── BACK ───────────────────────────────────────────────────
  {
    id: 'pullups', name: 'Pull-ups',
    muscle: 'back', difficulty: 'advanced', equipment: 'none',
    instructions: 'Grip a bar slightly wider than shoulder-width, palms facing away. Hang fully, then pull your chest to the bar by driving your elbows down and back. Avoid swinging. Lower with control to a full hang.',
    youtube: 'eGo4IYlbE5g',
    subs: ['lat_pulldown', 'dumbbell_rows', 'resistance_band_rows'],
  },
  {
    id: 'lat_pulldown', name: 'Lat Pulldown',
    muscle: 'back', difficulty: 'beginner', equipment: 'machine',
    instructions: 'Sit at the machine, grip the bar wide. Pull the bar to your upper chest, leading with your elbows. Lean back slightly, retract shoulder blades at the bottom. Return with full control — don\'t let the weight jerk up.',
    youtube: 'CAwf7n6Luuc',
    subs: ['pullups', 'dumbbell_rows', 'resistance_band_rows'],
  },
  {
    id: 'dumbbell_rows', name: 'Dumbbell Rows',
    muscle: 'back', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Place one hand and knee on a bench. Pull the dumbbell to your hip, keeping your elbow close to your body. Squeeze your shoulder blade at the top. Avoid rotating your torso — the movement should be pure elbow-driven.',
    youtube: 'roCP6wCXPqo',
    subs: ['lat_pulldown', 'pullups', 'seated_row'],
  },
  {
    id: 'seated_row', name: 'Seated Row',
    muscle: 'back', difficulty: 'beginner', equipment: 'machine',
    instructions: 'Sit at a cable row machine, feet on the platform. Pull the handle to your lower sternum, driving elbows back past your torso. Keep chest tall and avoid rounding. Slowly extend arms back to start.',
    youtube: 'GZbfZ033f74',
    subs: ['dumbbell_rows', 'lat_pulldown', 'pullups'],
  },
  {
    id: 'deadlift', name: 'Deadlift',
    muscle: 'back', difficulty: 'advanced', equipment: 'barbell',
    instructions: 'Stand with feet hip-width, bar over mid-foot. Hinge to grip the bar, chest up, hips above knees. Push the floor away as you stand up, keeping the bar close to your body. Hinge hips back to lower — never round your spine.',
    youtube: 'op9kVnSso6Q',
    subs: ['dumbbell_rows', 'romanian_deadlift', 'seated_row'],
  },
  {
    id: 'resistance_band_rows', name: 'Resistance Band Rows',
    muscle: 'back', difficulty: 'beginner', equipment: 'none',
    instructions: 'Anchor a band at chest height. Hold both ends, step back until there\'s tension. Pull handles to your lower chest, squeezing shoulder blades together. Great assisted alternative to cable rows.',
    youtube: 'xQNrFHEMhI4',
    subs: ['seated_row', 'dumbbell_rows', 'lat_pulldown'],
  },

  // ── SHOULDERS ──────────────────────────────────────────────
  {
    id: 'shoulder_press', name: 'Shoulder Press',
    muscle: 'shoulders', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Sit or stand, dumbbells at shoulder height with palms forward. Press straight up until arms are nearly extended. Don\'t arch your lower back — brace your core. Lower with control to ear level.',
    youtube: 'qEwKCR5JCog',
    subs: ['lateral_raises', 'front_raises'],
  },
  {
    id: 'lateral_raises', name: 'Lateral Raises',
    muscle: 'shoulders', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Hold dumbbells at sides with a very slight elbow bend. Raise arms out to shoulder height, leading with your elbows, not your wrists. Pause at the top, then lower slowly. Keep torso still — no swinging.',
    youtube: '3VcKaXpzqRo',
    subs: ['shoulder_press', 'front_raises'],
  },
  {
    id: 'front_raises', name: 'Front Raises',
    muscle: 'shoulders', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Hold dumbbells in front of your thighs, palms facing down. Raise arms forward to shoulder height, keeping a slight bend in the elbow. Lower slowly. Avoid using momentum — keep your torso stable.',
    youtube: 'gkRrcfAyWTs',
    subs: ['shoulder_press', 'lateral_raises'],
  },

  // ── ARMS ───────────────────────────────────────────────────
  {
    id: 'bicep_curls', name: 'Bicep Curls',
    muscle: 'arms', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Stand with dumbbells at sides, palms forward. Curl both up to shoulder height while keeping elbows pinned to your torso. Squeeze at the top, then lower slowly to full extension.',
    youtube: 'ykJmrZ5v0Oo',
    subs: ['hammer_curls', 'barbell_curl'],
  },
  {
    id: 'tricep_dips', name: 'Tricep Dips',
    muscle: 'arms', difficulty: 'beginner', equipment: 'none',
    instructions: 'Grip the edge of a sturdy chair or parallel bars. Lower yourself until elbows are at 90°, then push back up. Keep elbows pointing straight back, not flaring out. Lean slightly forward to target triceps more.',
    youtube: '6kALZikXxLc',
    subs: ['tricep_pushdown', 'pushups', 'overhead_tricep_ext'],
  },
  {
    id: 'hammer_curls', name: 'Hammer Curls',
    muscle: 'arms', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Hold dumbbells with a neutral grip (palms facing each other). Curl to shoulder height without rotating your wrists. This targets both the biceps and brachialis. Keep elbows fixed at your sides.',
    youtube: 'zC3nLlEvin4',
    subs: ['bicep_curls', 'barbell_curl'],
  },
  {
    id: 'tricep_pushdown', name: 'Tricep Pushdown',
    muscle: 'arms', difficulty: 'beginner', equipment: 'machine',
    instructions: 'Stand at a cable machine, grip a bar or rope attachment at chest height. Keep elbows locked at your sides and push the attachment down to full extension. Squeeze triceps at the bottom. Return with control.',
    youtube: '2-LAMcpzODU',
    subs: ['tricep_dips', 'overhead_tricep_ext'],
  },
  {
    id: 'barbell_curl', name: 'Barbell Curl',
    muscle: 'arms', difficulty: 'intermediate', equipment: 'barbell',
    instructions: 'Hold a barbell with an underhand grip, shoulder-width. Curl to shoulder height, keeping elbows pinned to your torso. Lower with a 2–3 second count. Avoid leaning back or using momentum.',
    youtube: 'kwG2ipFRgfo',
    subs: ['bicep_curls', 'hammer_curls'],
  },
  {
    id: 'overhead_tricep_ext', name: 'Overhead Tricep Extension',
    muscle: 'arms', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Hold one dumbbell with both hands overhead, arms extended. Bend elbows to lower the dumbbell behind your head. Keep upper arms vertical and elbows pointing forward. Extend back to start.',
    youtube: '_gsUck-7M74',
    subs: ['tricep_dips', 'tricep_pushdown'],
  },

  // ── CORE ───────────────────────────────────────────────────
  {
    id: 'plank', name: 'Plank',
    muscle: 'core', difficulty: 'beginner', equipment: 'none',
    instructions: 'Hold a push-up position on forearms or hands. Keep your body in a straight line — don\'t let hips sag or rise. Brace your core as if bracing for a punch. Breathe steadily throughout.',
    youtube: 'ASdvN_XEl_c',
    subs: ['dead_bug', 'hollow_hold', 'mountain_climbers'],
  },
  {
    id: 'crunches', name: 'Crunches',
    muscle: 'core', difficulty: 'beginner', equipment: 'none',
    instructions: 'Lie on your back, knees bent. Place hands behind your head (don\'t pull your neck). Use your abs to curl your shoulders off the floor, exhaling at the top. Lower with control. The movement is small — it\'s not a sit-up.',
    youtube: 'Xyd_fa5zoEU',
    subs: ['bicycle_crunches', 'leg_raises', 'dead_bug'],
  },
  {
    id: 'leg_raises', name: 'Leg Raises',
    muscle: 'core', difficulty: 'intermediate', equipment: 'none',
    instructions: 'Lie flat on your back, hands under your hips. Keeping legs straight and together, raise them to 90°. Lower slowly without letting them touch the floor. Press your lower back into the floor throughout the movement.',
    youtube: 'JB2oyawG9KI',
    subs: ['crunches', 'plank', 'bicycle_crunches'],
  },
  {
    id: 'bicycle_crunches', name: 'Bicycle Crunches',
    muscle: 'core', difficulty: 'intermediate', equipment: 'none',
    instructions: 'Lie on your back, hands behind head. Bring one knee to chest while rotating opposite elbow toward it. Alternate in a slow, deliberate cycling motion. Don\'t rush — the rotation should come from your waist, not your elbows.',
    youtube: '1we3bh9uhqY',
    subs: ['crunches', 'leg_raises', 'plank'],
  },
  {
    id: 'mountain_climbers', name: 'Mountain Climbers',
    muscle: 'core', difficulty: 'intermediate', equipment: 'none',
    instructions: 'Start in a high plank. Drive one knee toward your chest, then quickly switch legs in a running motion. Keep hips level — don\'t let them rock. Move fast for cardio or slow for core control.',
    youtube: 'nmwgirgXLYM',
    subs: ['plank', 'leg_raises', 'bicycle_crunches'],
  },
  {
    id: 'dead_bug', name: 'Dead Bug',
    muscle: 'core', difficulty: 'beginner', equipment: 'none',
    instructions: 'Lie on your back, arms pointing to ceiling, knees bent at 90° above hips. Slowly lower one arm and the opposite leg toward the floor simultaneously, keeping lower back pressed down. Return and repeat on the other side.',
    youtube: '4XLEnwUr1d8',
    subs: ['plank', 'crunches', 'hollow_hold'],
  },
  {
    id: 'hollow_hold', name: 'Hollow Hold',
    muscle: 'core', difficulty: 'intermediate', equipment: 'none',
    instructions: 'Lie on your back, extend arms overhead and legs straight. Lift shoulders and legs off the floor, creating a "hollow" curve in your body. Lower back must stay pressed into the floor. Hold for 20–30 seconds.',
    youtube: 'LlDNef_Ztsc',
    subs: ['plank', 'leg_raises', 'dead_bug'],
  },
];

// ---- Build lookup map for substitution resolution ----
const EXERCISE_MAP = {};
EXERCISE_DB.forEach(ex => { EXERCISE_MAP[ex.id] = ex; });

// ---- Library state ----
let libActiveMuscle = 'all';
let libActiveExercise = null;
let libVoiceInterval = null;
let libVoiceSteps = [];
let libVoiceStep = 0;

// ============================================================
// OPEN / CLOSE LIBRARY
// ============================================================
function openLibrary() {
  document.getElementById('libOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderLibGrid();
}

function closeLibrary() {
  document.getElementById('libOverlay').classList.remove('open');
  document.body.style.overflow = '';
  stopLibVoiceCoach();
}

// Close on backdrop click
document.getElementById('libOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeLibrary();
});

// ============================================================
// FILTER STATE
// ============================================================
function setLibMuscle(muscle, btn) {
  libActiveMuscle = muscle;
  document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  applyLibFilters();
}

function applyLibFilters() {
  const equipVal = document.getElementById('libEquipFilter').value;
  const diffVal  = document.getElementById('libDiffFilter').value;
  const searchVal = document.getElementById('libSearch').value.trim().toLowerCase();

  document.getElementById('libSearchClear').style.display = searchVal ? 'block' : 'none';

  const filtered = EXERCISE_DB.filter(ex => {
    if (libActiveMuscle !== 'all' && ex.muscle !== libActiveMuscle) return false;
    if (equipVal !== 'all' && ex.equipment !== equipVal) return false;
    if (diffVal  !== 'all' && ex.difficulty !== diffVal)  return false;
    if (searchVal && !ex.name.toLowerCase().includes(searchVal) && !ex.muscle.includes(searchVal)) return false;
    return true;
  });

  renderLibGrid(filtered);
}

function resetLibFilters() {
  libActiveMuscle = 'all';
  document.getElementById('libEquipFilter').value = 'all';
  document.getElementById('libDiffFilter').value  = 'all';
  document.getElementById('libSearch').value = '';
  document.getElementById('libSearchClear').style.display = 'none';
  document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.lib-tab[data-muscle="all"]').classList.add('active');
  renderLibGrid();
}

function clearLibSearch() {
  document.getElementById('libSearch').value = '';
  document.getElementById('libSearchClear').style.display = 'none';
  applyLibFilters();
}

// ============================================================
// RENDER GRID
// ============================================================
function renderLibGrid(exercises) {
  if (!exercises) exercises = EXERCISE_DB;
  const grid = document.getElementById('libGrid');
  const empty = document.getElementById('libEmpty');
  const countBadge = document.getElementById('libCountBadge');

  countBadge.textContent = exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : '');

  if (exercises.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = exercises.map(ex => {
    const color = MUSCLE_COLORS[ex.muscle] || 'var(--neon)';
    const icon  = EQUIPMENT_ICONS[ex.equipment] || '🏋️';
    const subCount = ex.subs.length;
    const isSelected = libActiveExercise && libActiveExercise.id === ex.id;
    return `
      <div class="lib-card ${isSelected ? 'selected' : ''}"
        style="--muscle-color:${color}"
        onclick="selectLibExercise('${ex.id}', this)">
        <div class="lib-card-top">
          <div class="lib-card-name">${ex.name}</div>
          <span class="lib-card-equip-icon" title="${ex.equipment}">${icon}</span>
        </div>
        <div class="lib-card-meta">
          <span class="lib-badge lib-badge-muscle">${capitalise(ex.muscle)}</span>
          <span class="lib-badge lib-badge-diff-${ex.difficulty}">${capitalise(ex.difficulty)}</span>
        </div>
        ${subCount > 0 ? `<div class="lib-card-sub-hint">${subCount} substitution${subCount > 1 ? 's' : ''} available</div>` : ''}
      </div>
    `;
  }).join('');
}

// ============================================================
// SELECT EXERCISE → SHOW DETAIL
// ============================================================
function selectLibExercise(id, cardEl) {
  const ex = EXERCISE_MAP[id];
  if (!ex) return;
  libActiveExercise = ex;

  // Update selected state on cards
  document.querySelectorAll('.lib-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');

  stopLibVoiceCoach();
  renderLibDetail(ex);
}

function renderLibDetail(ex) {
  const color = MUSCLE_COLORS[ex.muscle] || 'var(--neon)';
  const icon  = EQUIPMENT_ICONS[ex.equipment] || '🏋️';

  // Substitutions
  const subsHtml = ex.subs.length > 0
    ? ex.subs.map(subId => {
        const sub = EXERCISE_MAP[subId];
        if (!sub) return '';
        return `
          <div class="lib-sub-item" onclick="selectLibExerciseById('${sub.id}')">
            <div>
              <div class="lib-sub-name">${sub.name}</div>
              <div class="lib-sub-meta">${capitalise(sub.muscle)} · ${EQUIPMENT_ICONS[sub.equipment]} ${capitalise(sub.equipment)} · ${capitalise(sub.difficulty)}</div>
            </div>
            <span class="lib-sub-arrow">→</span>
          </div>
        `;
      }).join('')
    : `<div class="lib-no-subs">No substitutions configured for this exercise.</div>`;

  document.getElementById('libDetailInner').innerHTML = `
    <div class="lib-detail-name" style="color:${color}">${ex.name}</div>
    <div class="lib-detail-badges">
      <span class="lib-badge lib-badge-muscle">${capitalise(ex.muscle)}</span>
      <span class="lib-badge lib-badge-diff-${ex.difficulty}">${capitalise(ex.difficulty)}</span>
      <span class="lib-badge lib-badge-equip">${icon} ${capitalise(ex.equipment)}</span>
    </div>

    ${ex.youtube ? `
    <a class="lib-detail-yt" href="${ex.youtube}" target="_blank" rel="noopener">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>
      Watch Video Demo
    </a>` : ''}

    <button class="lib-voice-coach-btn" id="libVoiceCoachBtn" onclick="toggleLibVoiceCoach('${ex.id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
      Voice Coaching
    </button>

    <div class="lib-detail-section">
      <div class="lib-detail-section-title">Instructions</div>
      <div class="lib-detail-instructions">${ex.instructions}</div>
    </div>

    <div class="lib-detail-section">
      <div class="lib-detail-section-title">🔄 Can't Do This? Try Instead:</div>
      <div class="lib-subs-list">${subsHtml}</div>
    </div>
  `;
}

function selectLibExerciseById(id) {
  const ex = EXERCISE_MAP[id];
  if (!ex) return;
  libActiveExercise = ex;
  stopLibVoiceCoach();

  // Re-filter to show this exercise's muscle group
  const muscle = ex.muscle;
  const btn = document.querySelector(`.lib-tab[data-muscle="${muscle}"]`);
  if (btn) setLibMuscle(muscle, btn);

  // Small delay so grid re-renders, then select
  setTimeout(() => {
    const cards = document.querySelectorAll('.lib-card');
    cards.forEach(card => {
      if (card.querySelector('.lib-card-name') &&
          card.querySelector('.lib-card-name').textContent === ex.name) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    renderLibDetail(ex);
  }, 60);
}

// ============================================================
// VOICE COACHING (Feature 6 integration)
// ============================================================
function toggleLibVoiceCoach(exId) {
  if (libVoiceInterval) {
    stopLibVoiceCoach();
    return;
  }
  const ex = EXERCISE_MAP[exId];
  if (!ex) return;

  // Build step-by-step coaching from instructions
  const sentences = ex.instructions
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  libVoiceSteps = sentences;
  libVoiceStep  = 0;

  const btn = document.getElementById('libVoiceCoachBtn');
  if (btn) btn.classList.add('coaching');
  if (btn) btn.innerHTML = btn.innerHTML.replace('Voice Coaching', 'Stop Coaching');

  speakLibStep();
  libVoiceInterval = setInterval(() => {
    libVoiceStep++;
    if (libVoiceStep >= libVoiceSteps.length) {
      stopLibVoiceCoach();
      showToast('Voice coaching complete ✓');
      return;
    }
    speakLibStep();
  }, 5000);
}

function speakLibStep() {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(libVoiceSteps[libVoiceStep]);
  utterance.rate = 0.88;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  showToast('🎙 ' + libVoiceSteps[libVoiceStep].slice(0, 60) + (libVoiceSteps[libVoiceStep].length > 60 ? '…' : ''));
}

function stopLibVoiceCoach() {
  if (libVoiceInterval) {
    clearInterval(libVoiceInterval);
    libVoiceInterval = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  libVoiceStep = 0;
  const btn = document.getElementById('libVoiceCoachBtn');
  if (btn) {
    btn.classList.remove('coaching');
    btn.innerHTML = btn.innerHTML.replace('Stop Coaching', 'Voice Coaching');
  }
}

// ============================================================
// UTILITY
// ============================================================
function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================
//   HERO + MOTIVATION SECTION JS
// ============================================================

// ---- Quote Carousel ----
let quoteIndex = 0;
let quoteTimer = null;

function initQuoteCarousel() {
  const track = document.getElementById('quotesTrack');
  if (!track) return;

  // Only run as carousel on mobile
  function isMobile() { return window.innerWidth <= 768; }

  function updateCarousel() {
    if (!isMobile()) {
      track.style.transform = '';
      return;
    }
    track.style.transform = `translateX(${-quoteIndex * 100}%)`;
    document.querySelectorAll('.q-dot').forEach((d, i) => {
      d.classList.toggle('active', i === quoteIndex);
    });
  }

  function nextQuote() {
    quoteIndex = (quoteIndex + 1) % 4;
    updateCarousel();
  }

  // Auto-advance every 4 seconds on mobile
  function startTimer() {
    quoteTimer = setInterval(nextQuote, 4000);
  }
  function resetTimer() {
    clearInterval(quoteTimer);
    startTimer();
  }

  updateCarousel();
  if (isMobile()) startTimer();
  window.addEventListener('resize', () => {
    updateCarousel();
    clearInterval(quoteTimer);
    if (isMobile()) startTimer();
  });

  // Swipe support
  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      quoteIndex = diff > 0
        ? Math.min(quoteIndex + 1, 3)
        : Math.max(quoteIndex - 1, 0);
      updateCarousel();
      resetTimer();
    }
  }, { passive: true });
}

window.goToQuote = function(i) {
  quoteIndex = i;
  const track = document.getElementById('quotesTrack');
  if (track) track.style.transform = `translateX(${-i * 100}%)`;
  document.querySelectorAll('.q-dot').forEach((d, idx) => {
    d.classList.toggle('active', idx === i);
  });
  clearInterval(quoteTimer);
};

// ============================================================
//   EXERCISE VISUAL HELPERS
// ============================================================

// Extract a YouTube video ID from a raw ID or a supported YouTube URL.
function getYtId(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const m = value.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/))([\w-]{11})/i)
    || value.match(/[?&]v=([\w-]{11})/i);
  return m ? m[1] : null;
}

function createVideoRecord(videoId, creator = '') {
  const id = getYtId(videoId);
  if (!id) return null;
  return {
    videoId: id,
    videoUrl: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    creator,
  };
}

function handleExerciseThumbnailError(img) {
  if (!img || img.dataset.fallbackShown) return;
  img.dataset.fallbackShown = 'true';
  const placeholder = document.createElement('div');
  placeholder.className = 'exercise-video-placeholder';
  placeholder.innerHTML = '<span aria-hidden="true">🎬</span><span>Exercise video</span>';
  img.replaceWith(placeholder);
}

function findVideoById(videoId) {
  const id = getYtId(videoId);
  if (!id) return null;
  for (const videos of Object.values(CURATED_VIDEOS)) {
    const match = videos.find(video => video.videoId === id);
    if (match) return match;
  }
  return createVideoRecord(id);
}

function videoUnavailableMarkup(videoId, closeMarkup = '') {
  const video = findVideoById(videoId);
  const url = video ? video.videoUrl : `https://www.youtube.com/watch?v=${videoId}`;
  const creator = video?.creator
    ? `<span class="video-fallback-creator">Recommended by ${video.creator}</span>`
    : '';
  return `
    <div class="video-unavailable-card">
      ${closeMarkup}
      <span class="video-fallback-icon" aria-hidden="true">▶</span>
      <strong>Video unavailable in embedded player</strong>
      ${creator}
      <a class="video-fallback-link" href="${url}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
    </div>`;
}

let youtubeApiPromise = null;
function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise(resolve => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

window.monitorYouTubeEmbed = function(containerId, videoId) {
  loadYouTubeIframeApi().then(() => {
    const container = document.getElementById(containerId);
    const iframe = container?.querySelector('iframe');
    if (!iframe || !window.YT?.Player || container.dataset.embedFailed === 'true') return;
    new window.YT.Player(iframe, {
      events: {
        onError: () => window.handleEmbeddedVideoError(containerId, videoId, containerId.startsWith('exv_')),
      },
    });
  });
};

window.handleEmbeddedVideoError = function(containerId, videoId, includeCloseButton = false) {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.embedFailed === 'true') return;
  container.dataset.embedFailed = 'true';
  const closeMarkup = includeCloseButton
    ? `<button class="ex-iframe-close" onclick="collapseExVideo('${containerId}','${videoId}')" title="Close video">✕</button>`
    : '';
  container.innerHTML = videoUnavailableMarkup(videoId, closeMarkup);
};

// Map exercise names → muscle group + equipment (for the workout plan cards)
const WORKOUT_EXERCISE_META = {
  'Push-ups':                { muscle: 'Chest',     equip: 'Bodyweight' },
  'Wide Push-ups':           { muscle: 'Chest',     equip: 'Bodyweight' },
  'Dumbbell Shoulder Press': { muscle: 'Shoulders', equip: 'Dumbbells'  },
  'Tricep Dips (Chair)':     { muscle: 'Arms',      equip: 'Bodyweight' },
  'Plank':                   { muscle: 'Core',      equip: 'Bodyweight' },
  'Bodyweight Squats':       { muscle: 'Legs',      equip: 'Bodyweight' },
  'Squats':                  { muscle: 'Legs',      equip: 'Bodyweight' },
  'Reverse Lunges':          { muscle: 'Legs',      equip: 'Bodyweight' },
  'Glute Bridges':           { muscle: 'Legs',      equip: 'Bodyweight' },
  'Calf Raises':             { muscle: 'Legs',      equip: 'Bodyweight' },
  'Jumping Jacks':           { muscle: 'Cardio',    equip: 'Bodyweight' },
  'High Knees':              { muscle: 'Cardio',    equip: 'Bodyweight' },
  'Bicycle Crunches':        { muscle: 'Core',      equip: 'Bodyweight' },
  'Mountain Climbers':       { muscle: 'Core',      equip: 'Bodyweight' },
  'Dumbbell Rows':           { muscle: 'Back',      equip: 'Dumbbells'  },
  'Burpees':                 { muscle: 'Full Body', equip: 'Bodyweight' },
  'Jump Squats':             { muscle: 'Legs',      equip: 'Bodyweight' },
  'Side Plank':              { muscle: 'Core',      equip: 'Bodyweight' },
  'Leg Raises':              { muscle: 'Core',      equip: 'Bodyweight' },
  'Dumbbell Chest Press':    { muscle: 'Chest',     equip: 'Dumbbells'  },
  'Dumbbell Goblet Squat':   { muscle: 'Legs',      equip: 'Dumbbells'  },
  'Lunges':                  { muscle: 'Legs',      equip: 'Bodyweight' },
  'Dumbbell Bicep Curls':    { muscle: 'Arms',      equip: 'Dumbbells'  },
  'Hammer Curls':            { muscle: 'Arms',      equip: 'Dumbbells'  },
  'Superman Hold':           { muscle: 'Back',      equip: 'Bodyweight' },
  'Lateral Raises':          { muscle: 'Shoulders', equip: 'Dumbbells'  },
  'Russian Twists':          { muscle: 'Core',      equip: 'Dumbbells'  },
  'Brisk Walk':              { muscle: 'Cardio',    equip: 'Bodyweight' },
  'Stretching':              { muscle: 'Mobility',  equip: 'Bodyweight' },
  'Complete Rest':           { muscle: 'Recovery',  equip: '—'          },
};

// Build an exercise visual section (thumbnail or fallback icon)
function buildExVisual(ex) {
  // Prefer curated video; fall back to DB youtube field
  const exId = getExIdByName(ex.exercise);
  const curated = exId ? getExCuratedVideos(exId) : null;
  const primary = curated && curated.length > 0 ? curated[0] : null;
  const video = primary || createVideoRecord(ex.youtube);
  const ytId = video ? video.videoId : null;
  const channel = video ? video.creator : null;

  const meta = WORKOUT_EXERCISE_META[ex.exercise] || { muscle: 'General', equip: 'Bodyweight' };
  const uid = 'exv_' + ex.exercise.replace(/\W/g, '_') + '_' + Math.random().toString(36).slice(2, 6);

  if (ytId) {
    const thumb = video.thumbnailUrl;
    const channelBadge = channel
      ? `<div class="ex-channel-badge"><span class="ex-ch-play">▶</span>${channel}</div>`
      : '';
    return `
      <div class="ex-visual" id="${uid}" onclick="expandExVideo('${uid}', '${ytId}')">
        <img class="ex-thumb" src="${thumb}" alt="${ex.exercise} form" loading="lazy" onerror="handleExerciseThumbnailError(this)" />
        <div class="ex-play-overlay">
          <div class="ex-visual-badges">
            <span class="ex-visual-badge ex-vb-muscle">${meta.muscle}</span>
            <span class="ex-visual-badge ex-vb-diff">${meta.equip}</span>
          </div>
          <div class="ex-play-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <div class="ex-play-label">Watch Form Demo</div>
          ${channelBadge}
        </div>
      </div>`;
  }

  // Fallback: coloured icon panel
  const muscleColor = { Chest:'#ff6b6b', Legs:'#ffd93d', Back:'#6bcfff', Shoulders:'#a29bfe',
    Arms:'#fd79a8', Core:'#55efc4', Cardio:'#ff9f4d', 'Full Body':'#39ff14', Recovery:'#606070', Mobility:'#b44dff' };
  const color = muscleColor[meta.muscle] || '#39ff14';
  return `
    <div class="ex-visual ex-visual-fallback" style="aspect-ratio:16/9;background:linear-gradient(135deg,rgba(${hexToRgb(color)},0.15),rgba(${hexToRgb(color)},0.04));cursor:default">
      <div class="ex-visual-badges">
        <span class="ex-visual-badge ex-vb-muscle">${meta.muscle}</span>
        <span class="ex-visual-badge ex-vb-diff">${meta.equip}</span>
      </div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">
        <span style="font-size:2.5rem">🏋️</span>
        <span style="font-size:0.72rem;color:var(--text-muted);font-weight:600">${ex.exercise}</span>
      </div>
    </div>`;
}

function hexToRgb(hex) {
  // hex like #ff6b6b
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// Expand thumbnail to YouTube iframe on click
window.expandExVideo = function(uid, ytId) {
  const el = document.getElementById(uid);
  if (!el) return;
  el.outerHTML = `
    <div class="ex-iframe-wrap" id="${uid}">
      <button class="ex-iframe-close" onclick="collapseExVideo('${uid}','${ytId}')" title="Close video">✕</button>
      <iframe
        src="${findVideoById(ytId).embedUrl}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
        onerror="handleEmbeddedVideoError('${uid}', '${ytId}', true)"
        onload="monitorYouTubeEmbed('${uid}', '${ytId}')"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy">
      </iframe>
    </div>`;
};

window.collapseExVideo = function(uid, ytId) {
  const el = document.getElementById(uid);
  if (!el) return;
  // Find the parent exercise-item to get the name
  const item = el.closest('.exercise-item');
  const name = item ? item.dataset.exname : '';
  const exEntry = Object.values(currentPlan?.workout_plan || {}).flat().find(e => e.exercise === name);
  if (exEntry) {
    el.outerHTML = buildExVisual(exEntry);
  } else {
    el.outerHTML = `<div class="ex-visual-fallback" style="height:40px"></div>`;
  }
};

// ============================================================
// OVERRIDE: renderWorkout — add visuals to exercise cards
// ============================================================
// Save original
const _origRenderWorkout = renderWorkout;

window.renderWorkout = function(workoutPlan) {
  const grid = document.getElementById('workoutGrid');
  grid.innerHTML = '';

  const todayKey = getTodayKey();
  const completedDays = getCompletedDays(todayKey);

  Object.entries(workoutPlan).forEach(([day, exercises], index) => {
    const isDone = completedDays.includes(day);
    const card = document.createElement('div');
    card.className = `day-card ${index === 0 ? 'open' : ''}`;
    card.dataset.day = day;

    const exerciseItems = exercises.map(ex => {
      const tip = getExerciseTip(ex.exercise);
      const visual = buildExVisual(ex);
      const meta = WORKOUT_EXERCISE_META[ex.exercise] || {};
      const metaBadges = [
        meta.muscle ? `<span class="ex-meta-badge ex-meta-muscle">${meta.muscle}</span>` : '',
        meta.equip && meta.equip !== '—' ? `<span class="ex-meta-badge ex-meta-equip">${meta.equip}</span>` : '',
      ].join('');

      return `
        <div class="exercise-item" data-name="${ex.exercise.toLowerCase()}" data-exname="${ex.exercise}">
          ${visual}
          <div class="exercise-main">
            <div class="exercise-info">
              <div class="exercise-name">${ex.exercise}</div>
              ${metaBadges ? `<div class="exercise-meta-row">${metaBadges}</div>` : ''}
              <div class="exercise-instructions">${ex.instructions}</div>
            </div>
            <div class="exercise-right">
              <div class="exercise-sets">${ex.sets} × ${ex.reps}</div>
              ${ex.youtube ? `<a class="yt-link" href="${ex.youtube}" target="_blank" rel="noopener">▶ Open in YT</a>` : ''}
            </div>
          </div>
          ${tip ? `<div class="exercise-tip">${tip}</div>` : ''}
        </div>`;
    }).join('');

    card.innerHTML = `
      <div class="day-header" onclick="toggleDay(this)">
        <span class="day-title">${day}</span>
        <div class="day-header-right">
          <span class="day-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</span>
          <button class="day-complete-btn ${isDone ? 'completed' : ''}"
            onclick="markDayComplete(event, '${day.replace(/'/g, "\\'")}', this)">
            ${isDone ? '✓ Done' : 'Mark Done'}
          </button>
          <span class="day-chevron">▾</span>
        </div>
      </div>
      <div class="exercises-list">${exerciseItems}</div>`;

    grid.appendChild(card);
  });
};

// ============================================================
// INIT HOOK — run quote carousel + any page-load animations
// ============================================================
const _origDOMReady = document.addEventListener;
document.addEventListener('DOMContentLoaded', () => {
  initQuoteCarousel();
  animateHeroStats();
});

function animateHeroStats() {
  // Staggered fade-in for stat items
  document.querySelectorAll('.hero-stats .stat-item').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => {
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 300 + i * 100);
  });
}

// ============================================================
//   ADAPTIVE EXERCISE SYSTEM
// ============================================================

// ── 1. Extra exercises (not in original DB) ─────────────────
EXERCISE_DB.push(
  {
    id: 'arnold_press', name: 'Arnold Press',
    muscle: 'shoulders', difficulty: 'intermediate', equipment: 'dumbbells',
    instructions: 'Sit or stand, dumbbells in front of your face with palms facing you. As you press up, rotate palms forward so they face away at the top. Reverse on the way down. This rotation recruits all three deltoid heads. Keep core braced.',
    youtube: '6Z15_WdXmVw',
    subs: ['shoulder_press', 'lateral_raises', 'front_raises'],
  },
  {
    id: 'knee_pushups', name: 'Knee Push-ups',
    muscle: 'chest', difficulty: 'beginner', equipment: 'none',
    instructions: 'Start on all fours, hands slightly wider than shoulder-width, knees on the floor. Keep hips aligned with your spine — do not raise your hips. Lower your chest to the floor and push back up. Great first step toward full push-ups.',
    youtube: 'jWxvty2KROs',
    subs: ['pushups', 'dumbbell_chest_press'],
  },
  {
    id: 'wall_sit', name: 'Wall Sit',
    muscle: 'legs', difficulty: 'beginner', equipment: 'none',
    instructions: 'Stand with your back against a wall, feet shoulder-width apart. Slide down until thighs are parallel to the floor (90° angle at knees). Hold the position, keeping your back flat. Builds quad endurance without any equipment.',
    youtube: 'y-wV4Venusw',
    subs: ['squats', 'lunges', 'leg_press'],
  },
  {
    id: 'cable_fly', name: 'Cable Fly',
    muscle: 'chest', difficulty: 'intermediate', equipment: 'machine',
    instructions: 'Set cables at shoulder height. Stand in the center, grab both handles. With a slight elbow bend, bring both handles together in front of your chest in a wide arc, squeezing your pecs. Slowly open back to start. Don\'t use your biceps.',
    youtube: 'WEM9FCIPlxQ',
    subs: ['chest_fly', 'dumbbell_chest_press', 'pushups'],
  },
  {
    id: 'face_pulls', name: 'Face Pulls',
    muscle: 'shoulders', difficulty: 'beginner', equipment: 'machine',
    instructions: 'Attach a rope to a high cable pulley. Pull the rope toward your face, flaring elbows out at shoulder height. Squeeze your rear delts and external rotators at the end. Excellent for shoulder health and posture correction.',
    youtube: 'rep-qVOkqgk',
    subs: ['lateral_raises', 'shoulder_press', 'front_raises'],
  },
  {
    id: 'dips', name: 'Parallel Bar Dips',
    muscle: 'arms', difficulty: 'intermediate', equipment: 'none',
    instructions: 'Grip parallel bars, arms straight. Lower yourself by bending your elbows until your upper arms are parallel to the floor. Press back up to straight arms. Lean slightly forward to involve more chest, stay upright for more tricep focus.',
    youtube: '2z8JmcrW-As',
    subs: ['tricep_dips', 'overhead_tricep_ext', 'pushups'],
  },
  {
    id: 'reverse_fly', name: 'Reverse Fly',
    muscle: 'back', difficulty: 'beginner', equipment: 'dumbbells',
    instructions: 'Hinge at hips with a slight knee bend, dumbbells hanging. With a soft elbow bend, raise both arms out to the sides to shoulder height, squeezing your rear delts. Lower slowly. Keep your back flat throughout — this is not a shrug.',
    youtube: 'ttvfGg9d76c',
    subs: ['dumbbell_rows', 'face_pulls', 'resistance_band_rows'],
  }
);

// Rebuild the map after adding new exercises
EXERCISE_DB.forEach(ex => { EXERCISE_MAP[ex.id] = ex; });

// ============================================================
//   CURATED VIDEO RECOMMENDATIONS
//   Trusted fitness creators mapped per exercise
// ============================================================
const CURATED_VIDEOS = {
  pushups: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/IODxDxX7oi4' }],
  bench_press: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/gRVjAtPip0Y' }],
  squats: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/aclHkVaku9U' }],
  bicep_curls: [{ channel: 'Sean Nalewanyj', url: 'https://www.youtube.com/embed/ykJmrZ5v0Oo' }],
  knee_pushups: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/jWxvty2KROs' }],
  dumbbell_chest_press: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/VmB1G1K7v94' }],
  incline_dumbbell_press: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/8iPEnn-ltC8' }],
  chest_fly: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/eozdVDA78K0' }],
  cable_fly: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/WEM9FCIPlxQ' }],
  leg_press: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/IZxyjW7MPJQ' }],
  lunges: [{ channel: 'Sean Nalewanyj', url: 'https://www.youtube.com/embed/QOVaHwm-Q6U' }],
  romanian_deadlift: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/JCXUYuzwNrM' }],
  goblet_squat: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/MxsFDhcyFyE' }],
  glute_bridge: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/wPM8icPu6H8' }],
  wall_sit: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/y-wV4Venusw' }],
  pullups: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/eGo4IYlbE5g' }],
  lat_pulldown: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/CAwf7n6Luuc' }],
  dumbbell_rows: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/roCP6wCXPqo' }],
  seated_row: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/GZbfZ033f74' }],
  deadlift: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/op9kVnSso6Q' }],
  resistance_band_rows: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/xQNrFHEMhI4' }],
  reverse_fly: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/ttvfGg9d76c' }],
  shoulder_press: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/qEwKCR5JCog' }],
  lateral_raises: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/3VcKaXpzqRo' }],
  front_raises: [{ channel: 'Sean Nalewanyj', url: 'https://www.youtube.com/embed/gkRrcfAyWTs' }],
  arnold_press: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/6Z15_WdXmVw' }],
  face_pulls: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/rep-qVOkqgk' }],
  tricep_dips: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/6kALZikXxLc' }],
  hammer_curls: [{ channel: 'Sean Nalewanyj', url: 'https://www.youtube.com/embed/zC3nLlEvin4' }],
  tricep_pushdown: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/2-LAMcpzODU' }],
  barbell_curl: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/kwG2ipFRgfo' }],
  overhead_tricep_ext: [{ channel: 'Sean Nalewanyj', url: 'https://www.youtube.com/embed/_gsUck-7M74' }],
  dips: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/2z8JmcrW-As' }],
  plank: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/ASdvN_XEl_c' }],
  crunches: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/Xyd_fa5zoEU' }],
  leg_raises: [{ channel: 'Deltabolics', url: 'https://www.youtube.com/embed/JB2oyawG9KI' }],
  bicycle_crunches: [{ channel: 'Shivam Dubey', url: 'https://www.youtube.com/embed/1we3bh9uhqY' }],
  mountain_climbers: [{ channel: 'Sean Nalewanyj', url: 'https://www.youtube.com/embed/nmwgirgXLYM' }],
  dead_bug: [{ channel: 'Jeff Nippard', url: 'https://www.youtube.com/embed/4XLEnwUr1d8' }],
  hollow_hold: [{ channel: 'Tyler Path', url: 'https://www.youtube.com/embed/LlDNef_Ztsc' }],
};

// Normalize the existing recommendations once so every video has the same
// explicit URLs and creator metadata without changing any assigned videos.
Object.keys(CURATED_VIDEOS).forEach(exerciseId => {
  CURATED_VIDEOS[exerciseId] = CURATED_VIDEOS[exerciseId]
    .map(video => createVideoRecord(video.videoId || video.url, video.creator || video.channel))
    .filter(Boolean);
});

const EXERCISE_VIDEO_RECORDS = Object.fromEntries(
  EXERCISE_DB
    .map(exercise => {
      const curated = CURATED_VIDEOS[exercise.id]?.[0];
      const video = curated || createVideoRecord(exercise.youtube);
      return video ? [exercise.id, video] : null;
    })
    .filter(Boolean)
);

// Lookup curated videos by exercise id
function getExCuratedVideos(exId) {
  return CURATED_VIDEOS[exId] || null;
}

// Lookup exercise id by display name
function getExIdByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  const found = EXERCISE_DB.find(e => e.name.toLowerCase() === lower);
  return found ? found.id : null;
}

// ── 2. Variations map ───────────────────────────────────────
// Each entry: { easier: [id, ...], harder: [id, ...] }
// "easier" = step DOWN in difficulty; "harder" = step UP
const EXERCISE_VARIATIONS = {
  // CHEST
  'knee_pushups':          { easier: [],                                  harder: ['pushups', 'dumbbell_chest_press'] },
  'pushups':               { easier: ['knee_pushups'],                    harder: ['dumbbell_chest_press', 'bench_press'] },
  'dumbbell_chest_press':  { easier: ['pushups', 'knee_pushups'],         harder: ['bench_press', 'cable_fly'] },
  'chest_fly':             { easier: ['pushups'],                         harder: ['cable_fly', 'incline_dumbbell_press'] },
  'incline_dumbbell_press':{ easier: ['dumbbell_chest_press', 'pushups'], harder: ['bench_press'] },
  'bench_press':           { easier: ['dumbbell_chest_press', 'pushups'], harder: ['incline_dumbbell_press'] },
  'cable_fly':             { easier: ['chest_fly', 'pushups'],            harder: ['bench_press'] },
  // LEGS
  'wall_sit':              { easier: [],                                  harder: ['squats', 'lunges'] },
  'glute_bridge':          { easier: [],                                  harder: ['romanian_deadlift', 'squats'] },
  'squats':                { easier: ['wall_sit', 'goblet_squat'],        harder: ['goblet_squat', 'lunges', 'romanian_deadlift'] },
  'lunges':                { easier: ['squats', 'wall_sit'],              harder: ['romanian_deadlift', 'goblet_squat'] },
  'goblet_squat':          { easier: ['squats', 'wall_sit'],              harder: ['lunges', 'romanian_deadlift'] },
  'romanian_deadlift':     { easier: ['glute_bridge', 'squats'],          harder: ['deadlift'] },
  'leg_press':             { easier: ['wall_sit', 'squats'],              harder: ['squats', 'lunges'] },
  // BACK
  'resistance_band_rows':  { easier: [],                                  harder: ['dumbbell_rows', 'seated_row', 'lat_pulldown'] },
  'reverse_fly':           { easier: ['resistance_band_rows'],            harder: ['dumbbell_rows', 'seated_row'] },
  'dumbbell_rows':         { easier: ['resistance_band_rows', 'reverse_fly'], harder: ['seated_row', 'lat_pulldown'] },
  'seated_row':            { easier: ['dumbbell_rows', 'resistance_band_rows'], harder: ['lat_pulldown', 'pullups'] },
  'lat_pulldown':          { easier: ['seated_row', 'dumbbell_rows'],     harder: ['pullups'] },
  'pullups':               { easier: ['lat_pulldown', 'seated_row'],      harder: ['deadlift'] },
  'deadlift':              { easier: ['romanian_deadlift', 'dumbbell_rows'], harder: [] },
  // SHOULDERS
  'lateral_raises':        { easier: [],                                  harder: ['shoulder_press', 'arnold_press'] },
  'front_raises':          { easier: [],                                  harder: ['shoulder_press', 'arnold_press'] },
  'face_pulls':            { easier: ['lateral_raises'],                  harder: ['shoulder_press'] },
  'shoulder_press':        { easier: ['lateral_raises', 'front_raises'],  harder: ['arnold_press'] },
  'arnold_press':          { easier: ['shoulder_press', 'lateral_raises'], harder: [] },
  // ARMS
  'bicep_curls':           { easier: [],                                  harder: ['hammer_curls', 'barbell_curl'] },
  'hammer_curls':          { easier: ['bicep_curls'],                     harder: ['barbell_curl'] },
  'barbell_curl':          { easier: ['hammer_curls', 'bicep_curls'],     harder: [] },
  'tricep_dips':           { easier: [],                                  harder: ['dips', 'overhead_tricep_ext'] },
  'overhead_tricep_ext':   { easier: ['tricep_dips'],                     harder: ['dips', 'tricep_pushdown'] },
  'tricep_pushdown':       { easier: ['tricep_dips', 'overhead_tricep_ext'], harder: ['dips'] },
  'dips':                  { easier: ['tricep_dips', 'overhead_tricep_ext'], harder: [] },
  // CORE
  'dead_bug':              { easier: [],                                  harder: ['plank', 'hollow_hold'] },
  'crunches':              { easier: ['dead_bug'],                        harder: ['bicycle_crunches', 'leg_raises'] },
  'plank':                 { easier: ['dead_bug'],                        harder: ['mountain_climbers', 'hollow_hold'] },
  'hollow_hold':           { easier: ['plank', 'dead_bug'],              harder: ['leg_raises'] },
  'bicycle_crunches':      { easier: ['crunches', 'dead_bug'],           harder: ['leg_raises', 'hollow_hold'] },
  'leg_raises':            { easier: ['bicycle_crunches', 'crunches'],   harder: [] },
  'mountain_climbers':     { easier: ['plank', 'crunches'],              harder: ['leg_raises', 'hollow_hold'] },
};

// ── 3. Equipment adaptation map ─────────────────────────────
// For each equipment type, maps exercise name → best EXERCISE_DB id substitute
const EQUIP_ADAPT = {
  none: {
    'Bench Press':               'pushups',
    'Dumbbell Chest Press':      'pushups',
    'Incline Dumbbell Press':    'pushups',
    'Chest Fly':                 'pushups',
    'Cable Fly':                 'pushups',
    'Romanian Deadlift':         'glute_bridge',
    'Goblet Squat':              'squats',
    'Leg Press':                 'wall_sit',
    'Dumbbell Rows':             'resistance_band_rows',
    'Lat Pulldown':              'resistance_band_rows',
    'Seated Row':                'resistance_band_rows',
    'Deadlift':                  'resistance_band_rows',
    'Reverse Fly':               'resistance_band_rows',
    'Dumbbell Shoulder Press':   null,
    'Shoulder Press':            null,
    'Arnold Press':              null,
    'Lateral Raises':            null,
    'Front Raises':              null,
    'Face Pulls':                null,
    'Dumbbell Bicep Curls':      null,
    'Bicep Curls':               null,
    'Hammer Curls':              null,
    'Barbell Curl':              null,
    'Tricep Pushdown':           'tricep_dips',
    'Overhead Tricep Extension': 'tricep_dips',
    'Parallel Bar Dips':         'tricep_dips',
  },
  dumbbells: {
    'Bench Press':               'dumbbell_chest_press',
    'Incline Dumbbell Press':    'dumbbell_chest_press',
    'Cable Fly':                 'chest_fly',
    'Lat Pulldown':              'dumbbell_rows',
    'Seated Row':                'dumbbell_rows',
    'Deadlift':                  'romanian_deadlift',
    'Leg Press':                 'goblet_squat',
    'Tricep Pushdown':           'overhead_tricep_ext',
    'Parallel Bar Dips':         'overhead_tricep_ext',
    'Face Pulls':                'reverse_fly',
    'Barbell Curl':              'bicep_curls',
  },
  machine: {
    'Push-ups':                  'cable_fly',
    'Knee Push-ups':             'cable_fly',
    'Dumbbell Chest Press':      'cable_fly',
    'Dumbbell Rows':             'seated_row',
    'Resistance Band Rows':      'seated_row',
    'Reverse Fly':               'face_pulls',
    'Barbell Curl':              'tricep_pushdown',
    'Tricep Dips (Chair)':       'tricep_pushdown',
    'Overhead Tricep Extension': 'tricep_pushdown',
    'Romanian Deadlift':         'leg_press',
    'Goblet Squat':              'leg_press',
    'Lateral Raises':            'face_pulls',
  },
  barbell: {
    'Push-ups':                  'bench_press',
    'Dumbbell Chest Press':      'bench_press',
    'Dumbbell Rows':             'deadlift',
    'Romanian Deadlift':         'deadlift',
    'Bicep Curls':               'barbell_curl',
    'Hammer Curls':              'barbell_curl',
    'Squats':                    'squats',
  },
};

// ── 4. User fitness level (persisted) ───────────────────────
let userFitnessLevel = localStorage.getItem('fitmate_level') || 'all';

function setUserLevel(level, btn) {
  userFitnessLevel = level;
  localStorage.setItem('fitmate_level', level);

  document.querySelectorAll('.lib-lvl-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const hint = document.getElementById('libLevelHint');
  if (hint) {
    const msgs = {
      beginner:     '🟢 Showing beginner-friendly exercises first',
      intermediate: '🟡 Balanced view with progression options',
      advanced:     '🔴 Full library including advanced techniques',
      all:          'Select your level for personalized recommendations',
    };
    hint.textContent = msgs[level] || msgs.all;
  }

  // Re-sort/re-render grid so level-fit badges appear
  applyLibFilters();

  // If a detail is open, re-render it
  if (libActiveExercise) renderLibDetailWithAdaptations(libActiveExercise);
}

// Restore saved level on library open
function initUserLevelUI() {
  if (userFitnessLevel !== 'all') {
    const btn = document.querySelector(`.lib-lvl-btn[data-level="${userFitnessLevel}"]`);
    if (btn) btn.classList.add('active');
    const hint = document.getElementById('libLevelHint');
    const msgs = {
      beginner:     '🟢 Showing beginner-friendly exercises first',
      intermediate: '🟡 Balanced view with progression options',
      advanced:     '🔴 Full library including advanced techniques',
    };
    if (hint && msgs[userFitnessLevel]) hint.textContent = msgs[userFitnessLevel];
  }
}

// ── 5. Override renderLibGrid to add level-fit badges ───────
const _baseRenderLibGrid = renderLibGrid;
window.renderLibGrid = function(exercises) {
  if (!exercises) exercises = EXERCISE_DB;

  const grid = document.getElementById('libGrid');
  const empty = document.getElementById('libEmpty');
  const countBadge = document.getElementById('libCountBadge');
  countBadge.textContent = exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : '');

  if (exercises.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // Sort: when a level is set, put matching exercises first
  let sorted = [...exercises];
  if (userFitnessLevel !== 'all') {
    const order = { beginner: 0, intermediate: 1, advanced: 2 };
    const userOrder = order[userFitnessLevel] ?? 1;
    sorted.sort((a, b) => {
      const da = Math.abs((order[a.difficulty] ?? 1) - userOrder);
      const db = Math.abs((order[b.difficulty] ?? 1) - userOrder);
      return da - db;
    });
  }

  grid.innerHTML = sorted.map(ex => {
    const color = MUSCLE_COLORS[ex.muscle] || 'var(--neon)';
    const icon  = EQUIPMENT_ICONS[ex.equipment] || '🏋️';
    const subCount = ex.subs.length;
    const isSelected = libActiveExercise && libActiveExercise.id === ex.id;
    const video = EXERCISE_VIDEO_RECORDS[ex.id] || createVideoRecord(ex.youtube);
    const thumbHtml = video ? `
      <div class="lib-card-thumb" onclick="event.stopPropagation(); selectLibExercise('${ex.id}', this.closest('.lib-card'))">
        <img src="${video.thumbnailUrl}" alt="${ex.name}" loading="lazy" onerror="handleExerciseThumbnailError(this)" />
        <div class="lib-card-thumb-play">
          <div class="lib-card-thumb-play-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#000"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>` : '';

    let levelFitBadge = '';
    if (userFitnessLevel !== 'all') {
      const order = { beginner: 0, intermediate: 1, advanced: 2 };
      const diff = order[ex.difficulty] ?? 1;
      const user = order[userFitnessLevel] ?? 1;
      if (diff === user) {
        levelFitBadge = `<span class="lib-card-level-fit lib-lvlfit-perfect">✓ Your Level</span>`;
      } else if (diff < user) {
        levelFitBadge = `<span class="lib-card-level-fit lib-lvlfit-easy">↓ Below your level</span>`;
      } else {
        levelFitBadge = `<span class="lib-card-level-fit lib-lvlfit-challenge">↑ Challenge</span>`;
      }
    }

    return `
      <div class="lib-card ${isSelected ? 'selected' : ''}"
        style="--muscle-color:${color}"
        onclick="selectLibExercise('${ex.id}', this)">
        ${thumbHtml}
        <div class="lib-card-top">
          <div class="lib-card-name">${ex.name}</div>
          <span class="lib-card-equip-icon" title="${ex.equipment}">${icon}</span>
        </div>
        <div class="lib-card-meta">
          <span class="lib-badge lib-badge-muscle">${capitalise(ex.muscle)}</span>
          <span class="lib-badge lib-badge-diff-${ex.difficulty}">${capitalise(ex.difficulty)}</span>
        </div>
        ${levelFitBadge}
        ${subCount > 0 ? `<div class="lib-card-sub-hint">${subCount} substitution${subCount > 1 ? 's' : ''} available</div>` : ''}
      </div>`;
  }).join('');
};

// ── 6. Enhanced renderLibDetail with progression + video ────
window.renderLibDetail = function(ex) {
  renderLibDetailWithAdaptations(ex);
};

function renderLibDetailWithAdaptations(ex) {
  const color = MUSCLE_COLORS[ex.muscle] || 'var(--neon)';
  const icon  = EQUIPMENT_ICONS[ex.equipment] || '🏋️';
  const fallbackVideo = createVideoRecord(ex.youtube);
  const vars  = EXERCISE_VARIATIONS[ex.id] || { easier: [], harder: [] };

  // ---- Video section (curated) ----
  let videoHtml = '';
  const curatedList = CURATED_VIDEOS[ex.id];
  const primaryCurated = curatedList && curatedList.length > 0 ? curatedList[0] : null;
  const primaryVideo = primaryCurated || fallbackVideo;
  const vidId = primaryVideo ? primaryVideo.videoId : null;
  const vidChannel = primaryVideo ? primaryVideo.creator : null;

  if (vidId) {
    const thumb = primaryVideo.thumbnailUrl;
    const channelLabel = vidChannel
      ? `<span class="lib-vid-channel-badge"><span class="lib-ch-dot">▶</span>${vidChannel}</span>`
      : '';

    const creatorTabsHtml = (curatedList && curatedList.length > 1)
      ? `<div class="lib-creator-tabs" id="lib-creator-tabs-${ex.id}">
          <span class="lib-creator-tabs-label">Switch Creator:</span>
          ${curatedList.map((v, i) => `
            <button class="lib-creator-tab ${i === 0 ? 'active' : ''}"
              onclick="switchLibDetailCreator('${ex.id}', ${i})">${v.creator}</button>
          `).join('')}
        </div>`
      : '';

    videoHtml = `
      <div class="lib-expert-badge">🏆 Recommended by Experts</div>
      <div class="lib-detail-video-wrap" id="libVidWrap_${ex.id}">
        <img class="lib-detail-video-thumb" src="${thumb}" alt="${ex.name}" loading="lazy" onerror="handleExerciseThumbnailError(this)" />
        <div class="lib-detail-video-play-overlay" onclick="expandLibVideo('${ex.id}','${vidId}')">
          <div class="lib-detail-play-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#000"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <span class="lib-detail-video-label">▶ Watch Demo</span>
        </div>
        ${channelLabel}
      </div>
      ${creatorTabsHtml}`;
  }

  // ---- Personalized recommendation ----
  let recoHtml = '';
  if (userFitnessLevel !== 'all') {
    const order = { beginner: 0, intermediate: 1, advanced: 2 };
    const diff  = order[ex.difficulty] ?? 1;
    const user  = order[userFitnessLevel] ?? 1;
    if (diff === user) {
      recoHtml = `<div class="lib-reco-box reco-perfect"><span class="lib-reco-icon">✅</span><span>Perfect for your level! This exercise is well-matched to your experience as a <strong>${userFitnessLevel}</strong>.</span></div>`;
    } else if (diff > user) {
      const easierIds = vars.easier.slice(0, 2);
      const easierNames = easierIds.map(id => EXERCISE_MAP[id]?.name).filter(Boolean).join(', ');
      recoHtml = `<div class="lib-reco-box reco-challenge"><span class="lib-reco-icon">⚠️</span><span>This is a <strong>challenge exercise</strong> for a ${userFitnessLevel}.${easierNames ? ` Try these first: <strong>${easierNames}</strong>.` : ' Consider starting with an easier variation.'}</span></div>`;
    } else {
      const harderIds = vars.harder.slice(0, 2);
      const harderNames = harderIds.map(id => EXERCISE_MAP[id]?.name).filter(Boolean).join(', ');
      recoHtml = `<div class="lib-reco-box reco-easy"><span class="lib-reco-icon">💡</span><span>This may be <strong>below your level</strong>.${harderNames ? ` Ready to progress? Try: <strong>${harderNames}</strong>.` : ' Consider a harder variation.'}</span></div>`;
    }
  }

  // ---- Progression path strip ----
  let progHtml = '';
  const allEasier = vars.easier.map(id => EXERCISE_MAP[id]).filter(Boolean);
  const allHarder = vars.harder.map(id => EXERCISE_MAP[id]).filter(Boolean);
  if (allEasier.length > 0 || allHarder.length > 0) {
    const easierPills = allEasier.map(e => `
      <div class="prog-node">
        <button class="prog-pill prog-easier" onclick="selectLibExerciseById('${e.id}')" title="Easier alternative">
          ${e.name}
        </button>
        <span class="prog-label">Easier</span>
      </div>`).join('<span class="prog-arrow">←</span>');

    const harderPills = allHarder.map(e => `
      <div class="prog-node">
        <button class="prog-pill prog-harder" onclick="selectLibExerciseById('${e.id}')" title="Harder alternative">
          ${e.name}
        </button>
        <span class="prog-label">Harder</span>
      </div>`).join('<span class="prog-arrow">→</span>');

    const currentPill = `
      <div class="prog-node">
        <div class="prog-pill prog-current">${ex.name}</div>
        <span class="prog-label">You Are Here</span>
      </div>`;

    const trackParts = [];
    if (easierPills) { trackParts.push(easierPills); trackParts.push('<span class="prog-arrow">←</span>'); }
    trackParts.push(currentPill);
    if (harderPills) { trackParts.push('<span class="prog-arrow">→</span>'); trackParts.push(harderPills); }

    progHtml = `
      <div class="lib-progression-section lib-detail-section">
        <div class="lib-detail-section-title lib-progression-title">📈 Progression Path</div>
        <div class="progression-track">${trackParts.join('')}</div>
      </div>`;
  }

  // ---- Substitutions ----
  const subsHtml = ex.subs.length > 0
    ? ex.subs.map(subId => {
        const sub = EXERCISE_MAP[subId];
        if (!sub) return '';
        return `
          <div class="lib-sub-item" onclick="selectLibExerciseById('${sub.id}')">
            <div>
              <div class="lib-sub-name">${sub.name}</div>
              <div class="lib-sub-meta">${capitalise(sub.muscle)} · ${EQUIPMENT_ICONS[sub.equipment]} ${capitalise(sub.equipment)} · ${capitalise(sub.difficulty)}</div>
            </div>
            <span class="lib-sub-arrow">→</span>
          </div>`;
      }).join('')
    : `<div class="lib-no-subs">No substitutions configured for this exercise.</div>`;

  document.getElementById('libDetailInner').innerHTML = `
    <div class="lib-detail-name" style="color:${color}">${ex.name}</div>
    <div class="lib-detail-badges">
      <span class="lib-badge lib-badge-muscle">${capitalise(ex.muscle)}</span>
      <span class="lib-badge lib-badge-diff-${ex.difficulty}">${capitalise(ex.difficulty)}</span>
      <span class="lib-badge lib-badge-equip">${icon} ${capitalise(ex.equipment)}</span>
    </div>

    ${recoHtml}
    ${videoHtml}

    <button class="lib-voice-coach-btn" id="libVoiceCoachBtn" onclick="toggleLibVoiceCoach('${ex.id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
      Voice Coaching
    </button>

    <div class="lib-detail-section">
      <div class="lib-detail-section-title">Instructions</div>
      <div class="lib-detail-instructions">${ex.instructions}</div>
    </div>

    ${progHtml}

    <div class="lib-detail-section">
      <div class="lib-detail-section-title">🔄 Can't Do This? Try Instead:</div>
      <div class="lib-subs-list">${subsHtml}</div>
    </div>
  `;
}

// Expand thumbnail to iframe in lib detail panel
window.expandLibVideo = function(exId, ytId) {
  const wrap = document.getElementById('libVidWrap_' + exId);
  if (!wrap) return;
  wrap.dataset.activeYtId = ytId;
  const video = findVideoById(ytId);
  wrap.outerHTML = `
    <div class="lib-detail-iframe-wrap" id="libVidWrap_${exId}" data-active-yt-id="${ytId}">
      <iframe src="${video.embedUrl}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}"
        onerror="handleEmbeddedVideoError('libVidWrap_${exId}', '${ytId}')"
        onload="monitorYouTubeEmbed('libVidWrap_${exId}', '${ytId}')"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"></iframe>
    </div>`;
};

// Switch creator video in lib detail panel
window.switchLibDetailCreator = function(exId, idx) {
  const curated = CURATED_VIDEOS[exId];
  if (!curated || !curated[idx]) return;
  const selectedVideo = curated[idx];
  const newYtId = selectedVideo.videoId;
  const newChannel = selectedVideo.creator;

  // Update active tab styles
  const tabContainer = document.getElementById('lib-creator-tabs-' + exId);
  if (tabContainer) {
    tabContainer.querySelectorAll('.lib-creator-tab').forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });
  }

  const wrap = document.getElementById('libVidWrap_' + exId);
  if (!wrap) return;

  const isPlaying = wrap.classList.contains('lib-detail-iframe-wrap') || wrap.querySelector('iframe');

  if (isPlaying) {
    // Swap iframe src with transition
    const iframe = wrap.querySelector('iframe');
    if (iframe) {
      wrap.style.opacity = '0';
      wrap.style.transition = 'opacity 0.2s';
      setTimeout(() => {
        iframe.src = `${selectedVideo.embedUrl}?autoplay=1&rel=0&modestbranding=1`;
        wrap.style.opacity = '1';
      }, 200);
    }
  } else {
    // Swap thumbnail + channel badge with transition
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity 0.2s';
    setTimeout(() => {
      const thumb = wrap.querySelector('.lib-detail-video-thumb');
      const badge = wrap.querySelector('.lib-vid-channel-badge');
      const overlay = wrap.querySelector('.lib-detail-video-play-overlay');
      if (thumb) thumb.src = selectedVideo.thumbnailUrl;
      if (badge) {
        badge.innerHTML = `<span class="lib-ch-dot">▶</span>${newChannel}`;
      }
      if (overlay) {
        overlay.onclick = () => window.expandLibVideo(exId, newYtId);
      }
      wrap.style.opacity = '1';
    }, 200);
  }
};

// ── 7. Patch applyLibFilters to respect level sort ──────────
const _baseApplyLibFilters = applyLibFilters;
window.applyLibFilters = function() {
  const equipVal  = document.getElementById('libEquipFilter').value;
  const diffVal   = document.getElementById('libDiffFilter').value;
  const searchVal = document.getElementById('libSearch').value.trim().toLowerCase();

  document.getElementById('libSearchClear').style.display = searchVal ? 'block' : 'none';

  const filtered = EXERCISE_DB.filter(ex => {
    if (libActiveMuscle !== 'all' && ex.muscle !== libActiveMuscle) return false;
    if (equipVal !== 'all' && ex.equipment !== equipVal) return false;
    if (diffVal  !== 'all' && ex.difficulty !== diffVal)  return false;
    if (searchVal && !ex.name.toLowerCase().includes(searchVal) && !ex.muscle.includes(searchVal)) return false;
    return true;
  });

  renderLibGrid(filtered);
};

// ── 8. Patch resetLibFilters to reset level too ─────────────
const _baseResetLibFilters = resetLibFilters;
window.resetLibFilters = function() {
  libActiveMuscle = 'all';
  document.getElementById('libEquipFilter').value = 'all';
  document.getElementById('libDiffFilter').value  = 'all';
  document.getElementById('libSearch').value = '';
  document.getElementById('libSearchClear').style.display = 'none';
  document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.lib-tab[data-muscle="all"]').classList.add('active');
  renderLibGrid();
};

// Patch openLibrary to restore level UI
const _baseOpenLibrary = openLibrary;
window.openLibrary = function() {
  document.getElementById('libOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  initUserLevelUI();
  renderLibGrid();
};

// ── 9. Adapt My Plan system ─────────────────────────────────
let currentAdaptEquip = 'all';

// Show adapt bar when a plan is rendered
function showAdaptBar() {
  const bar = document.getElementById('adaptBar');
  if (bar) bar.style.display = 'block';
  currentAdaptEquip = 'all';
  document.querySelectorAll('.adapt-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.equip === 'all');
  });
  document.getElementById('adaptPreview').innerHTML = '';
}

window.setAdaptEquip = function(equip, btn) {
  currentAdaptEquip = equip;
  document.querySelectorAll('.adapt-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  applyAdaptation(equip);
};

function applyAdaptation(equip) {
  const preview = document.getElementById('adaptPreview');
  if (!currentPlan || equip === 'all') {
    preview.innerHTML = '';
    if (equip === 'all') {
      // Restore original plan
      renderWorkout(currentPlan.workout_plan);
    }
    return;
  }

  const adaptMap = EQUIP_ADAPT[equip] || {};
  const swaps = [];

  // Walk every exercise in the plan to find what would change
  Object.values(currentPlan.workout_plan).forEach(exercises => {
    exercises.forEach(ex => {
      const newId = adaptMap[ex.exercise];
      if (newId === undefined) return; // no swap needed
      if (newId === null) return;      // incompatible, skip silently
      const newEx = EXERCISE_MAP[newId];
      if (!newEx) return;
      if (ex.exercise === newEx.name) return; // already same
      if (!swaps.find(s => s.from === ex.exercise)) {
        swaps.push({ from: ex.exercise, to: newEx.name, toId: newId });
      }
    });
  });

  if (swaps.length === 0) {
    preview.innerHTML = `<div class="adapt-no-changes">✓ Your current plan already works well with <strong>${equip === 'none' ? 'no equipment' : equip}</strong>.</div>`;
  } else {
    preview.innerHTML = swaps.map(s => `
      <div class="adapt-swap-row">
        <span class="adapt-swap-from">${s.from}</span>
        <span class="adapt-swap-arrow">→</span>
        <span class="adapt-swap-to">${s.to}</span>
        <span class="adapt-swap-badge">${equip === 'none' ? '🤸 Bodyweight' : equip}</span>
      </div>`).join('');
  }

  // Actually re-render workout grid with adapted exercises
  const adaptedPlan = {};
  Object.entries(currentPlan.workout_plan).forEach(([day, exercises]) => {
    adaptedPlan[day] = exercises.map(ex => {
      const newId = adaptMap[ex.exercise];
      if (!newId) return ex;
      const newEx = EXERCISE_MAP[newId];
      if (!newEx) return ex;
      return {
        exercise:     newEx.name,
        sets:         ex.sets,
        reps:         ex.reps,
        instructions: newEx.instructions,
        youtube:      newEx.youtube || ex.youtube,
      };
    });
  });

  renderWorkout(adaptedPlan);
  if (swaps.length > 0) showToast(`⚡ ${swaps.length} exercise${swaps.length > 1 ? 's' : ''} adapted for ${equip === 'none' ? 'no equipment' : equip}`);
}

// ── 10. Hook showAdaptBar into the plan render flow ─────────
const _baseRenderResults = renderResults;
window.renderResults = function(data) {
  _baseRenderResults(data);
  showAdaptBar();
};

// ── 11. DOMContentLoaded — init level UI ────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUserLevelUI();
});
