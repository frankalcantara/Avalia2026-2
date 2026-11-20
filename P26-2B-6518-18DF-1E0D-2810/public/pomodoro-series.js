export const MAX_COMPLETED_IN_SERIES = 8;
export const MAX_SHORT_BREAK_SECONDS = 30 * 60;
export const MAX_LONG_BREAK_SECONDS = 60 * 60;

const STORAGE_KEY_PREFIX = "focusflow.pomodoro.series.v3:";
const STORAGE_STATE_KEY_PREFIX = "focusflow.pomodoro.series.state:";
const LEGACY_V2_BACKUP_KEY_PREFIX = "focusflow.pomodoro.series.v3.backup:";
const LEGACY_V2_STORAGE_KEY_PREFIX = "focusflow.pomodoro.series.v2:";
const LEGACY_V1_STORAGE_KEY_PREFIX = "focusflow.pomodoro.series.v1:";
const STORAGE_VERSION = 3;
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const LEGACY_V2_PROCESSED_CYCLE_LIMIT = 64;
const STORAGE_STATE_MARKER = "v3-active";

function isValidCycleId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return false;
  const numericId = Number(value);
  return Number.isSafeInteger(numericId) && numericId > 0
    && numericId < MAX_SAFE_INTEGER && String(numericId) === value;
}

function normalizeCycleId(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0 || value >= MAX_SAFE_INTEGER) return null;
    return String(value);
  }
  return isValidCycleId(value) ? value : null;
}

function validTimestamp(value) {
  return Number.isSafeInteger(value) && value > 0 && value < MAX_SAFE_INTEGER
    && Number.isFinite(new Date(value).getTime());
}

function validBreakDuration(seconds, maximum) {
  return Number.isSafeInteger(seconds) && seconds >= 60
    && seconds <= maximum && seconds % 60 === 0;
}

function validSeriesShape(series, version) {
  return Boolean(series)
    && typeof series === "object"
    && series.version === version
    && Number.isSafeInteger(series.completedInSeries)
    && series.completedInSeries >= 0
    && series.completedInSeries <= MAX_COMPLETED_IN_SERIES;
}

function validCycleHistory(series, maximumLength = Infinity) {
  return Array.isArray(series.processedCycleIds)
    && series.processedCycleIds.length <= maximumLength
    && series.processedCycleIds.every(isValidCycleId)
    && new Set(series.processedCycleIds).size === series.processedCycleIds.length;
}

function validSeriesPhase(series) {
  if (series.phase === "focus") {
    return series.breakDeadline === null && series.breakDurationSeconds === 0;
  }
  if (series.phase === "break-short") {
    return validTimestamp(series.breakDeadline)
      && validBreakDuration(series.breakDurationSeconds, MAX_SHORT_BREAK_SECONDS);
  }
  if (series.phase === "break-long") {
    return validTimestamp(series.breakDeadline)
      && validBreakDuration(series.breakDurationSeconds, MAX_LONG_BREAK_SECONDS);
  }
  return false;
}

export function validPomodoroSeries(series) {
  if (!validSeriesShape(series, STORAGE_VERSION)
    || (series.pendingCompletionId !== null && !isValidCycleId(series.pendingCompletionId))
    || !validCycleHistory(series)) {
    return false;
  }
  return validSeriesPhase(series);
}

function validLegacyV2Series(series) {
  return validSeriesShape(series, 2)
    && (series.pendingCompletionId === null || isValidCycleId(series.pendingCompletionId))
    && validCycleHistory(series, LEGACY_V2_PROCESSED_CYCLE_LIMIT)
    && validSeriesPhase(series);
}

function validLegacyV1Series(series) {
  if (!series || typeof series !== "object" || series.version !== 1
    || !Number.isSafeInteger(series.completedInSeries)
    || series.completedInSeries < 0 || series.completedInSeries >= MAX_SAFE_INTEGER) {
    return false;
  }
  return validSeriesPhase(series);
}

function defaultSeries() {
  return {
    version: STORAGE_VERSION,
    completedInSeries: 0,
    phase: "focus",
    breakDeadline: null,
    breakDurationSeconds: 0,
    pendingCompletionId: null,
    processedCycleIds: [],
  };
}

function copySeries(series) {
  return { ...series, processedCycleIds: [...series.processedCycleIds] };
}

function decodeSeries(raw) {
  try {
    const parsed = JSON.parse(raw);
    return validPomodoroSeries(parsed)
      ? { status: "valid", series: copySeries(parsed) }
      : { status: "invalid-structure", series: null };
  } catch {
    return { status: "invalid-json", series: null };
  }
}

function canonicalLegacyV2Series(series) {
  return {
    version: 2,
    completedInSeries: series.completedInSeries,
    phase: series.phase,
    breakDeadline: series.breakDeadline,
    breakDurationSeconds: series.breakDurationSeconds,
    pendingCompletionId: series.pendingCompletionId,
    processedCycleIds: [...series.processedCycleIds],
  };
}

function migrateLegacyV2Series(raw) {
  try {
    const legacy = JSON.parse(raw);
    if (!validLegacyV2Series(legacy)) return null;
    return {
      ...canonicalLegacyV2Series(legacy),
      version: STORAGE_VERSION,
    };
  } catch {
    return null;
  }
}

function recoverCertifiedLegacyV2Series(raw, backupSnapshot) {
  try {
    const legacy = JSON.parse(raw);
    if (!validLegacyV2Series(legacy)
      || backupSnapshot !== JSON.stringify(canonicalLegacyV2Series(legacy))) {
      return null;
    }
    return migrateLegacyV2Series(raw);
  } catch {
    return null;
  }
}

function migrateLegacyV1Series(raw) {
  try {
    const legacy = JSON.parse(raw);
    if (!validLegacyV1Series(legacy)) return null;
    return {
      ...defaultSeries(),
      completedInSeries: Math.min(legacy.completedInSeries, MAX_COMPLETED_IN_SERIES),
      phase: legacy.phase,
      breakDeadline: legacy.breakDeadline,
      breakDurationSeconds: legacy.breakDurationSeconds,
    };
  } catch {
    return null;
  }
}

export function pomodoroSeriesStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function pomodoroSeriesStateKey(userId) {
  return `${STORAGE_STATE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function legacyV2StorageKey(userId) {
  return `${LEGACY_V2_STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function legacyV2BackupKey(userId) {
  return `${LEGACY_V2_BACKUP_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function legacyV1StorageKey(userId) {
  return `${LEGACY_V1_STORAGE_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function validCompletionSettings(settings) {
  return settings
    && Number.isInteger(settings.shortBreakMinutes)
    && settings.shortBreakMinutes >= 1
    && settings.shortBreakMinutes <= 30
    && Number.isInteger(settings.longBreakMinutes)
    && settings.longBreakMinutes >= 1
    && settings.longBreakMinutes <= 60
    && Number.isInteger(settings.longBreakAfter)
    && settings.longBreakAfter >= 2
    && settings.longBreakAfter <= MAX_COMPLETED_IN_SERIES;
}

export function createPomodoroSeriesStore({
  storage,
  locks,
  onChange = () => {},
  onStorageUnavailable = () => {},
  onRecoveryRequired = () => {},
  onSyncUnavailable = () => {},
}) {
  const fallbackQueues = new Map();
  const memoryByUser = new Map();
  const storageUnavailableUsers = new Set();
  const storageWarningsShown = new Set();
  const recoveryWarningsShown = new Set();
  let syncWarningShown = false;

  function apply(userId, series) {
    const copy = copySeries(series);
    memoryByUser.set(userId, copy);
    recoveryWarningsShown.delete(userId);
    onChange(userId, copySeries(copy));
  }

  function reportStorageUnavailable(userId) {
    storageUnavailableUsers.add(userId);
    if (storageWarningsShown.has(userId)) return;
    storageWarningsShown.add(userId);
    onStorageUnavailable(userId);
  }

  function reportRecoveryRequired(userId) {
    if (recoveryWarningsShown.has(userId)) return;
    recoveryWarningsShown.add(userId);
    onRecoveryRequired(userId);
  }

  function reportSyncUnavailable() {
    if (syncWarningShown) return;
    syncWarningShown = true;
    onSyncUnavailable();
  }

  async function withUserLock(userId, operation) {
    let availableLocks;
    try {
      availableLocks = typeof locks === "function" ? locks() : locks;
    } catch {
      availableLocks = null;
    }

    if (typeof availableLocks?.request === "function") {
      return availableLocks.request(
        `focusflow:pomodoro-series:${encodeURIComponent(userId)}`,
        { mode: "exclusive" },
        operation,
      );
    }

    reportSyncUnavailable();
    const previous = fallbackQueues.get(userId) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    fallbackQueues.set(userId, current);
    try {
      return await current;
    } finally {
      if (fallbackQueues.get(userId) === current) fallbackQueues.delete(userId);
    }
  }

  function readStored(userId) {
    if (storageUnavailableUsers.has(userId)) {
      return {
        series: memoryByUser.has(userId) ? copySeries(memoryByUser.get(userId)) : null,
        readable: false,
        migration: false,
        unavailable: true,
      };
    }

    try {
      const currentRaw = storage.getItem(pomodoroSeriesStorageKey(userId));
      if (currentRaw !== null) {
        const decoded = decodeSeries(currentRaw);
        if (decoded.status === "valid") {
          return {
            series: decoded.series,
            readable: true,
            migration: false,
            needsStateMarker: storage.getItem(pomodoroSeriesStateKey(userId)) !== STORAGE_STATE_MARKER,
          };
        }

        const legacyV2Raw = storage.getItem(legacyV2StorageKey(userId));
        const backupSnapshot = storage.getItem(legacyV2BackupKey(userId));
        const recovered = legacyV2Raw === null
          ? null
          : recoverCertifiedLegacyV2Series(legacyV2Raw, backupSnapshot);
        if (recovered) {
          return {
            series: recovered,
            readable: true,
            migration: true,
            legacySource: "v2",
            legacyRaw: legacyV2Raw,
            recoveryBackup: true,
          };
        }
        return { series: null, readable: false, migration: false, corrupt: true };
      }

      const stateMarker = storage.getItem(pomodoroSeriesStateKey(userId));
      const legacyV2Raw = storage.getItem(legacyV2StorageKey(userId));
      if (legacyV2Raw !== null) {
        const backupSnapshot = storage.getItem(legacyV2BackupKey(userId));
        const trustedBackup = recoverCertifiedLegacyV2Series(legacyV2Raw, backupSnapshot);
        if (trustedBackup) {
          return {
            series: trustedBackup,
            readable: true,
            migration: true,
            legacySource: "v2",
            legacyRaw: legacyV2Raw,
            recoveryBackup: true,
          };
        }
        if (stateMarker !== null) {
          return { series: null, readable: false, migration: false, corrupt: true };
        }
        const migrated = migrateLegacyV2Series(legacyV2Raw);
        if (migrated) {
          return {
            series: migrated,
            readable: true,
            migration: true,
            legacySource: "v2",
            legacyRaw: legacyV2Raw,
          };
        }
        return { series: null, readable: false, migration: false, corrupt: true };
      }

      if (stateMarker !== null) {
        return { series: null, readable: false, migration: false, corrupt: true };
      }

      const legacyV1Raw = storage.getItem(legacyV1StorageKey(userId));
      if (legacyV1Raw !== null) {
        const migrated = migrateLegacyV1Series(legacyV1Raw);
        if (migrated) {
          return {
            series: migrated,
            readable: true,
            migration: true,
            legacySource: "v1",
          };
        }
        return { series: null, readable: false, migration: false, corrupt: true };
      }
      return { series: defaultSeries(), readable: true, migration: false };
    } catch {
      reportStorageUnavailable(userId);
      return {
        series: memoryByUser.has(userId) ? copySeries(memoryByUser.get(userId)) : null,
        readable: false,
        migration: false,
        unavailable: true,
      };
    }
  }

  function invalidateLegacyV2Recovery(userId) {
    const key = legacyV2BackupKey(userId);
    const snapshot = storage.getItem(key);
    if (snapshot !== null && snapshot !== "") storage.setItem(key, "");
  }

  function markLegacyV2Recovery(userId, raw) {
    try {
      const legacy = JSON.parse(raw);
      if (!validLegacyV2Series(legacy)) return false;
      if (storage.getItem(legacyV2StorageKey(userId)) !== raw) return false;
      const snapshot = JSON.stringify(canonicalLegacyV2Series(legacy));
      const backupKey = legacyV2BackupKey(userId);
      storage.setItem(backupKey, snapshot);
      return storage.getItem(backupKey) === snapshot
        && storage.getItem(legacyV2StorageKey(userId)) === raw;
    } catch {
      return false;
    }
  }

  function sameSeries(left, right) {
    return left.version === right.version
      && left.completedInSeries === right.completedInSeries
      && left.phase === right.phase
      && left.breakDeadline === right.breakDeadline
      && left.breakDurationSeconds === right.breakDurationSeconds
      && left.pendingCompletionId === right.pendingCompletionId
      && left.processedCycleIds.length === right.processedCycleIds.length
      && left.processedCycleIds.every((id, index) => id === right.processedCycleIds[index]);
  }

  function ensureStateMarker(userId) {
    const key = pomodoroSeriesStateKey(userId);
    if (storage.getItem(key) !== STORAGE_STATE_MARKER) {
      storage.setItem(key, STORAGE_STATE_MARKER);
    }
    return storage.getItem(key) === STORAGE_STATE_MARKER;
  }

  function writeStored(userId, series, { preserveLegacyV2Recovery = false } = {}) {
    if (storageUnavailableUsers.has(userId)) return false;
    try {
      if (!validPomodoroSeries(series)) return false;
      if (!preserveLegacyV2Recovery) invalidateLegacyV2Recovery(userId);
      const serialized = JSON.stringify(series);
      const key = pomodoroSeriesStorageKey(userId);
      storage.setItem(key, serialized);
      const verified = decodeSeries(storage.getItem(key));
      if (verified.status !== "valid" || !sameSeries(verified.series, series)) {
        throw new Error("A sequência Pomodoro não passou na validação após gravação.");
      }
      if (!ensureStateMarker(userId)) {
        throw new Error("Não foi possível registrar a versão ativa da sequência Pomodoro.");
      }
      return true;
    } catch {
      reportStorageUnavailable(userId);
      return false;
    }
  }

  async function read(userId) {
    if (typeof userId !== "string" || !userId) return { saved: false, series: null };
    return withUserLock(userId, async () => {
      const stored = readStored(userId);
      if (stored.corrupt) {
        reportRecoveryRequired(userId);
        return { saved: false, series: null, status: "recovery-required" };
      }
      if (stored.unavailable) {
        return { saved: false, series: stored.series, status: "storage-unavailable" };
      }
      let saved = stored.readable;
      if (stored.migration) {
        saved = writeStored(userId, stored.series, { preserveLegacyV2Recovery: true });
        if (saved && stored.legacySource === "v2" && !stored.recoveryBackup) {
          markLegacyV2Recovery(userId, stored.legacyRaw);
        }
      } else if (stored.needsStateMarker) {
        saved = writeStored(userId, stored.series, { preserveLegacyV2Recovery: true });
      }
      apply(userId, stored.series);
      return { saved, series: copySeries(stored.series), status: saved ? "ok" : "storage-unavailable" };
    });
  }

  async function update(userId, mutate, { preserveCurrentOnFailure = false } = {}) {
    if (typeof userId !== "string" || !userId) return { saved: false, series: null };
    return withUserLock(userId, async () => {
      const stored = readStored(userId);
      if (stored.corrupt) {
        reportRecoveryRequired(userId);
        return { saved: false, series: null, changed: false, storageStatus: "recovery-required" };
      }
      if (stored.unavailable || !stored.series) {
        return { saved: false, series: stored.series, changed: false, storageStatus: "storage-unavailable" };
      }
      const current = stored.series;
      const next = mutate(copySeries(current));
      if (next === null) {
        let saved = stored.readable;
        if (stored.migration) {
          saved = writeStored(userId, current, { preserveLegacyV2Recovery: true });
          if (saved && stored.legacySource === "v2" && !stored.recoveryBackup) {
            markLegacyV2Recovery(userId, stored.legacyRaw);
          }
        } else if (stored.needsStateMarker) {
          saved = writeStored(userId, current, { preserveLegacyV2Recovery: true });
        }
        apply(userId, current);
        return {
          saved,
          series: copySeries(current),
          changed: false,
          storageStatus: saved ? "ok" : "storage-unavailable",
        };
      }
      if (!validPomodoroSeries(next)) {
        throw new TypeError("Tentativa de persistir uma sequência Pomodoro inválida.");
      }

      const saved = stored.readable && writeStored(userId, next);
      const applyNext = saved || !preserveCurrentOnFailure;
      const result = applyNext ? next : current;
      apply(userId, result);
      return {
        saved,
        series: copySeries(result),
        changed: applyNext,
        storageStatus: saved ? "ok" : "storage-unavailable",
      };
    });
  }

  async function prepareCompletion(userId, cycleId) {
    const id = normalizeCycleId(cycleId);
    if (!id) return { saved: false, series: null, changed: false };
    let status = "prepared";
    const prepared = await update(userId, (series) => {
      if (series.processedCycleIds.includes(id)) {
        status = "already-processed";
        return series.pendingCompletionId === id
          ? { ...series, pendingCompletionId: null }
          : null;
      }
      if (series.pendingCompletionId && series.pendingCompletionId !== id) {
        status = "pending-conflict";
        return null;
      }
      return series.pendingCompletionId === id
        ? null
        : { ...series, pendingCompletionId: id };
    }, { preserveCurrentOnFailure: true });
    if (prepared.storageStatus !== "ok") return prepared;
    return { ...prepared, status };
  }

  async function recordCompletion(userId, cycleId, settings, now = Date.now()) {
    const id = normalizeCycleId(cycleId);
    if (!id || !validCompletionSettings(settings) || !validTimestamp(now)) {
      return { saved: false, series: null, changed: false };
    }
    let status = "pending-missing";
    const recorded = await update(userId, (series) => {
      if (series.processedCycleIds.includes(id)) {
        status = "already-processed";
        return series.pendingCompletionId === id
          ? { ...series, pendingCompletionId: null }
          : null;
      }
      if (series.pendingCompletionId !== id) return null;
      status = "recorded";
      const completedInSeries = Math.min(series.completedInSeries + 1, MAX_COMPLETED_IN_SERIES);
      const isLongBreak = completedInSeries >= settings.longBreakAfter;
      const breakDurationSeconds = (isLongBreak
        ? settings.longBreakMinutes
        : settings.shortBreakMinutes) * 60;
      return {
        ...series,
        completedInSeries,
        phase: isLongBreak ? "break-long" : "break-short",
        breakDeadline: now + breakDurationSeconds * 1000,
        breakDurationSeconds,
        pendingCompletionId: id,
        processedCycleIds: [...series.processedCycleIds, id],
      };
    }, { preserveCurrentOnFailure: true });
    if (recorded.storageStatus !== "ok") return recorded;
    return { ...recorded, status };
  }

  async function clearPendingCompletion(userId, cycleId) {
    const id = normalizeCycleId(cycleId);
    if (!id) return { saved: false, series: null, changed: false };
    return update(userId, (series) => (
      series.pendingCompletionId === id ? { ...series, pendingCompletionId: null } : null
    ), { preserveCurrentOnFailure: true });
  }

  async function discardCancelledCompletion(userId, cycleId) {
    return clearPendingCompletion(userId, cycleId);
  }

  async function finishBreak(userId, { completed, expectedPhase, expectedDeadline }) {
    return update(userId, (series) => {
      if ((series.phase !== "break-short" && series.phase !== "break-long")
        || series.phase !== expectedPhase || series.breakDeadline !== expectedDeadline) return null;
      return {
        ...series,
        completedInSeries: series.phase === "break-long" && completed
          ? 0
          : series.completedInSeries,
        phase: "focus",
        breakDeadline: null,
        breakDurationSeconds: 0,
      };
    });
  }

  async function restoreFocus(userId) {
    return update(userId, (series) => {
      if (series.phase === "focus") return null;
      return {
        ...series,
        phase: "focus",
        breakDeadline: null,
        breakDurationSeconds: 0,
      };
    });
  }

  return {
    clearPendingCompletion,
    discardCancelledCompletion,
    finishBreak,
    prepareCompletion,
    read,
    recordCompletion,
    restoreFocus,
  };
}

export async function completePomodoroCycle(store, userId, cycleId, { sendCompletion, settings, now = Date.now() }) {
  const id = normalizeCycleId(cycleId);
  if (!id || typeof sendCompletion !== "function") {
    throw new TypeError("Não foi possível preparar a conclusão do ciclo.");
  }

  const pending = await store.prepareCompletion(userId, id);
  if (pending.storageStatus === "recovery-required") {
    return { status: "recovery-required", series: null };
  }
  if (pending.storageStatus === "storage-unavailable") {
    return { status: "storage-unavailable", series: pending.series };
  }
  if (!pending.saved || !pending.series) {
    return { status: "storage-unavailable", series: pending.series };
  }
  if (pending.status === "already-processed") {
    return { status: "already-processed", series: pending.series };
  }
  if (pending.status === "pending-conflict") {
    return { status: "pending-conflict", series: pending.series };
  }
  if (pending.series.pendingCompletionId !== id) {
    return { status: "pending-conflict", series: pending.series };
  }

  const result = await sendCompletion(id);
  if (result?.ok !== true || result.cycle?.status !== "completed"
    || normalizeCycleId(result.cycle.id) !== id || typeof result.replayed !== "boolean") {
    throw new TypeError("O servidor retornou uma conclusão inválida.");
  }

  const recorded = await store.recordCompletion(userId, id, settings, now);
  if (recorded.storageStatus === "recovery-required") {
    return { status: "recovery-required", result, series: null };
  }
  if (recorded.storageStatus === "storage-unavailable" || !recorded.saved) {
    return { status: "storage-unavailable", confirmed: true, result, series: recorded.series };
  }
  if (!recorded.series) return { status: "storage-unavailable", result, series: null };
  if (recorded.status === "pending-missing") {
    return { status: "pending-missing", result, series: recorded.series };
  }

  let cleared = { saved: false, series: recorded.series };
  if (recorded.status === "recorded" && recorded.saved) {
    cleared = await store.clearPendingCompletion(userId, id);
  }
  if (recorded.status === "already-processed") {
    cleared = { saved: recorded.saved, series: recorded.series };
  }
  return {
    status: "completed",
    result,
    series: cleared.series || recorded.series,
    persisted: recorded.saved && cleared.saved,
    incremented: recorded.status === "recorded" && recorded.changed && recorded.saved,
  };
}
