let db;
const DB_NAME = "ExpirationTrackerDB";
const STORE_NAME = "items";

/* =====================================================
   DB READY HANDLING (CRITICAL FIX)
===================================================== */
let dbReadyCallbacks = [];

function onDBReady(callback) {
  if (db) {
    callback();
  } else {
    dbReadyCallbacks.push(callback);
  }
}

/* =====================================================
   OPEN DATABASE
===================================================== */
const request = indexedDB.open(DB_NAME, 1);

request.onupgradeneeded = e => {
  db = e.target.result;

  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: "barcode" });
  }
};

request.onsuccess = e => {
  db = e.target.result;

  // Notify all waiting callbacks
  dbReadyCallbacks.forEach(cb => cb());
  dbReadyCallbacks = [];
};

request.onerror = () => {
  alert("Failed to open database");
};

/* =====================================================
   ADD / UPDATE ITEM
===================================================== */
function addItem(item, callback) {
  onDBReady(() => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => callback && callback();
  });
}

/* =====================================================
   GET ONE ITEM
===================================================== */
function getItem(barcode, callback) {
  onDBReady(() => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(barcode);
    req.onsuccess = () => callback(req.result);
  });
}

/* =====================================================
   GET ALL ITEMS
===================================================== */
function getAllItems(callback) {
  onDBReady(() => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => callback(req.result || []);
  });
}

/* =====================================================
   DELETE ITEM
===================================================== */
function deleteItemByBarcode(barcode, callback) {
  onDBReady(() => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(barcode);
    tx.oncomplete = () => callback && callback();
  });
}
