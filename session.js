/* Session Manager — Exercise logging, sets, volume tracking, recap */
var SessionManager = (function () {
    'use strict';
    var STORAGE_KEY = 'muscle-timer-sessions';
    var PRESETS_KEY = 'muscle-timer-presets';
    var sessionExercises = [];
    var sessionStart = null;
    var lastWeightUsed = {}; // Tracks last weight per exercise index for pre-filling

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
        // Presets
        document.getElementById('load-preset-btn').addEventListener('click', openPresetsModal);
        document.getElementById('close-presets-modal').addEventListener('click', closePresetsModal);
        document.getElementById('presets-modal').addEventListener('click', function (e) { if (e.target === this) closePresetsModal(); });
        document.getElementById('save-preset-btn').addEventListener('click', openSavePresetModal);
        document.getElementById('close-save-preset').addEventListener('click', closeSavePresetModal);
        document.getElementById('save-preset-modal').addEventListener('click', function (e) { if (e.target === this) closeSavePresetModal(); });
        document.getElementById('confirm-save-preset').addEventListener('click', confirmSavePreset);
        document.getElementById('preset-name-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmSavePreset(); });
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
        var alreadyIn = sessionExercises.some(function (e) { return e.id === exId; });
        if (alreadyIn && typeof window.showToast === 'function') {
            window.showToast(ex.name + ' est déjà dans la séance', 'warning');
        }
        if (!sessionStart) sessionStart = Date.now();
        var entry = { id: exId, name: ex.name, emoji: ex.emoji, muscle: ex.muscle, sets: [] };
        sessionExercises.push(entry);
        renderSession();
    }

    function removeExercise(index) {
        sessionExercises.splice(index, 1);
        renderSession();
    }

    // ---- Personal Records ----
    function getHistoricalBest(exId) {
        try {
            var sessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            var bestWeight = 0, bestVolume = 0;
            sessions.forEach(function (s) {
                s.exercises.forEach(function (ex) {
                    if (ex.id !== exId) return;
                    ex.sets.forEach(function (set) {
                        if (set.weight > bestWeight) bestWeight = set.weight;
                        var vol = set.weight * set.reps;
                        if (vol > bestVolume) bestVolume = vol;
                    });
                });
            });
            return { bestWeight: bestWeight, bestVolume: bestVolume };
        } catch (e) { return { bestWeight: 0, bestVolume: 0 }; }
    }

    function addSet(exIndex, weight, reps) {
        weight = parseFloat(weight) || 0;
        reps = parseInt(reps) || 0;
        if (reps <= 0) {
            if (typeof window.showToast === 'function') window.showToast('Le nombre de reps doit être ≥ 1', 'warning');
            return;
        }
        if (weight === 0 && typeof window.showToast === 'function') {
            window.showToast('Poids à 0 kg — exercice au poids de corps ?', 'info');
        }

        var ex = sessionExercises[exIndex];
        var historical = getHistoricalBest(ex.id);
        var isNewWeightPR = weight > historical.bestWeight && historical.bestWeight > 0;
        var isNewVolumePR = (weight * reps) > historical.bestVolume && historical.bestVolume > 0;

        ex.sets.push({ weight: weight, reps: reps, isPR: isNewWeightPR || isNewVolumePR });
        lastWeightUsed[exIndex] = weight;

        if ((isNewWeightPR || isNewVolumePR) && typeof window.showToast === 'function') {
            var prMsg = isNewWeightPR ? '🏆 Nouveau record de poids !' : '🏆 Nouveau record de volume !';
            window.showToast(prMsg, 'success');
        }
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
            document.getElementById('save-preset-btn').style.display = 'none';
            document.getElementById('session-notes-wrap').style.display = 'none';
            return;
        }
        empty.style.display = 'none';
        stats.style.display = '';
        endBtn.style.display = '';
        document.getElementById('save-preset-btn').style.display = '';
        document.getElementById('session-notes-wrap').style.display = '';

        var totalSets = 0, totalVolume = 0;
        list.innerHTML = '';

        sessionExercises.forEach(function (entry, exIdx) {
            var card = document.createElement('div');
            card.className = 'exercise-card';

            // Header (safe DOM construction)
            var header = document.createElement('div');
            header.className = 'exo-card-header';

            var info = document.createElement('div');
            info.className = 'exo-card-info';
            var emojiSpan = document.createElement('span');
            emojiSpan.className = 'exo-card-emoji';
            emojiSpan.textContent = entry.emoji;
            var nameDiv = document.createElement('div');
            var nameSpan = document.createElement('span');
            nameSpan.className = 'exo-card-name';
            nameSpan.textContent = entry.name;
            var muscleSpan = document.createElement('span');
            muscleSpan.className = 'exo-card-muscle';
            muscleSpan.textContent = entry.muscle;
            nameDiv.appendChild(nameSpan);
            nameDiv.appendChild(muscleSpan);
            info.appendChild(emojiSpan);
            info.appendChild(nameDiv);

            var actions = document.createElement('div');
            actions.className = 'exo-card-actions';
            var infoBtn = document.createElement('button');
            infoBtn.className = 'exo-info-btn';
            infoBtn.dataset.id = entry.id;
            infoBtn.textContent = 'ℹ️';
            var removeBtn = document.createElement('button');
            removeBtn.className = 'exo-remove-btn';
            removeBtn.dataset.idx = exIdx;
            removeBtn.textContent = '✕';
            actions.appendChild(infoBtn);
            actions.appendChild(removeBtn);

            header.appendChild(info);
            header.appendChild(actions);
            card.appendChild(header);

            // Sets list
            var setsList = document.createElement('div');
            setsList.className = 'sets-list';

            entry.sets.forEach(function (s, sIdx) {
                var vol = s.weight * s.reps;
                totalSets++;
                totalVolume += vol;

                var row = document.createElement('div');
                row.className = 'set-row';

                var numSpan = document.createElement('span');
                numSpan.className = 'set-number';
                numSpan.textContent = 'Série ' + (sIdx + 1);

                var detailSpan = document.createElement('span');
                detailSpan.className = 'set-detail';
                detailSpan.textContent = s.weight + ' kg × ' + s.reps + ' reps';
                if (s.isPR) {
                    var badge = document.createElement('span');
                    badge.className = 'pr-badge';
                    badge.textContent = '🏆 PR';
                    detailSpan.appendChild(badge);
                }

                var volSpan = document.createElement('span');
                volSpan.className = 'set-volume';
                volSpan.textContent = vol + ' kg';

                var delBtn = document.createElement('button');
                delBtn.className = 'set-remove';
                delBtn.dataset.ex = exIdx;
                delBtn.dataset.set = sIdx;
                delBtn.textContent = '✕';

                row.appendChild(numSpan);
                row.appendChild(detailSpan);
                row.appendChild(volSpan);
                row.appendChild(delBtn);
                setsList.appendChild(row);
            });
            card.appendChild(setsList);

            // Add-set form
            var form = document.createElement('div');
            form.className = 'add-set-form';
            var wInput = document.createElement('input');
            wInput.type = 'number'; wInput.className = 'set-input';
            wInput.placeholder = 'kg'; wInput.min = '0'; wInput.step = '0.5';
            wInput.dataset.field = 'weight-' + exIdx;
            if (lastWeightUsed[exIdx] !== undefined) wInput.value = lastWeightUsed[exIdx];
            var sep = document.createElement('span');
            sep.className = 'set-separator'; sep.textContent = '×';
            var rInput = document.createElement('input');
            rInput.type = 'number'; rInput.className = 'set-input';
            rInput.placeholder = 'reps'; rInput.min = '1';
            rInput.dataset.field = 'reps-' + exIdx;
            var addBtn = document.createElement('button');
            addBtn.className = 'add-set-btn'; addBtn.dataset.ex = exIdx;
            addBtn.textContent = '✓';
            form.appendChild(wInput); form.appendChild(sep);
            form.appendChild(rInput); form.appendChild(addBtn);
            card.appendChild(form);

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
        if (sessionExercises.length === 0) return;
        var duration = sessionStart ? Math.round((Date.now() - sessionStart) / 60000) : 0;
        var totalSets = 0, totalVolume = 0;
        var notes = (document.getElementById('session-notes').value || '').trim();
        sessionExercises.forEach(function (ex) {
            ex.sets.forEach(function (s) { totalSets++; totalVolume += s.weight * s.reps; });
        });

        // Save session
        var session = {
            date: new Date().toISOString(),
            duration: duration,
            notes: notes,
            exercises: sessionExercises.map(function (ex) {
                return { id: ex.id, name: ex.name, emoji: ex.emoji, muscle: ex.muscle, sets: ex.sets.slice() };
            }),
            totalVolume: totalVolume,
            totalSets: totalSets
        };
        saveSession(session);

        // Show recap stats
        document.getElementById('recap-exercises').textContent = sessionExercises.length;
        document.getElementById('recap-sets').textContent = totalSets;
        document.getElementById('recap-volume').textContent = totalVolume + ' kg';
        document.getElementById('recap-duration').textContent = duration + 'min';

        // Recap details — safe DOM construction (no innerHTML with user data)
        var details = document.getElementById('recap-details');
        details.innerHTML = '';
        sessionExercises.forEach(function (ex) {
            var exVol = 0;
            var card = document.createElement('div');
            card.className = 'recap-exo-card';

            var hdr = document.createElement('div');
            hdr.className = 'recap-exo-header';
            var nameSpan = document.createElement('span');
            nameSpan.textContent = ex.emoji + ' ' + ex.name;
            var volSpan = document.createElement('span');
            volSpan.className = 'recap-exo-volume';

            var setsDiv = document.createElement('div');
            setsDiv.className = 'recap-exo-sets';
            ex.sets.forEach(function (s) {
                exVol += s.weight * s.reps;
                var tag = document.createElement('span');
                tag.className = 'recap-set';
                tag.textContent = s.weight + 'kg × ' + s.reps;
                if (s.isPR) {
                    var badge = document.createElement('span');
                    badge.className = 'pr-badge';
                    badge.textContent = '🏆 PR';
                    tag.appendChild(badge);
                }
                setsDiv.appendChild(tag);
            });
            volSpan.textContent = exVol + ' kg';
            hdr.appendChild(nameSpan);
            hdr.appendChild(volSpan);
            card.appendChild(hdr);
            card.appendChild(setsDiv);
            details.appendChild(card);
        });

        // Notes dans le récap
        var notesBlock = document.getElementById('recap-notes-block');
        var notesText  = document.getElementById('recap-notes-text');
        if (notes) {
            notesText.textContent = notes;
            notesBlock.style.display = '';
        } else {
            notesBlock.style.display = 'none';
        }

        document.getElementById('recap-modal').classList.add('open');
    }

    function resetSession() {
        sessionExercises = [];
        sessionStart = null;
        lastWeightUsed = {};
        var notesEl = document.getElementById('session-notes');
        if (notesEl) notesEl.value = '';
        renderSession();
    }

    function saveSession(session) {
        try {
            var sessions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
            sessions.unshift(session);
            if (sessions.length > 100) sessions = sessions.slice(0, 100);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        } catch (e) {
            var msg = e.name === 'QuotaExceededError'
                ? 'Stockage plein ! Exportez vos données avant de continuer.'
                : 'Erreur de sauvegarde. Données non enregistrées.';
            if (typeof window.showToast === 'function') window.showToast(msg, 'error');
            console.error('[Session] Save error:', e);
        }
    }

    function getSessions() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
    }

    function clearSessions() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
    }

    // ---- PRESETS ----
    function getPresets() {
        try { return JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch (e) { return []; }
    }
    function savePresets(presets) {
        try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch (e) { console.error('[Presets] Save error:', e); }
    }
    function openPresetsModal() {
        renderPresetsList();
        document.getElementById('presets-modal').classList.add('open');
    }
    function closePresetsModal() { document.getElementById('presets-modal').classList.remove('open'); }
    function openSavePresetModal() {
        document.getElementById('preset-name-input').value = '';
        document.getElementById('save-preset-modal').classList.add('open');
        setTimeout(function () { document.getElementById('preset-name-input').focus(); }, 200);
    }
    function closeSavePresetModal() { document.getElementById('save-preset-modal').classList.remove('open'); }
    function confirmSavePreset() {
        var name = document.getElementById('preset-name-input').value.trim();
        if (!name) { document.getElementById('preset-name-input').focus(); return; }
        if (sessionExercises.length === 0) return;
        var preset = {
            id: Date.now().toString(36),
            name: name,
            exercises: sessionExercises.map(function (ex) { return { id: ex.id, name: ex.name, emoji: ex.emoji, muscle: ex.muscle }; })
        };
        var presets = getPresets();
        presets.unshift(preset);
        if (presets.length > 20) presets = presets.slice(0, 20);
        savePresets(presets);
        closeSavePresetModal();
        if (typeof window.showToast === 'function') window.showToast('Preset "' + name + '" sauvegardé !', 'success');
    }
    function loadPreset(presetId) {
        var presets = getPresets();
        var preset = null;
        for (var i = 0; i < presets.length; i++) { if (presets[i].id === presetId) { preset = presets[i]; break; } }
        if (!preset) return;
        sessionExercises = [];
        sessionStart = Date.now();
        for (var j = 0; j < preset.exercises.length; j++) {
            var ex = preset.exercises[j];
            sessionExercises.push({ id: ex.id, name: ex.name, emoji: ex.emoji, muscle: ex.muscle, sets: [] });
        }
        renderSession();
        closePresetsModal();
    }
    function deletePreset(presetId) {
        var presets = getPresets();
        presets = presets.filter(function (p) { return p.id !== presetId; });
        savePresets(presets);
        renderPresetsList();
    }
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderPresetsList() {
        var list = document.getElementById('presets-list');
        var empty = document.getElementById('presets-empty');
        var presets = getPresets();
        if (presets.length === 0) { list.innerHTML = ''; empty.style.display = ''; return; }
        empty.style.display = 'none';
        var html = '';
        for (var i = 0; i < presets.length; i++) {
            var p = presets[i];
            var names = p.exercises.map(function (e) { return escapeHtml(e.name); }).join(', ');
            html += '<div class="preset-card" data-preset-id="' + escapeHtml(p.id) + '">';
            html += '<span class="preset-card-emoji">\u2b50</span>';
            html += '<div class="preset-card-info">';
            html += '<span class="preset-card-name">' + escapeHtml(p.name) + '</span>';
            html += '<span class="preset-card-detail">' + p.exercises.length + ' exos \u2022 ' + names + '</span>';
            html += '</div>';
            html += '<button class="preset-card-delete" data-delete-id="' + escapeHtml(p.id) + '" title="Supprimer">\ud83d\uddd1\ufe0f</button>';
            html += '</div>';
        }
        list.innerHTML = html;
        list.onclick = function (e) {
            var delBtn = e.target.closest('.preset-card-delete');
            if (delBtn) { e.stopPropagation(); deletePreset(delBtn.dataset.deleteId); return; }
            var card = e.target.closest('.preset-card');
            if (card) loadPreset(card.dataset.presetId);
        };
    }

    return { init: init, getSessions: getSessions, clearSessions: clearSessions };
})();
