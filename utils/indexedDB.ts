import { Building } from '../types';

const DB_NAME = 'evil-atlas';
const DB_VERSION = 1;
const STORE_NAME = 'buildings';

// Open IndexedDB database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Save buildings to IndexedDB
export const saveBuildingsToIndexedDB = async (buildings: Building[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Add all buildings
    await Promise.all(buildings.map(b => 
      new Promise<void>((resolve, reject) => {
        const putRequest = store.put(b);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      })
    ));
    
    console.log(`💾 Saved ${buildings.length} buildings to IndexedDB`);
  } catch (error) {
    console.error('Error saving buildings to IndexedDB:', error);
    // Don't throw - IndexedDB failures shouldn't break the app
  }
};

// Load buildings from IndexedDB
export const loadBuildingsFromIndexedDB = async (): Promise<Building[]> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const request = store.getAll();
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    const buildings = request.result || [];
    console.log(`📦 Loaded ${buildings.length} buildings from IndexedDB`);
    return buildings;
  } catch (error) {
    console.error('Error loading buildings from IndexedDB:', error);
    return [];
  }
};

// Clear IndexedDB cache
export const clearIndexedDBCache = async (): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const clearRequest = tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    console.log('🗑️ Cleared IndexedDB cache');
  } catch (error) {
    console.error('Error clearing IndexedDB cache:', error);
  }
};

