/**
 * Minimal Firestore API used by the room API. Apps pass their own firebase/firestore
 * so the shared package never imports firebase (avoids "Expected first argument to
 * collection() to be a CollectionReference..." when bundler resolves a different instance).
 */
export interface FirestoreAdapter {
  doc: (db: unknown, collectionPath: string, ...pathSegments: string[]) => unknown;
  setDoc: (ref: unknown, data: unknown) => Promise<void>;
  getDoc: (ref: unknown) => Promise<{
    exists: () => boolean;
    data: () => Record<string, unknown>;
  }>;
  updateDoc: (ref: unknown, data: unknown) => Promise<void>;
  deleteDoc: (ref: unknown) => Promise<void>;
  onSnapshot: (ref: unknown, callback: (snap: {
    exists: () => boolean;
    data: () => Record<string, unknown>;
  }) => void) => () => void;
  serverTimestamp: () => unknown;
  arrayUnion: (...args: unknown[]) => unknown;
  collection: (db: unknown, path: string) => unknown;
  query: (...args: unknown[]) => unknown;
  where: (field: string, op: string, value: unknown) => unknown;
  getDocs: (q: unknown) => Promise<{
    empty: boolean;
    docs: Array<{
      id: string;
      ref: unknown;
    }>;
  }>;
  writeBatch: (db: unknown) => {
    delete: (ref: unknown) => void;
    commit: () => Promise<void>;
  };
  limit: (n: number) => unknown;
  Timestamp: {
    fromMillis: (ms: number) => unknown;
  };
}
