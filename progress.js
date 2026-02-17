/* ========================================
   MUSCLE TIMER — Progress Charts
   Using Chart.js for exercise progression
   ======================================== */

const ProgressManager = (function () {
    'use strict';

    let dom = {};
    let chartInstance = null;

    function init() {
        dom = {
            progressTab: document.getElementById('tab-progress'),
            progressExerciseSelect: document.getElementById('progress-exercise-select'),
            progressWeightSelect: document.getElementById('progress-weight-select'),
            chartContainer: document.getElementById('chart-container'),
            chartCanvas: document.getElementById('progress-chart'),
            noDataMsg: document.getElementById('no-data-msg'),
            historyList: document.getElementById('history-list'),
            clearHistoryBtn: document.getElementById('clear-history-btn')
        };

        bindEvents();
    }

    function onTabActivated() {
        populateExerciseSelect();
        renderHistory();
    }

    function populateExerciseSelect() {
        const sessions = SessionManager.getSessions();
        const exerciseSet = new Map();

        for (const session of sessions) {
            for (const exo of session.exercises) {
                if (!exerciseSet.has(exo.id)) {
                    exerciseSet.set(exo.id, { id: exo.id, name: exo.name, emoji: exo.emoji });
                }
            }
        }

        const select = dom.progressExerciseSelect;
        const currentValue = select.value;
        select.innerHTML = '<option value="">— Choisir un exercice —</option>';

        for (const [id, exo] of exerciseSet) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${exo.emoji} ${exo.name}`;
            select.appendChild(opt);
        }

        if (currentValue && exerciseSet.has(currentValue)) {
            select.value = currentValue;
        }

        if (exerciseSet.size === 0) {
            dom.noDataMsg.style.display = 'block';
            dom.chartContainer.style.display = 'none';
            dom.progressWeightSelect.parentElement.style.display = 'none';
        }
    }

    function populateWeightSelect(exerciseId) {
        const sessions = SessionManager.getSessions();
        const weights = new Set();

        for (const session of sessions) {
            for (const exo of session.exercises) {
                if (exo.id === exerciseId) {
                    for (const set of exo.sets) {
                        weights.add(set.weight);
                    }
                }
            }
        }

        const select = dom.progressWeightSelect;
        select.innerHTML = '<option value="all">Tous les poids</option>';

        const sortedWeights = [...weights].sort((a, b) => a - b);
        for (const w of sortedWeights) {
            const opt = document.createElement('option');
            opt.value = w;
            opt.textContent = `${w} kg`;
            select.appendChild(opt);
        }

        select.parentElement.style.display = sortedWeights.length > 0 ? 'flex' : 'none';
    }

    function renderChart(exerciseId, weightFilter) {
        const sessions = SessionManager.getSessions();

        // Collect data points: { date, maxReps, weight, volume }
        const dataPoints = [];

        for (const session of sessions) {
            for (const exo of session.exercises) {
                if (exo.id !== exerciseId) continue;

                const filteredSets = weightFilter === 'all'
                    ? exo.sets
                    : exo.sets.filter(s => s.weight === parseFloat(weightFilter));

                if (filteredSets.length === 0) continue;

                const maxReps = Math.max(...filteredSets.map(s => s.reps));
                const bestSet = filteredSets.reduce((best, s) =>
                    (s.weight * s.reps > best.weight * best.reps) ? s : best
                    , filteredSets[0]);
                const totalVolume = filteredSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

                dataPoints.push({
                    date: new Date(session.date),
                    dateLabel: formatDate(session.date),
                    maxReps,
                    bestWeight: bestSet.weight,
                    bestSetReps: bestSet.reps,
                    totalVolume
                });
            }
        }

        if (dataPoints.length === 0) {
            dom.chartContainer.style.display = 'none';
            dom.noDataMsg.style.display = 'block';
            dom.noDataMsg.textContent = 'Aucune donnée pour cet exercice';
            return;
        }

        dom.chartContainer.style.display = 'block';
        dom.noDataMsg.style.display = 'none';

        // Sort by date
        dataPoints.sort((a, b) => a.date - b.date);

        const labels = dataPoints.map(d => d.dateLabel);
        const repsData = dataPoints.map(d => d.maxReps);
        const volumeData = dataPoints.map(d => d.totalVolume);

        // Destroy old chart
        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = dom.chartCanvas.getContext('2d');
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c5cfc';
        const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-secondary').trim() || '#ff6b6b';

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Reps max',
                        data: repsData,
                        borderColor: accentColor,
                        backgroundColor: accentColor + '33',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: accentColor,
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Volume (kg)',
                        data: volumeData,
                        borderColor: secondaryColor,
                        backgroundColor: secondaryColor + '22',
                        fill: false,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 7,
                        pointBackgroundColor: secondaryColor,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#f0f0f5',
                            font: { family: 'Inter', size: 11 },
                            usePointStyle: true,
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(16, 16, 40, 0.9)',
                        titleColor: '#f0f0f5',
                        bodyColor: '#f0f0f5',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'Inter' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: 'rgba(240,240,245,0.5)', font: { family: 'Inter', size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Reps',
                            color: 'rgba(240,240,245,0.5)',
                            font: { family: 'Inter', size: 11 }
                        },
                        ticks: {
                            color: 'rgba(240,240,245,0.5)',
                            font: { family: 'Inter', size: 10 },
                            stepSize: 1
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Volume (kg)',
                            color: 'rgba(240,240,245,0.5)',
                            font: { family: 'Inter', size: 11 }
                        },
                        ticks: {
                            color: 'rgba(240,240,245,0.5)',
                            font: { family: 'Inter', size: 10 }
                        },
                        grid: { drawOnChartArea: false },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // ---- Session history ----
    function renderHistory() {
        const sessions = SessionManager.getSessions();
        const list = dom.historyList;

        if (sessions.length === 0) {
            list.innerHTML = '<p class="no-history">Aucune séance enregistrée</p>';
            dom.clearHistoryBtn.style.display = 'none';
            return;
        }

        dom.clearHistoryBtn.style.display = 'block';

        // Show most recent first
        const reversed = [...sessions].reverse();
        list.innerHTML = reversed.slice(0, 20).map(session => {
            const dateStr = formatDate(session.date);
            const volume = session.totalVolume || 0;
            const sets = session.totalSets || 0;
            const exoCount = session.exercises ? session.exercises.length : 0;
            const durationStr = session.duration ? formatDuration(session.duration) : '—';

            return `
        <div class="history-card">
          <div class="history-header">
            <span class="history-date">📅 ${dateStr}</span>
            <span class="history-duration">⏱️ ${durationStr}</span>
          </div>
          <div class="history-stats">
            <span>🏋️ ${exoCount} exo</span>
            <span>📊 ${sets} séries</span>
            <span>💪 ${formatVolumeShort(volume)}</span>
          </div>
          <div class="history-exercises">
            ${(session.exercises || []).map(e => `<span class="history-exo-tag">${e.emoji} ${e.name}</span>`).join('')}
          </div>
        </div>
      `;
        }).join('');
    }

    function formatDate(isoStr) {
        const d = new Date(isoStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    function formatDuration(minutes) {
        if (minutes < 60) return `${minutes}min`;
        const hours = Math.floor(minutes / 60);
        const rem = minutes % 60;
        return `${hours}h${rem.toString().padStart(2, '0')}`;
    }

    function formatVolumeShort(kg) {
        if (kg >= 1000) return `${(kg / 1000).toFixed(1)}T`;
        return `${Math.round(kg)}kg`;
    }

    // ---- Events ----
    function bindEvents() {
        dom.progressExerciseSelect.addEventListener('change', () => {
            const exoId = dom.progressExerciseSelect.value;
            if (!exoId) {
                dom.chartContainer.style.display = 'none';
                dom.progressWeightSelect.parentElement.style.display = 'none';
                dom.noDataMsg.style.display = 'block';
                dom.noDataMsg.textContent = 'Sélectionne un exercice pour voir ta progression';
                return;
            }
            populateWeightSelect(exoId);
            renderChart(exoId, 'all');
        });

        dom.progressWeightSelect.addEventListener('change', () => {
            const exoId = dom.progressExerciseSelect.value;
            if (exoId) renderChart(exoId, dom.progressWeightSelect.value);
        });

        dom.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Supprimer tout l\'historique des séances ?')) {
                try { localStorage.removeItem('muscle-timer-sessions'); } catch (e) { }
                renderHistory();
                populateExerciseSelect();
                if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
                dom.chartContainer.style.display = 'none';
                dom.noDataMsg.style.display = 'block';
                dom.noDataMsg.textContent = 'Aucune donnée disponible';
            }
        });
    }

    return { init, onTabActivated };
})();
