import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppRecord } from "@/types/domain";

export type TankBalanceDelta = {
  tankId: string;
  deltaLiters: number;
};

type ListOptions = {
  force?: boolean;
  ttlMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  records: AppRecord[];
};

const DEFAULT_CACHE_TTL_MS = 60_000;
const listCache = new Map<string, CacheEntry>();
const pendingListReads = new Map<string, Promise<AppRecord[]>>();

function cacheKey(collectionName: string, max: number) {
  return `${collectionName}:${max}`;
}

export function invalidateCollection(collectionName: string) {
  for (const key of listCache.keys()) {
    if (key.startsWith(`${collectionName}:`)) {
      listCache.delete(key);
    }
  }
  for (const key of pendingListReads.keys()) {
    if (key.startsWith(`${collectionName}:`)) {
      pendingListReads.delete(key);
    }
  }
}

function invalidateTankDeltas(deltas: TankBalanceDelta[] = []) {
  if (deltas.some((delta) => delta.tankId)) {
    invalidateCollection("tanques_combustivel");
  }
}

function applyTankDeltasToBatch(batch: ReturnType<typeof writeBatch>, deltas: TankBalanceDelta[] = []) {
  for (const delta of deltas) {
    if (!delta.tankId || !Number.isFinite(delta.deltaLiters) || delta.deltaLiters === 0) continue;
    batch.update(doc(db, "tanques_combustivel", delta.tankId), {
      saldo_atual_litros: increment(delta.deltaLiters),
      updatedAt: serverTimestamp()
    });
  }
}

export async function listRecords(collectionName: string, max = 100, options: ListOptions = {}) {
  const key = cacheKey(collectionName, max);
  const cached = listCache.get(key);
  const now = Date.now();

  if (!options.force && cached && cached.expiresAt > now) {
    return cached.records;
  }

  if (!options.force) {
    const pending = pendingListReads.get(key);
    if (pending) return pending;
  }

  const read = getDocs(query(collection(db, collectionName), limit(max))).then((snapshot) => {
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as AppRecord[];

    listCache.set(key, {
      expiresAt: Date.now() + (options.ttlMs ?? DEFAULT_CACHE_TTL_MS),
      records
    });

    return records;
  });

  pendingListReads.set(key, read);

  try {
    return await read;
  } finally {
    pendingListReads.delete(key);
  }
}

export async function createRecord(collectionName: string, payload: AppRecord, forcedId?: string) {
  const data = { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

  if (forcedId) {
    await setDoc(doc(db, collectionName, forcedId), data);
    invalidateCollection(collectionName);
    return forcedId;
  }

  const created = await addDoc(collection(db, collectionName), data);
  invalidateCollection(collectionName);
  return created.id;
}

export async function createRecordWithTankDeltas(
  collectionName: string,
  payload: AppRecord,
  deltas: TankBalanceDelta[],
  forcedId?: string
) {
  const batch = writeBatch(db);
  const data = { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const recordRef = forcedId ? doc(db, collectionName, forcedId) : doc(collection(db, collectionName));

  batch.set(recordRef, data);
  applyTankDeltasToBatch(batch, deltas);
  await batch.commit();
  invalidateCollection(collectionName);
  invalidateTankDeltas(deltas);

  return recordRef.id;
}

export async function updateRecord(collectionName: string, id: string, payload: AppRecord) {
  await updateDoc(doc(db, collectionName, id), { ...payload, updatedAt: serverTimestamp() });
  invalidateCollection(collectionName);
}

export async function updateRecordWithTankDeltas(collectionName: string, id: string, payload: AppRecord, deltas: TankBalanceDelta[]) {
  const batch = writeBatch(db);

  batch.update(doc(db, collectionName, id), { ...payload, updatedAt: serverTimestamp() });
  applyTankDeltasToBatch(batch, deltas);
  await batch.commit();
  invalidateCollection(collectionName);
  invalidateTankDeltas(deltas);
}

export async function removeRecord(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id));
  invalidateCollection(collectionName);
}

export async function removeRecordWithTankDeltas(collectionName: string, id: string, deltas: TankBalanceDelta[]) {
  const batch = writeBatch(db);

  batch.delete(doc(db, collectionName, id));
  applyTankDeltasToBatch(batch, deltas);
  await batch.commit();
  invalidateCollection(collectionName);
  invalidateTankDeltas(deltas);
}

export async function findFirstByField(collectionName: string, field: string, value: string) {
  const snapshot = await getDocs(query(collection(db, collectionName), where(field, "==", value), limit(1)));
  const first = snapshot.docs[0];
  return first ? ({ id: first.id, ...first.data() } as AppRecord) : null;
}
