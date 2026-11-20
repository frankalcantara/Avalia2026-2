import assert from "node:assert/strict";
import test from "node:test";
import {
  completePomodoroCycle,
  createPomodoroSeriesStore,
  pomodoroSeriesStorageKey,
  validPomodoroSeries,
} from "../public/pomodoro-series.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failReads = false;
    this.failWrites = false;
    this.writeAttempts = 0;
    this.failOnWriteNumber = null;
    this.quotaOnWriteNumber = null;
  }

  getItem(key) {
    if (this.failReads) throw new Error("localStorage unavailable");
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writeAttempts += 1;
    if (this.failWrites || this.writeAttempts === this.failOnWriteNumber
      || this.writeAttempts === this.quotaOnWriteNumber) {
      const error = new Error("localStorage unavailable");
      if (this.writeAttempts === this.quotaOnWriteNumber) error.name = "QuotaExceededError";
      throw error;
    }
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class FakeLocks {
  constructor() {
    this.queues = new Map();
  }

  request(name, _options, callback) {
    const previous = this.queues.get(name) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.catch(() => {}).then(() => gate);
    this.queues.set(name, tail);
    return previous.catch(() => {}).then(callback).finally(() => {
      release();
      if (this.queues.get(name) === tail) this.queues.delete(name);
    });
  }
}

const settings = {
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfter: 4,
};

function createStore(storage, locks = new FakeLocks(), onChange = () => {}, extras = {}) {
  return createPomodoroSeriesStore({ storage, locks, onChange, ...extras });
}

function seedSeries(storage, userId, changes = {}) {
  const series = {
    version: 3,
    completedInSeries: 2,
    phase: "focus",
    breakDeadline: null,
    breakDurationSeconds: 0,
    pendingCompletionId: null,
    processedCycleIds: [],
    ...changes,
  };
  storage.setItem(pomodoroSeriesStorageKey(userId), JSON.stringify(series));
  return series;
}

function completedResponse(id, replayed) {
  return {
    ok: true,
    replayed,
    cycle: { id: Number(id), status: "completed" },
  };
}

test("duas abas serializam a mesma conclusão e a repetição mantém a sequência em três", async () => {
  const storage = new MemoryStorage();
  const locks = new FakeLocks();
  const userId = "discord-123";
  seedSeries(storage, userId);
  const firstTabState = { completedInSeries: 0, processedCycleIds: [] };
  const secondTabState = { completedInSeries: 0, processedCycleIds: [] };
  const firstTab = createStore(storage, locks, (_userId, series) => {
    firstTabState.completedInSeries = series.completedInSeries;
    firstTabState.processedCycleIds = series.processedCycleIds;
  });
  const secondTab = createStore(storage, locks, (_userId, series) => {
    secondTabState.completedInSeries = series.completedInSeries;
    secondTabState.processedCycleIds = series.processedCycleIds;
  });
  await Promise.all([firstTab.read(userId), secondTab.read(userId)]);
  assert.equal(firstTabState.completedInSeries, 2);
  assert.equal(secondTabState.completedInSeries, 2);

  let requestCount = 0;
  let releaseRequests;
  const bothRequestsSent = new Promise((resolve) => { releaseRequests = resolve; });
  const sendCompletion = async (id) => {
    requestCount += 1;
    const replayed = requestCount > 1;
    if (requestCount === 2) releaseRequests();
    await bothRequestsSent;
    return completedResponse(id, replayed);
  };
  const [firstResult, secondResult] = await Promise.all([
    completePomodoroCycle(firstTab, userId, 501, { sendCompletion, settings }),
    completePomodoroCycle(secondTab, userId, 501, { sendCompletion, settings }),
  ]);
  assert.equal(firstResult.status, "completed");
  assert.equal(secondResult.status, "completed");
  assert.equal(firstResult.incremented, true);
  assert.equal(secondResult.incremented, false);
  assert.equal(firstTabState.completedInSeries, 3);
  assert.equal(secondTabState.completedInSeries, 3);
  assert.equal(new Set(firstTabState.processedCycleIds).size, 1);
  assert.equal(firstTabState.processedCycleIds[0], "501");

  await secondTab.read(userId);
  assert.equal(secondTabState.completedInSeries, 3);
  assert.equal(secondTabState.processedCycleIds[0], "501");
});

test("o ciclo seguinte após o descanso curto chega ao descanso longo", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-123";
  seedSeries(storage, userId);
  const store = createStore(storage);
  const now = Date.now();
  const send = async (id) => completedResponse(id, false);

  await completePomodoroCycle(store, userId, 701, { sendCompletion: send, settings, now });
  let { series } = await store.read(userId);
  assert.equal(series.completedInSeries, 3);
  assert.equal(series.phase, "break-short");
  const finishedBreak = { phase: series.phase, deadline: series.breakDeadline };
  await store.finishBreak(userId, {
    completed: true,
    expectedPhase: finishedBreak.phase,
    expectedDeadline: finishedBreak.deadline,
  });
  ({ series } = await store.read(userId));

  await completePomodoroCycle(store, userId, 702, {
    sendCompletion: async (id) => completedResponse(id, false),
    settings,
    now: now + 1000,
  });
  ({ series } = await store.read(userId));
  assert.equal(series.completedInSeries, 4);
  assert.equal(series.phase, "break-long");
  assert.equal(series.breakDurationSeconds, 15 * 60);
  assert.equal(series.breakDeadline, now + 1000 + 15 * 60 * 1000);
  const longBreakDeadline = series.breakDeadline;
  const lateReplay = await completePomodoroCycle(store, userId, 701, {
    sendCompletion: async (id) => completedResponse(id, true),
    settings,
    now: now + 2000,
  });
  ({ series } = await store.read(userId));
  assert.equal(lateReplay.status, "already-processed");
  assert.equal(series.completedInSeries, 4);
  assert.equal(series.phase, "break-long");
  assert.equal(series.breakDeadline, longBreakDeadline);

  await store.finishBreak(userId, {
    completed: true,
    expectedPhase: finishedBreak.phase,
    expectedDeadline: finishedBreak.deadline,
  });
  ({ series } = await store.read(userId));
  assert.equal(series.phase, "break-long");
  assert.equal(series.completedInSeries, 4);
});

test("reload durante uma requisição recupera o replay após perda da resposta", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-123";
  seedSeries(storage, userId);
  let serverCompleted = false;
  const originalStore = createStore(storage);

  await assert.rejects(completePomodoroCycle(originalStore, userId, 801, {
    settings,
    sendCompletion: async () => {
      serverCompleted = true;
      throw new Error("resposta HTTP perdida");
    },
  }), /resposta HTTP perdida/);
  let { series } = await originalStore.read(userId);
  assert.equal(series.pendingCompletionId, "801");
  assert.equal(series.completedInSeries, 2);

  const reloadedStore = createStore(storage);
  ({ series } = await reloadedStore.read(userId));
  assert.equal(series.pendingCompletionId, "801");
  const recovery = await completePomodoroCycle(reloadedStore, userId, 801, {
    settings,
    sendCompletion: async (id) => {
      assert.equal(serverCompleted, true);
      return completedResponse(id, true);
    },
  });
  let duplicateRequests = 0;
  const repeatedRecovery = await completePomodoroCycle(reloadedStore, userId, 801, {
    settings,
    sendCompletion: async (id) => {
      duplicateRequests += 1;
      return completedResponse(id, true);
    },
  });
  ({ series } = await reloadedStore.read(userId));
  assert.equal(recovery.result.replayed, true);
  assert.equal(recovery.incremented, true);
  assert.equal(repeatedRecovery.status, "already-processed");
  assert.equal(duplicateRequests, 0);
  assert.equal(series.completedInSeries, 3);
  assert.equal(series.processedCycleIds.includes("801"), true);
  assert.equal(series.pendingCompletionId, null);
});

test("repetir o mesmo ID deduplica sem incrementar novamente", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-123";
  seedSeries(storage, userId);
  const store = createStore(storage);
  const sendCompletion = async (id) => completedResponse(id, true);

  const first = await completePomodoroCycle(store, userId, 901, { sendCompletion, settings });
  let repeatedRequests = 0;
  const replay = await completePomodoroCycle(store, userId, 901, {
    settings,
    sendCompletion: async (id) => {
      repeatedRequests += 1;
      return completedResponse(id, true);
    },
  });
  const { series } = await store.read(userId);
  assert.equal(first.incremented, true);
  assert.equal(replay.status, "already-processed");
  assert.equal(repeatedRequests, 0);
  assert.equal(series.completedInSeries, 3);
  assert.deepEqual(series.processedCycleIds, ["901"]);
});

test("restaura descanso válido e rejeita dados corrompidos ou fora dos limites", async () => {
  const deadline = Date.now() + 5 * 60 * 1000;
  const valid = {
    version: 3,
    completedInSeries: 2,
    phase: "break-short",
    breakDeadline: deadline,
    breakDurationSeconds: 5 * 60,
    pendingCompletionId: null,
    processedCycleIds: [],
  };
  assert.equal(validPomodoroSeries(valid), true);

  const invalidCases = [
    { ...valid, breakDurationSeconds: 31 * 60 },
    { ...valid, phase: "break-long", breakDurationSeconds: 61 * 60 },
    { ...valid, breakDeadline: Number.MAX_SAFE_INTEGER },
    { ...valid, breakDeadline: -1 },
    { ...valid, breakDeadline: 1.5 },
    { ...valid, breakDeadline: "2030-01-01" },
    { ...valid, breakDurationSeconds: -60 },
    { ...valid, breakDurationSeconds: 90 },
    { ...valid, breakDurationSeconds: "300" },
    { ...valid, completedInSeries: Number.MAX_SAFE_INTEGER },
    { ...valid, completedInSeries: -1 },
    { ...valid, completedInSeries: 2.5 },
    { ...valid, completedInSeries: "2" },
    { ...valid, phase: "unknown" },
  ];
  invalidCases.forEach((series) => assert.equal(validPomodoroSeries(series), false));

  const storage = new MemoryStorage();
  const userId = "discord-123";
  seedSeries(storage, userId, valid);
  const store = createStore(storage);
  const restored = await store.read(userId);
  assert.equal(restored.series.phase, "break-short");
  assert.equal(restored.series.breakDeadline, deadline);

  const corruptedRaw = JSON.stringify(invalidCases[0]);
  storage.setItem(pomodoroSeriesStorageKey(userId), corruptedRaw);
  const corrupted = await store.read(userId);
  assert.equal(corrupted.status, "recovery-required");
  assert.equal(corrupted.series, null);
  assert.equal(storage.getItem(pomodoroSeriesStorageKey(userId)), corruptedRaw);
  let requests = 0;
  const blocked = await completePomodoroCycle(store, userId, 1301, {
    settings,
    sendCompletion: async (id) => {
      requests += 1;
      return completedResponse(id, true);
    },
  });
  assert.equal(blocked.status, "recovery-required");
  assert.equal(requests, 0);
});

test("migra sequência válida anterior e preserva o descanso em andamento", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-123";
  const legacyKey = `focusflow.pomodoro.series.v1:${encodeURIComponent(userId)}`;
  const deadline = Date.now() + 10 * 60 * 1000;
  storage.setItem(legacyKey, JSON.stringify({
    version: 1,
    completedInSeries: 3,
    phase: "break-short",
    breakDeadline: deadline,
    breakDurationSeconds: 5 * 60,
  }));
  const store = createStore(storage);
  const { series } = await store.read(userId);
  assert.equal(series.version, 3);
  assert.equal(series.completedInSeries, 3);
  assert.equal(series.phase, "break-short");
  assert.equal(series.breakDeadline, deadline);
  assert.equal(JSON.parse(storage.getItem(pomodoroSeriesStorageKey(userId))).version, 3);
});

test("migra v2 preservando histórico processado e pendência", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-v2";
  const legacyKey = `focusflow.pomodoro.series.v2:${encodeURIComponent(userId)}`;
  const deadline = Date.now() + 5 * 60 * 1000;
  storage.setItem(legacyKey, JSON.stringify({
    version: 2,
    completedInSeries: 3,
    phase: "break-short",
    breakDeadline: deadline,
    breakDurationSeconds: 5 * 60,
    pendingCompletionId: "1501",
    processedCycleIds: ["1401", "1402"],
  }));
  const store = createStore(storage);
  const { series, saved } = await store.read(userId);
  assert.equal(saved, true);
  assert.equal(series.version, 3);
  assert.equal(series.completedInSeries, 3);
  assert.equal(series.breakDeadline, deadline);
  assert.equal(series.pendingCompletionId, "1501");
  assert.deepEqual(series.processedCycleIds, ["1401", "1402"]);
  assert.deepEqual(JSON.parse(storage.getItem(legacyKey)).processedCycleIds, ["1401", "1402"]);
  assert.equal(storage.getItem(`focusflow.pomodoro.series.v3.backup:${encodeURIComponent(userId)}`),
    JSON.stringify({
      version: 2,
      completedInSeries: 3,
      phase: "break-short",
      breakDeadline: deadline,
      breakDurationSeconds: 5 * 60,
      pendingCompletionId: "1501",
      processedCycleIds: ["1401", "1402"],
    }));
});

test("v3 corrompido recupera o snapshot v2 certificado sem liberar replay", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-recover-v2";
  const legacyKey = `focusflow.pomodoro.series.v2:${encodeURIComponent(userId)}`;
  const legacy = {
    version: 2,
    completedInSeries: 2,
    phase: "focus",
    breakDeadline: null,
    breakDurationSeconds: 0,
    pendingCompletionId: null,
    processedCycleIds: ["1"],
  };
  storage.setItem(legacyKey, JSON.stringify(legacy));
  const migratingStore = createStore(storage);
  const migration = await migratingStore.read(userId);
  assert.equal(migration.status, "ok");
  assert.deepEqual(migration.series.processedCycleIds, ["1"]);
  assert.equal(storage.getItem(legacyKey), JSON.stringify(legacy));

  storage.setItem(pomodoroSeriesStorageKey(userId), "{broken-v3");
  const recoveredStore = createStore(storage);
  const recovery = await recoveredStore.read(userId);
  assert.equal(recovery.status, "ok");
  assert.deepEqual(recovery.series.processedCycleIds, ["1"]);

  let requests = 0;
  const replay = await completePomodoroCycle(recoveredStore, userId, 1, {
    settings,
    sendCompletion: async (id) => {
      requests += 1;
      return completedResponse(id, true);
    },
  });
  const lateResponse = await recoveredStore.recordCompletion(userId, 1, settings);
  const finalState = await recoveredStore.read(userId);
  assert.equal(replay.status, "already-processed");
  assert.equal(requests, 0);
  assert.equal(lateResponse.status, "already-processed");
  assert.equal(finalState.series.completedInSeries, 2);
  assert.deepEqual(finalState.series.processedCycleIds, ["1"]);
  assert.equal(finalState.series.pendingCompletionId, null);
});

test("v2 antigo sem certificado não recupera v3 após ciclos posteriores", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-stale-v2";
  const legacyKey = `focusflow.pomodoro.series.v2:${encodeURIComponent(userId)}`;
  storage.setItem(legacyKey, JSON.stringify({
    version: 2,
    completedInSeries: 2,
    phase: "focus",
    breakDeadline: null,
    breakDurationSeconds: 0,
    pendingCompletionId: null,
    processedCycleIds: ["1"],
  }));
  const store = createStore(storage);
  await store.read(userId);

  for (const id of [2, 3]) {
    await completePomodoroCycle(store, userId, id, {
      settings,
      sendCompletion: async (cycleId) => completedResponse(cycleId, false),
    });
    const { series } = await store.read(userId);
    if (series.phase !== "focus") {
      await store.finishBreak(userId, {
        completed: true,
        expectedPhase: series.phase,
        expectedDeadline: series.breakDeadline,
      });
    }
  }
  assert.equal(storage.getItem(`focusflow.pomodoro.series.v3.backup:${encodeURIComponent(userId)}`), "");
  storage.setItem(pomodoroSeriesStorageKey(userId), "{corrupt-after-v3-updates");

  const recoveryStore = createStore(storage);
  const recovery = await recoveryStore.read(userId);
  assert.equal(recovery.status, "recovery-required");
  assert.equal(recovery.series, null);
  let requests = 0;
  const blocked = await completePomodoroCycle(recoveryStore, userId, 1, {
    settings,
    sendCompletion: async (id) => {
      requests += 1;
      return completedResponse(id, true);
    },
  });
  assert.equal(blocked.status, "recovery-required");
  assert.equal(requests, 0);
  assert.deepEqual(JSON.parse(storage.getItem(legacyKey)).processedCycleIds, ["1"]);
  storage.removeItem(pomodoroSeriesStorageKey(userId));
  const missingV3 = await createStore(storage).read(userId);
  assert.equal(missingV3.status, "recovery-required");
  assert.equal(missingV3.series, null);
});

test("JSON v3 malformado ou parcialmente inválido exige recuperação sem sobrescrita", async () => {
  const valid = {
    version: 3,
    completedInSeries: 2,
    phase: "focus",
    breakDeadline: null,
    breakDurationSeconds: 0,
    pendingCompletionId: null,
    processedCycleIds: [],
  };
  const invalidRawStates = [
    "{",
    JSON.stringify({ version: 3, completedInSeries: 2 }),
    JSON.stringify({ ...valid, completedInSeries: "2" }),
    JSON.stringify({ ...valid, processedCycleIds: [1] }),
    JSON.stringify({ ...valid, processedCycleIds: ["1", "1"] }),
    JSON.stringify({ ...valid, phase: "break-short", breakDeadline: Number.MAX_SAFE_INTEGER }),
  ];

  for (const [index, raw] of invalidRawStates.entries()) {
    const storage = new MemoryStorage();
    const userId = `discord-corrupt-${index}`;
    storage.setItem(pomodoroSeriesStorageKey(userId), raw);
    let changes = 0;
    const store = createStore(storage, new FakeLocks(), () => { changes += 1; });
    const read = await store.read(userId);
    assert.equal(read.status, "recovery-required");
    assert.equal(read.series, null);
    let requests = 0;
    const completion = await completePomodoroCycle(store, userId, 1900 + index, {
      settings,
      sendCompletion: async (id) => {
        requests += 1;
        return completedResponse(id, true);
      },
    });
    assert.equal(completion.status, "recovery-required");
    assert.equal(requests, 0);
    assert.equal(changes, 0);
    assert.equal(storage.getItem(pomodoroSeriesStorageKey(userId)), raw);
  }
});

test("descanso cancelado não é contabilizado e pendência é removida", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-123";
  seedSeries(storage, userId);
  const store = createStore(storage);
  await store.prepareCompletion(userId, 1001);
  await store.discardCancelledCompletion(userId, 1001);
  const { series } = await store.read(userId);
  assert.equal(series.completedInSeries, 2);
  assert.equal(series.processedCycleIds.includes("1001"), false);
  assert.equal(series.pendingCompletionId, null);
  assert.equal(series.phase, "focus");
});

test("histórico mantém os 65 IDs e isola dados por usuário", async () => {
  const storage = new MemoryStorage();
  const locks = new FakeLocks();
  const firstUser = "discord-a";
  const secondUser = "discord-b";
  seedSeries(storage, firstUser, { completedInSeries: 0 });
  seedSeries(storage, secondUser, { completedInSeries: 1 });
  const store = createStore(storage, locks);

  for (let id = 1; id <= 65; id += 1) {
    const completion = await completePomodoroCycle(store, firstUser, id, {
      sendCompletion: async (cycleId) => completedResponse(cycleId, false),
      settings,
      now: Date.now() + id * 1000,
    });
    assert.equal(completion.status, "completed");
    const { series } = await store.read(firstUser);
    if (series.phase !== "focus") {
      await store.finishBreak(firstUser, {
        completed: true,
        expectedPhase: series.phase,
        expectedDeadline: series.breakDeadline,
      });
    }
  }
  const first = await store.read(firstUser);
  const second = await store.read(secondUser);
  assert.equal(first.series.processedCycleIds.length, 65);
  assert.equal(first.series.processedCycleIds[0], "1");
  assert.equal(first.series.processedCycleIds[64], "65");
  assert.equal(second.series.completedInSeries, 1);
  assert.deepEqual(second.series.processedCycleIds, []);
  assert.notEqual(pomodoroSeriesStorageKey(firstUser), pomodoroSeriesStorageKey(secondUser));

  const countBeforeReplay = first.series.completedInSeries;
  let staleRequestCount = 0;
  const staleReplay = await completePomodoroCycle(store, firstUser, 1, {
    sendCompletion: async (id) => {
      staleRequestCount += 1;
      return completedResponse(id, true);
    },
    settings,
  });
  const lateResponse = await store.recordCompletion(firstUser, 1, settings);
  const afterReplay = await store.read(firstUser);
  assert.equal(staleReplay.status, "already-processed");
  assert.equal(staleRequestCount, 0);
  assert.equal(lateResponse.status, "already-processed");
  assert.equal(lateResponse.changed, false);
  assert.equal(afterReplay.series.completedInSeries, countBeforeReplay);
  assert.equal(afterReplay.series.processedCycleIds.includes("1"), true);
});

test("replay tardio em voo após 65 conclusões não incrementa pelo coordenador", async () => {
  const storage = new MemoryStorage();
  const locks = new FakeLocks();
  const userId = "discord-delayed-replay";
  seedSeries(storage, userId);
  const oldTab = createStore(storage, locks);
  const currentTab = createStore(storage, locks);

  let signalRequestStarted;
  const requestStarted = new Promise((resolve) => { signalRequestStarted = resolve; });
  let resolveLateResponse;
  const lateResponse = new Promise((resolve) => { resolveLateResponse = resolve; });
  const delayedCompletion = completePomodoroCycle(oldTab, userId, 1, {
    settings,
    sendCompletion: async () => {
      signalRequestStarted();
      return lateResponse;
    },
  });
  await requestStarted;

  const firstCompletion = await completePomodoroCycle(currentTab, userId, 1, {
    settings,
    sendCompletion: async (id) => completedResponse(id, false),
  });
  assert.equal(firstCompletion.incremented, true);

  for (let id = 2; id <= 65; id += 1) {
    await completePomodoroCycle(currentTab, userId, id, {
      settings,
      sendCompletion: async (cycleId) => completedResponse(cycleId, false),
    });
    const { series } = await currentTab.read(userId);
    if (series.phase !== "focus") {
      await currentTab.finishBreak(userId, {
        completed: true,
        expectedPhase: series.phase,
        expectedDeadline: series.breakDeadline,
      });
    }
  }
  const beforeReplay = await currentTab.read(userId);
  assert.equal(beforeReplay.series.processedCycleIds.length, 65);
  assert.equal(beforeReplay.series.processedCycleIds[0], "1");

  resolveLateResponse(completedResponse(1, true));
  const delayedResult = await delayedCompletion;
  const afterReplay = await currentTab.read(userId);
  assert.equal(delayedResult.result.replayed, true);
  assert.equal(delayedResult.incremented, false);
  assert.equal(afterReplay.series.completedInSeries, beforeReplay.series.completedInSeries);
  assert.equal(afterReplay.series.processedCycleIds.length, 65);

  let extraPosts = 0;
  const retry = await completePomodoroCycle(oldTab, userId, 1, {
    settings,
    sendCompletion: async (id) => {
      extraPosts += 1;
      return completedResponse(id, true);
    },
  });
  assert.equal(retry.status, "already-processed");
  assert.equal(extraPosts, 0);
});

test("resposta sem pendência não pode contabilizar um ciclo", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-no-pending";
  seedSeries(storage, userId);
  const store = createStore(storage);

  const result = await store.recordCompletion(userId, 1601, settings);
  assert.equal(result.status, "pending-missing");
  assert.equal(result.series.completedInSeries, 2);
  assert.deepEqual(result.series.processedCycleIds, []);
});

test("falha ao persistir mantém a pendência e impede sobrescrita por estado antigo", async () => {
  const storage = new MemoryStorage();
  const locks = new FakeLocks();
  const userId = "discord-storage-failure";
  seedSeries(storage, userId);
  const currentTab = createStore(storage, locks);
  const staleTab = createStore(storage, locks);
  await staleTab.read(userId);

  const first = await completePomodoroCycle(currentTab, userId, 1701, {
    settings,
    sendCompletion: async (id) => completedResponse(id, false),
  });
  assert.equal(first.persisted, true);
  const key = pomodoroSeriesStorageKey(userId);
  storage.quotaOnWriteNumber = storage.writeAttempts + 2;

  const second = await completePomodoroCycle(staleTab, userId, 1702, {
    settings,
    sendCompletion: async (id) => completedResponse(id, false),
  });
  assert.equal(second.status, "storage-unavailable");
  assert.equal(second.confirmed, true);
  assert.notEqual(second.incremented, true);
  assert.equal(second.series.completedInSeries, 3);

  const durable = JSON.parse(storage.values.get(key));
  assert.equal(durable.completedInSeries, 3);
  assert.equal(durable.pendingCompletionId, "1702");
  assert.deepEqual(durable.processedCycleIds, ["1701"]);
  const reloaded = await createStore(storage, locks).read(userId);
  assert.equal(reloaded.series.completedInSeries, 3);
  assert.equal(reloaded.series.pendingCompletionId, "1702");
});

test("falha de gravação durante migração preserva v2 e bloqueia POST", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-migration-write-failure";
  const legacyKey = `focusflow.pomodoro.series.v2:${encodeURIComponent(userId)}`;
  const legacyRaw = JSON.stringify({
    version: 2,
    completedInSeries: 3,
    phase: "break-short",
    breakDeadline: Date.now() + 5 * 60 * 1000,
    breakDurationSeconds: 5 * 60,
    pendingCompletionId: "2001",
    processedCycleIds: ["1999"],
  });
  storage.setItem(legacyKey, legacyRaw);
  storage.failOnWriteNumber = storage.writeAttempts + 1;
  const store = createStore(storage);

  const migration = await store.read(userId);
  assert.equal(migration.status, "storage-unavailable");
  assert.equal(migration.series.completedInSeries, 3);
  assert.equal(storage.getItem(legacyKey), legacyRaw);
  assert.equal(storage.getItem(pomodoroSeriesStorageKey(userId)), null);
  let requests = 0;
  const completion = await completePomodoroCycle(store, userId, 2001, {
    settings,
    sendCompletion: async (id) => {
      requests += 1;
      return completedResponse(id, true);
    },
  });
  assert.equal(completion.status, "storage-unavailable");
  assert.equal(requests, 0);
});

test("falha ao remover pendência preserva-a até uma gravação confirmada", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-clear-failure";
  seedSeries(storage, userId);
  const store = createStore(storage);
  storage.failOnWriteNumber = storage.writeAttempts + 4;

  const result = await completePomodoroCycle(store, userId, 1801, {
    settings,
    sendCompletion: async (id) => completedResponse(id, false),
  });
  assert.equal(result.incremented, true);
  assert.equal(result.persisted, false);

  const durable = JSON.parse(storage.values.get(pomodoroSeriesStorageKey(userId)));
  assert.equal(durable.completedInSeries, 3);
  assert.deepEqual(durable.processedCycleIds, ["1801"]);
  assert.equal(durable.pendingCompletionId, "1801");

  let requests = 0;
  const reloaded = createStore(storage);
  const recovered = await completePomodoroCycle(reloaded, userId, 1801, {
    settings,
    sendCompletion: async (id) => {
      requests += 1;
      return completedResponse(id, true);
    },
  });
  assert.equal(recovered.status, "already-processed");
  assert.equal(requests, 0);
  assert.equal(recovered.series.pendingCompletionId, null);
  assert.equal(recovered.series.completedInSeries, 3);
});

test("localStorage indisponível não envia conclusão e Web Locks ausente é informado", async () => {
  for (const failure of ["reads", "writes"]) {
    const storage = new MemoryStorage();
    storage[`fail${failure[0].toUpperCase()}${failure.slice(1)}`] = true;
    let storageWarnings = 0;
    let syncWarnings = 0;
    const store = createStore(storage, null, () => {}, {
      onStorageUnavailable: () => { storageWarnings += 1; },
      onSyncUnavailable: () => { syncWarnings += 1; },
    });
    let requests = 0;
    const result = await completePomodoroCycle(store, "discord-123", 1201, {
      settings,
      sendCompletion: async (id) => {
        requests += 1;
        return completedResponse(id, false);
      },
    });
    assert.equal(result.status, "storage-unavailable");
    assert.equal(requests, 0);
    assert.equal(storageWarnings, 1);
    assert.equal(syncWarnings, 1);
  }
});

test("falha de leitura não substitui estado válido por uma sequência vazia", async () => {
  const storage = new MemoryStorage();
  const userId = "discord-read-failure";
  seedSeries(storage, userId, { processedCycleIds: ["2101"], completedInSeries: 3 });
  const key = pomodoroSeriesStorageKey(userId);
  const storedBeforeFailure = storage.values.get(key);
  storage.failReads = true;
  const store = createStore(storage);

  const read = await store.read(userId);
  assert.equal(read.status, "storage-unavailable");
  assert.equal(read.series, null);
  let requests = 0;
  const completion = await completePomodoroCycle(store, userId, 2102, {
    settings,
    sendCompletion: async (id) => {
      requests += 1;
      return completedResponse(id, false);
    },
  });
  assert.equal(completion.status, "storage-unavailable");
  assert.equal(requests, 0);
  assert.equal(storage.values.get(key), storedBeforeFailure);
});
