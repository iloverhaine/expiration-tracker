/* =====================================================
   HELPERS
===================================================== */
function $(id) {
  return document.getElementById(id);
}

/* =====================================================
   GLOBALS
===================================================== */
let allInventoryItems = [];
let filteredInventory = [];
let editingBarcode = null;

const rowHeight = 44;
const visibleRows = 30;

/* =====================================================
   ADD / UPDATE ITEM
===================================================== */
if ($("itemForm")) {
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
      alert("Complete all required fields");
      return;
    }

    addItem(item, () => {
      $("itemForm").reset();
      updateDashboardFromDB();
      loadInventory();
      alert("Item saved");
    });
  });
}

/* =====================================================
   BARCODE SEARCH
===================================================== */
function searchByBarcode() {
  const barcode = $("searchBarcode")?.value || $("barcode")?.value;
  if (!barcode) return;

  getItem(barcode, item => {
    if (!item) {
      $("barcode").value = barcode;
      return;
    }

    $("name").value = item.name;
    $("barcode").value = item.barcode;
    $("description").value = item.description || "";
  });
}

/* =====================================================
   INVENTORY LOAD
===================================================== */
function loadInventory() {
  if (!$("inventoryBody")) return;

  getAllItems(items => {
    allInventoryItems = items.filter(i => i.quantity > 0);
    applyInventoryFilter();
  });
}

/* =====================================================
   INVENTORY SEARCH
===================================================== */
function filterInventory() {
  applyInventoryFilter();
}

function applyInventoryFilter() {
  const q = ($("inventorySearch")?.value || "").toLowerCase();

  filteredInventory = allInventoryItems.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.barcode.includes(q)
  );

  renderVirtualRows(0);
}

/* =====================================================
   INLINE EDIT
===================================================== */
function startEdit(barcode) {
  editingBarcode = barcode;
  renderVirtualRows($("inventoryScroll").scrollTop);
}

function saveEdit(barcode) {
  const expiry = document.querySelector(`input[data-expiry="${barcode}"]`)?.value;
  const qty = Number(document.querySelector(`input[data-qty="${barcode}"]`)?.value);

  if (!expiry || qty <= 0) {
    alert("Invalid values");
    return;
  }

  getItem(barcode, item => {
    item.expiry = expiry;
    item.quantity = qty;

    addItem(item, () => {
      editingBarcode = null;
      loadInventory();
      updateDashboardFromDB();
    });
  });
}

/* =====================================================
   VIRTUAL SCROLL
===================================================== */
function renderVirtualRows(scrollTop) {
  const tbody = $("inventoryBody");
  const scrollBox = $("inventoryScroll");
  if (!tbody || !scrollBox) return;

  const start = Math.floor(scrollTop / rowHeight);
  const end = Math.min(start + visibleRows, filteredInventory.length);

  tbody.innerHTML = "";
  tbody.style.transform = `translateY(${start * rowHeight}px)`;
  tbody.style.height = filteredInventory.length * rowHeight + "px";

  const today = new Date();
  today.setHours(0,0,0,0);

  for (let i = start; i < end; i++) {
    const item = filteredInventory[i];
    const expired = new Date(item.expiry) < today;
    const editing = editingBarcode === item.barcode;

    tbody.innerHTML += `
      <tr class="${expired ? "expired-row" : ""}">
        <td>${item.name}</td>
        <td>${item.barcode}</td>
        <td>${item.description || ""}</td>
        <td>
          ${editing ? `<input type="date" value="${item.expiry}" data-expiry="${item.barcode}">` : item.expiry}
        </td>
        <td>
          ${editing ? `<input type="number" min="1" value="${item.quantity}" data-qty="${item.barcode}">` : item.quantity}
        </td>
        <td>
          ${
            editing
              ? `<button title="Save" onclick="saveEdit('${item.barcode}')">💾</button>`
              : `<button title="Edit" onclick="startEdit('${item.barcode}')">✏️</button>
                 <button title="Delete" onclick="deleteItem('${item.barcode}')">🗑️</button>`
          }
        </td>
      </tr>
    `;
  }
}

/* =====================================================
   DELETE
===================================================== */
function deleteItem(barcode) {
  if (!confirm("Delete this item?")) return;
  deleteItemByBarcode(barcode, () => {
    loadInventory();
    updateDashboardFromDB();
  });
}

/* =====================================================
   IMPORT PRODUCTS
===================================================== */
function importData() {
  const file = $("importFile")?.files[0];
  if (!file) return alert("Select an Excel file");

  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(e.target.result, { type: "binary" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    rows.forEach(r => {
      if (!r.Barcode || !r["item name"]) return;
      addItem({
        name: r["item name"],
        barcode: String(r.Barcode),
        description: r.Description || "",
        expiry: "",
        quantity: 0
      });
    });

    alert("Products imported");
  };
  reader.readAsBinaryString(file);
}

/* =====================================================
   EXPORT INVENTORY
===================================================== */
function exportToExcel() {
  getAllItems(items => {
    const exportItems = items.filter(i => i.quantity > 0);
    if (!exportItems.length) return alert("No data");

    exportItems.sort((a,b) => new Date(a.expiry || "2100") - new Date(b.expiry || "2100"));

    let total = 0;
    const data = exportItems.map(i => {
      total += i.quantity;
      return {
        Name: i.name,
        Barcode: i.barcode,
        Description: i.description || "",
        Expiry: i.expiry || "",
        Quantity: i.quantity
      };
    });

    data.push({ Name: "TOTAL", Quantity: total });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, "inventory_export.xlsx");
  });
}

/* =====================================================
   DASHBOARD
===================================================== */
function updateDashboardFromDB() {
  getAllItems(items => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const fiveMonthsLater = new Date(today);
    fiveMonthsLater.setMonth(today.getMonth() + 5);

    let expired = 0;
    let toReturn = 0;

    items.forEach(i => {
      if (!i.expiry || i.quantity <= 0) return;
      const exp = new Date(i.expiry);
      if (exp < today) expired++;
      else if (exp <= fiveMonthsLater) toReturn++;
    });

    $("expiredCount") && ($("expiredCount").textContent = expired);
    $("returnCount") && ($("returnCount").textContent = toReturn);
  });
}

/* =====================================================
   BOOTSTRAP
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  $("inventoryScroll")?.addEventListener("scroll", e =>
    renderVirtualRows(e.target.scrollTop)
  );

  if (typeof onDBReady === "function") {
    onDBReady(() => {
      loadInventory();
      updateDashboardFromDB();
    });
  }
});
