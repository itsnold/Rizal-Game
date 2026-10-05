import { onValue, ref, runTransaction, type Database } from 'firebase/database';

export async function durableTransaction<T>(database: Database, path: string, updater: (value: T | null) => T | undefined): Promise<boolean> {
  const node = ref(database, path);
  let stop = () => {};
  try {
    // Keep the complete node subscribed through the transaction. A one-off get()
    // does not retain RTDB's cache and can leave the first callback with null.
    await new Promise<void>((resolve, reject) => { stop = onValue(node, () => resolve(), reject); });
    return (await runTransaction(node, updater, { applyLocally: false })).committed;
  } finally { stop(); }
}
