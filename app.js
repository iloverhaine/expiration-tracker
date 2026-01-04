function $(id) {
  return document.getElementById(id);
}

// ================================
// SAVE ITEM
// ================================
$("itemForm").addEventListener("submit", e => {
  e.preventDefault();

  const item = {
    name: $("name").value.trim(),
    barcode: $("barcode").value.trim(),
    description: $("description").value.trim(),
    expiry: $("expiry").value,
    quantity: Number($("quantity").value)
  };

  if (!item.name || !item.barcode || !item.expiry || item.quantity <= 0) {
    alert("Please complete all required fields correctly");
    return;
  }

  addItem(item, () => {
    $("name").value = "";
    $("barcode").value = "";
    $("description").value = "";
    $("expiry").value = "";
    $("quantity").value = "";
    $("search").value = "";
    $("name").focus();

    loadInventoryTable();
  });
});

// ================================
// BARCODE-ONLY SEARCH + AUTO-FILL
// ================================
function searchByBarcode() {
  const barcode = $("search").value.trim();

  if (!barcode) return;

  getItem(barcode, item => {
    if (!item) {
      alert("No item found for this barcode");
      return;
    }

    $("name").value = item.name || "";
    $("barcode").value = item.barcode || "";
    $("description").value = item.description || "";
  });
}

// ================================
// IMPORT (EXACT TEMPLATE)
// Barcode | item name | Description
// ================================
function importData() {
  const file = $("importFile").files[0];
  if (!file) return alert("Please select an Excel file");

  const reader = new FileReader();

  reader.onload = e => {
    const workbook = XLSX.read(e.target.result, { type: "binary" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      alert("No data found");
      return;
    }

    rows.forEach(row => {
      if (!row.Barcode || !row["item name"]) return;

      addItem({
        name: String(row["item name"]).trim(),
        barcode: String(row.Barcode).trim(),
        description: String(row.Description || "").trim(),
        expiry: "",
        quantity: 0
      });
    });

    alert("Import completed");
    loadInventoryTable();
  };

  reader.readAsBinaryString(file);
}

// ================================
// BARCODE SCANNER
// Auto-search + Beep + Vibrate
// ================================
function startScanner() {
  const scanner = $("scanner");
  scanner.style.display = "block";

  Quagga.init({
    inputStream: {
      type: "LiveStream",
      target: scanner,
      constraints: { facingMode: "environment" }
    },
    decoder: {
      readers: ["ean_reader", "upc_reader", "code_128_reader"]
    }
  }, err => {
    if (err) {
      alert("Camera error");
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(data => {
    const code = data.codeResult.code;

    Quagga.stop();
    scanner.style.display = "none";

    // Feedback
    playBeep();
    vibrate();

    // Auto-fill & auto-search
    $("barcode").value = code;
    $("search").value = code;
    searchByBarcode();
  });
}

// ================================
// FEEDBACK
// ================================
function playBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 1000;
  gain.gain.value = 0.2;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.15);
}

function vibrate() {
  if (navigator.vibrate) {
    navigator.vibrate(150);
  }
}

// ================================
// LOAD INVENTORY (FILTERED VIEW)
// Only expiry + qty > 0
// ================================
function loadInventoryTable() {
  getAllItems(items => {
    const tbody = $("inventoryBody");
    tbody.innerHTML = "";

    let expired = 0;
    let toReturn = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveMonthsLater = new Date(today);
    fiveMonthsLater.setMonth(today.getMonth() + 5);

    const visibleItems = items.filter(i =>
      i.expiry && Number(i.quantity) > 0
    );

    if (!visibleItems.length) {
      tbody.innerHTML =
        `<tr><td colspan="6">No active inventory</td></tr>`;
      updateDashboard(0, 0);
      return;
    }

    visibleItems.sort(
      (a, b) => new Date(a.expiry) - new Date(b.expiry)
    );

    visibleItems.forEach(item => {
      const expiryDate = new Date(item.expiry);

      if (expiryDate < today) expired++;
      else if (expiryDate >= fiveMonthsLater) toReturn++;

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.barcode}</td>
        <td>
          <input value="${item.description || ""}"
            onchange="updateItem('${item.barcode}','description',this.value)">
        </td>
        <td>
          <input type="date" value="${item.expiry}"
            onchange="updateItem('${item.barcode}','expiry',this.value)">
        </td>
        <td>
          <input type="number" value="${item.quantity}"
            onchange="updateItem('${item.barcode}','quantity',this.value)">
        </td>
        <td>
          <button type="button" onclick="deleteItem('${item.barcode}')">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

    updateDashboard(expired, toReturn);
  });
}

// ================================
// DASHBOARD
// ================================
function updateDashboard(expired, toReturn) {
  $("expiredCount").textContent = expired;
  $("returnCount").textContent = toReturn;
}

// ================================
// UPDATE / DELETE
// ================================
function updateItem(barcode, field, value) {
  getItem(barcode, item => {
    if (!item) return;
    item[field] = field === "quantity" ? Number(value) : value;
    addItem(item, loadInventoryTable);
  });
}

function deleteItem(barcode) {
  if (!confirm("Delete this item?")) return;
  deleteItemByBarcode(barcode, loadInventoryTable);
}

// ================================
// EXPORT
// ================================
function exportToExcel() {
  getAllItems(items => {
    if (!items.length) return alert("No items to export");

    const data = items.map(i => ({
      Name: i.name,
      Barcode: i.barcode,
      Description: i.description || "",
      "Expiry Date": i.expiry || "",
      Quantity: i.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");

    XLSX.writeFile(wb, "inventory.xlsx");
  });
}

// ================================
// INIT
// ================================
window.onload = () => {
  setTimeout(loadInventoryTable, 300);
};