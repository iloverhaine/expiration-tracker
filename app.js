/* =====================================================
   HELPERS
===================================================== */
function $(id) {
  return document.getElementById(id);
}

/* =====================================================
   GLOBALS (INVENTORY PERFORMANCE)
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
      alert("Item saved successfully");
      updateDashboardFromDB();
    });
  });
}

/* =====================================================
   BARCODE SEARCH (AUTO-FILL)
===================================================== */
function searchByBarcode() {
  const input = $("searchBarcode") || $("barcode");
  if (!input) return;

  const barcode = input.value.trim();
  if (!barcode) return;

  getItem(barcode, item => {
    if (!item) {
      $("barcode").value = barcode;
      return;
    }

    $("name").value = item.name || "";
    $("barcode").value = item.barcode || barcode;
    $("description").value = item.description || "";
  });
}

/* =====================================================
   INVENTORY LOAD
===================================================== */
function loadInventory() {
  if (!$("inventoryBody")) return;

  getAllItems(items => {
    allInventoryItems = items.filter(i => i.expiry && i.quantity > 0);
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
  const expiryInput = document.querySelector(`input[data-expiry="${barcode}"]`);
  const qtyInput = document.querySelector(`input[data-qty="${barcode}"]`);

  if (!expiryInput || !qtyInput) return;

  const newExpiry = expiryInput.value;
  const newQty = Number(qtyInput.value);

  if (!newExpiry || newQty <= 0) {
    alert("Invalid values");
    return;
  }

  getItem(barcode, item => {
    if (!item) return;

    item.expiry = newExpiry;
    item.quantity = newQty;

    addItem(item, () => {
      editingBarcode = null;
      loadInventory();
      updateDashboardFromDB();
    });
  });
}

/* =====================================================
   VIRTUAL SCROLL RENDER
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
  today.setHours(0, 0, 0, 0);

  for (let i = start; i < end; i++) {
    const item = filteredInventory[i];
    const tr = document.createElement("tr");

    if (new Date(item.expiry) < today) {
      tr.className = "expired-row";
    }

    const isEditing = editingBarcode === item.barcode;

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.barcode}</td>
      <td>${item.description || ""}</td>

      <td>
        ${
          isEditing
            ? `<input type="date" value="${item.expiry}" data-expiry="${item.barcode}">`
            : item.expiry
        }
      </td>

      <td>
        ${
          isEditing
            ? `<input type="number" min="1" value="${item.quantity}" data-qty="${item.barcode}">`
            : item.quantity
        }
      </td>

      <td>
        ${
          isEditing
            ? `<button title="Save" onclick="saveEdit('${item.barcode}')">💾</button>`
            : `
              <button title="Edit" onclick="startEdit('${item.barcode}')">✏️</button>
              <button title="Delete" onclick="deleteItem('${item.barcode}')">🗑️</button>
            `
        }
      </td>
    `;

    tbody.appendChild(tr);
  }
}

/* =====================================================
   DELETE ITEM
===================================================== */
function deleteItem(barcode) {
  if (!confirm("Delete this item?")) return;
  deleteItemByBarcode(barcode, () => {
    loadInventory();
    updateDashboardFromDB();
  });
}

/* =====================================================
   DASHBOARD (FIXED & WORKING)
===================================================== */
function updateDashboardFromDB() {
  getAllItems(items => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveMonthsLater = new Date(today);
    fiveMonthsLater.setMonth(today.getMonth() + 5);

    let expired = 0;
    let toReturn = 0;

    items.forEach(i => {
      if (!i.expiry || i.quantity <= 0) return;

      const exp = new Date(i.expiry);

      if (exp < today) {
        expired++;
      } else if (exp >= today && exp <= fiveMonthsLater) {
        toReturn++;
      }
    });

    if ($("expiredCount")) $("expiredCount").textContent = expired;
    if ($("returnCount")) $("returnCount").textContent = toReturn;
  });
}

/* =====================================================
   ACTIVE TAB
===================================================== */
function highlightActiveTab() {
  const page = location.pathname.split("/").pop();
  document.querySelectorAll(".bottom-tab a").forEach(t =>
    t.classList.remove("active")
  );

  if (page === "index.html") document.querySelector('[data-tab="inventory"]')?.classList.add("active");
  if (page === "add.html") document.querySelector('[data-tab="add"]')?.classList.add("active");
  if (page === "dashboard.html") document.querySelector('[data-tab="dashboard"]')?.classList.add("active");
}

/* =====================================================
   BOOTSTRAP (DB READY SAFE)
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const scrollBox = $("inventoryScroll");
  if (scrollBox) {
    scrollBox.addEventListener("scroll", () => {
      renderVirtualRows(scrollBox.scrollTop);
    });
  }

  if (typeof onDBReady === "function") {
    onDBReady(() => {
      if ($("inventoryBody")) loadInventory();
      if ($("expiredCount") || $("returnCount")) updateDashboardFromDB();
      highlightActiveTab();
    });
  }
});
