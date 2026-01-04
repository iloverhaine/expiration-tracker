let db = null;

const request = indexedDB.open("ExpirationTrackerDB", 1);

request.onupgradeneeded = event => {
  db = event.target.result;

  if (!db.objectStoreNames.contains("items")) {
    const store = db.createObjectStore("items", {
      keyPath: "barcode"
    });
    store.createIndex("name", "name", { unique: false });
  }
};

request.onsuccess = event => {
  db = event.target.result;
  console.log("IndexedDB ready");
};

request.onerror = event => {
  console.error("IndexedDB error:", event.target.error);
};

// ADD / UPDATE ITEM
function addItem(item, onDone) {
  const tx = db.transaction("items", "readwrite");
  const store = tx.objectStore("items");

  item.barcode = String(item.barcode);
  store.put(item);

  tx.oncomplete = () => {
    if (onDone) onDone();
  };
}

// GET ITEM
function getItem(value, callback) {
  const tx = db.transaction("items", "readonly");
  const store = tx.objectStore("items");

  const req = store.get(String(value));
  req.onsuccess = () => {
    if (req.result) {
      callback(req.result);
    } else {
      store.index("name").get(value).onsuccess = e =>
        callback(e.target.result || null);
    }
  };
}

// GET ALL ITEMS
function getAllItems(callback) {
  const tx = db.transaction("items", "readonly");
  const store = tx.objectStore("items");
  const items = [];

  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      items.push(cursor.value);
      cursor.continue();
    } else {
      callback(items);
    }
  };
}

// DELETE ITEM
function deleteItemByBarcode(barcode, onDone) {
  const tx = db.transaction("items", "readwrite");
  tx.objectStore("items").delete(String(barcode));
  tx.oncomplete = () => onDone && onDone();
}