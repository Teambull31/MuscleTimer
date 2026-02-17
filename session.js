/* Session Manager — Exercise logging, sets, volume tracking, recap */
var SessionManager = (function () {
    'use strict';
    var STORAGE_KEY = 'muscle-timer-sessions';
    var sessionExercises = [];
    var sessionStart = null;

    function init() {
        document.getElementById('add-exercise-btn').addEventListener('click', openExerciseModal);
        document.getElementById('close-exercise-modal').addEventListener('click', closeExerciseModal);
        document.getElementById('exercise-modal').addEventListener('click', function (e) { if (e.target === this) closeExerciseModal(); });
        document.getElementById('exercise-search').addEventListener('input', filterExercises);
        document.getElementById('close-detail-modal').addEventListener('click', closeDetailModal);
        document.getElementById('exercise-detail-modal').addEventListener('click', function (e) { if (e.target === this) closeDetailModal(); });
        document.getElementById('end-session-btn').addEventListener('click', endSession);
        document.getElementById('close-recap-modal').addEventListener('click', function () {
            closeRecapModal();
            // Switch to progress tab
            document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === 'progress'); });
            document.querySelectorAll('.tab-content').forEach(function (tc) { tc.classList.toggle('active', tc.id === 'tab-progress'); });
            if (typeof ProgressManager !== 'undefined') ProgressManager.onTabActivated();
        });
        document.getElementById('recap-modal').addEventListener('click', function (e) { if (e.target === this) closeRecapModal(); });
        document.getElementById('new-session-btn').addEventListener('click', function () { closeRecapModal(); resetSession(); });
        buildMuscleFilter();
        filterExercises();
    }

    function buildMuscleFilter() {
        var container = document.getElementById('muscle-filter');
        var chips = ['Tous'].concat(ExercisesDB.muscles);
        container.innerHTML = '';
        chips.forEach(function (m) {
            var btn = document.createElement('button');
            btn.className = 'muscle-chip' + (m === 'Tous' ? ' active' : '');
            btn.textContent = (ExercisesDB.muscleEmojis[m] || '🔍') + ' ' + m;
            btn.dataset.muscle = m;
            btn.addEventListener('click', function () {
                container.querySelectorAll('.muscle-chip').forEach(function (c) { c.classList.remove('active'); });
                btn.classList.add('active');
                filterExercises();
            });
            container.appendChild(btn);
        });
    }

    function filterExercises() {
        var query = document.getElementById('exercise-search').value;
        var activeChip = document.querySelector('.muscle-chip.active');
        var muscleFilter = activeChip ? activeChip.dataset.muscle : 'Tous';
        var results = ExercisesDB.search(query, muscleFilter);
        var container = document.getElementById('exercise-results');
        if (results.length === 0) {
            container.innerHTML = '<div class="no-results">Aucun exercice trouvé</div>';
            return;
        }
        container.innerHTML = '';
        results.forEach(function (ex) {
            var item = document.createElement('button');
            item.className = 'exercise-result-item';
            item.innerHTML = '<span class="eri-emoji">' + ex.emoji + '</span><div class="eri-info"><span class="eri-name">' + ex.name + '</span><span class="eri-muscle">' + ex.muscle + '</span></div><span class="eri-add">+</span>';
            item.addEventListener('click', function () { addExercise(ex.id); closeExerciseModal(); });
            container.appendChild(item);
        });
    }

    function openExerciseModal() {
        document.getElementById('exercise-search').value = '';
        filterExercises();
        document.getElementById('exercise-modal').classList.add('open');
    }
    function closeExerciseModal() { document.getElementById('exercise-modal').classList.remove('open'); }

    function openDetailModal(exId) {
        var ex = ExercisesDB.getById(exId);
        if (!ex) return;
        document.getElementById('detail-name').textContent = ex.name;
        document.getElementById('detail-muscle').textContent = ex.emoji + ' ' + ex.muscle;
        document.getElementById('detail-execution').textContent = ex.execution;
        document.getElementById('detail-tips').textContent = ex.tips;
        document.getElementById('exercise-detail-modal').classList.add('open');
    }
    function closeDetailModal() { document.getElementById('exercise-detail-modal').classList.remove('open'); }
    function closeRecapModal() { document.getElementById('recap-modal').classList.remove('open'); }

    function addExercise(exId) {
        var ex = ExercisesDB.getById(exId);
        if (!ex) return;
        if (!sessionStart) sessionStart = Date.now();
        var entry = { id: exId, name: ex.name, emoji: ex.emoji, muscle: ex.muscle, sets: [] };
        sessionExercises.push(entry);
        renderSession();
    }

    function removeExercise(index) {
        sessionExercises.splice(index, 1);
        renderSession();
    }

    function addSet(exIndex, weight, reps) {
        weight = parseFloat(weight) || 0;
        reps = parseInt(reps) || 0;
        if (reps <= 0) return;
        sessionExercises[exIndex].sets.push({ weight: weight, reps: reps });
        renderSession();
    }

    function removeSet(exIndex, setIndex) {
        sessionExercises[exIndex].sets.splice(setIndex, 1);
        renderSession();
    }

    function renderSession() {
        var list = document.getElementById('exercise-list');
        var empty = document.getElementById('session-empty');
        var stats = document.getElementById('session-stats');
        var endBtn = document.getElementById('end-session-btn');

        if (sessionExercises.length === 0) {
            list.innerHTML = '';
            empty.style.display = '';
            stats.style.display = 'none';
            endBtn.style.display = 'none';
            return;
        }
        empty.style.display = 'none';
        stats.style.display = '';
        endBtn.style.display = '';

        var totalSets = 0, totalVolume = 0;
        list.innerHTML = '';

        sessionExercises.forEach(function (entry, exIdx) {
            var card = document.createElement('div');
            card.className = 'exercise-card';
            var setsHtml = '';
            entry.sets.forEach(function (s, sIdx) {
                var vol = s.weight * s.reps;
                totalSets++;
                totalVolume += vol;
                setsHtml += '<div class="set-row"><span class="set-number">Série ' + (sIdx + 1) + '</span><span class="set-detail">' + s.weight + ' kg × ' + s.reps + ' reps</span><span class="set-volume">' + vol + ' kg</span><button class="set-remove" data-ex="' + exIdx + '" data-set="' + sIdx + '">✕</button></div>';
            });

            card.innerHTML = '<div class="exo-card-header"><div class="exo-card-info"><span class="exo-card-emoji">' + entry.emoji + '</span><div><span class="exo-card-name">' + entry.name + '</span><span class="exo-card-muscle">' + entry.muscle + '</span></div></div><div class="exo-card-actions"><button class="exo-info-btn" data-id="' + entry.id + '">ℹ️</button><button class="exo-remove-btn" data-idx="' + exIdx + '">✕</button></div></div>' +
                '<div class="sets-list">' + setsHtml + '</div>' +
                '<div class="add-set-form"><input type="number" class="set-input" placeholder="kg" min="0" step="0.5" data-field="weight-' + exIdx + '"><span class="set-separator">×</span><input type="number" class="set-input" placeholder="reps" min="1" data-field="reps-' + exIdx + '"><button class="add-set-btn" data-ex="' + exIdx + '">✓</button></div>';
            list.appendChild(card);
        });

        // Event delegation
        list.querySelectorAll('.exo-info-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { openDetailModal(btn.dataset.id); });
        });
        list.querySelectorAll('.exo-remove-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { removeExercise(parseInt(btn.dataset.idx)); });
        });
        list.querySelectorAll('.set-remove').forEach(function (btn) {
            btn.addEventListener('click', function () { removeSet(parseInt(btn.dataset.ex), parseInt(btn.dataset.set)); });
        });
        list.querySelectorAll('.add-set-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.dataset.ex);
                var w = list.querySelector('[data-field="weight-' + idx + '"]').value;
                var r = list.querySelector('[data-field="reps-' + idx + '"]').value;
                addSet(idx, w, r);
            });
        });
        // Enter key on inputs
        list.querySelectorAll('.set-input').forEach(function (inp) {
            inp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    var match = inp.dataset.field.match(/\d+/);
                    if (match) {
                        var idx = parseInt(match[0]);
                        var w = list.querySelector('[data-field="weight-' + idx + '"]').value;
                        var r = list.querySelector('[data-field="reps-' + idx + '"]').value;
                        addSet(idx, w, r);
                    }
                }
            });
        });

        document.getElementById('stat-exercises').textContent = sessionExercises.length;
        document.getElementById('stat-sets').textContent = totalSets;
        document.getElementById('stat-volume').textContent = totalVolume + ' kg';
    }

    function endSession() {
        console.log('[Session] endSession called, exercises:', sessionExercises.length);
        if (sessionExercises.length === 0) return;
        var duration = sessionStart ? Math.round((Date.now() - sessionStart) / 60000) : 0;
        var totalSets = 0, totalVolume = 0;
        sessionExercises.forEach(function (ex) {
            ex.sets.forEach(function (s) { totalSets++; totalVolume += s.weight * s.reps; });
        });

        // Save session
        var session = {
            date: new Date().toISOString(),
            duration: duration,
            exercises: sessionExercises.map(function (ex) {
                return { id: ex.id, name: ex.name, emoji: ex.emoji, muscle: ex.muscle, sets: ex.sets.slice() };
            }),
            totalVolume: totalVolume,
            totalSets: totalSets
        };
        saveSession(session);

        // Show recap
        document.getElementById('recap-exercises').textContent = sessionExercises.length;
        document.getElementById('recap-sets').textContent = totalSets;
        document.getElementById('recap-volume').textContent = totalVolume + ' kg';
        document.getElementById('recap-duration').textContent = duration + 'min';

        var details = document.getElementById('recap-details');
        details.innerHTML = '';
        sessionExercises.forEach(function (ex) {
            var exVol = 0;
            var setsHtml = '';
            ex.sets.forEach(function (s) {
                exVol += s.weight * s.reps;
                setsHtml += '<span class="recap-set">' + s.weight + 'kg × ' + s.reps + '</span>';
            });
            details.innerHTML += '<div class="recap-exo-card"><div class="recap-exo-header"><span>' + ex.emoji + ' ' + ex.name + '</span><span class="recap-exo-volume">' + exVol + ' kg</span></div><div class="recap-exo-sets">' + setsHtml + '</div></div>';
        });

        document.getElementById('recap-modal').classList.add('open');
    }

    function resetSession() {
        sessionExercises = [];
        sessionStart = null;
        renderSession();
    }

    function saveSession(session) {
        try {
            var sessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            sessions.unshift(session);
            if (sessions.length > 100) sessions = sessions.slice(0, 100);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            console.log('[Session] Saved! Total sessions:', sessions.length);
        } catch (e) { console.error('[Session] Save error:', e); }
    }

    function getSessions() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
    }

    function clearSessions() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
    }

    return { init: init, getSessions: getSessions, clearSessions: clearSessions };
})();
