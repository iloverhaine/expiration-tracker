const inventoryTable = document.getElementById("inventoryTable");
const expiredCount = document.getElementById("expiredCount");
const soonCount = document.getElementById("soonCount");
const returnCount = document.getElementById("returnCount");
const scannerDiv = document.getElementById("scanner");

let editingBarcode = null;

/* ---------- SOUND + VIBRATION ---------- */
function beep() {
  const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAAAA");
  audio.play();
  if (navigator.vibrate) navigator.vibrate(200);
}

/* ---------- SAVE / UPDATE ---------- */
function saveItem() {
  const item = {
    name: name.value,
    barcode: barcode.value,
    description: description.value,
    expiry: expiry.value,
    quantity: Number(quantity.value)
  };

  dbSave(item);
  editingBarcode = null;
  clearForm();
  loadInventory();
  beep();
}

/* ---------- CLEAR FORM ---------- */
function clearForm() {
  ["name","barcode","description","expiry","quantity"].forEach(id => document.getElementById(id).value = "");
}

/* ---------- SEARCH ---------- */
function searchByBarcode() {
  const item = dbFind(searchBarcode.value);
  if (!item) return alert("Item not found");

  fillForm(item);
}

/* ---------- FILL FORM ---------- */
function fillForm(item) {
  name.value = item.name;
  barcode.value = item.barcode;
  description.value = item.description;
  expiry.value = item.expiry;
  quantity.value = item.quantity;
  editingBarcode = item.barcode;
}

/* ---------- DELETE ---------- */
function deleteItem(code) {
  if (!confirm("Delete this item?")) return;
  dbDelete(code);
  loadInventory();
}

/* ---------- INVENTORY ---------- */
function loadInventory() {
  inventoryTable.innerHTML = "";
  let expired=0, soon=0, ret=0;

  dbAll().forEach(item => {
    const months = (new Date(item.expiry) - new Date()) / (1000*60*60*24*30);

    let status="OK", cls="ok";
    if (months < 0) { status="Expired"; cls="expired"; expired++; }
    else if (months <= 5) { status="Expiring Soon"; cls="soon"; soon++; }
    else { status="To Be Returned"; cls="return"; ret++; }

    inventoryTable.innerHTML += `
      <tr onclick='fillForm(${JSON.stringify(item)})'>
        <td>${item.name}</td>
        <td>${item.barcode}</td>
        <td>${item.expiry}</td>
        <td>${item.quantity}</td>
        <td class="${cls}">${status}</td>
        <td><button onclick="event.stopPropagation();deleteItem('${item.barcode}')">🗑</button></td>
      </tr>`;
  });

  expiredCount.textContent = expired;
  soonCount.textContent = soon;
  returnCount.textContent = ret;
}

/* ---------- EXCEL EXPORT ---------- */
function exportExcel() {
  const data = dbAll();
  if (!data.length) return alert("No data to export");

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");

  XLSX.writeFile(wb, "Expiration_Inventory.xlsx");
}

/* ---------- BARCODE SCANNER ---------- */
function startScanner() {
  scannerDiv.style.display = "block";

  Quagga.init({
    inputStream: {
      type: "LiveStream",
      target: scannerDiv,
      constraints: { facingMode: "environment" }
    },
    decoder: { readers: ["ean_reader","ean_13_reader","upc_reader"] }
  }, () => Quagga.start());

  Quagga.onDetected(data => {
    const code = data.codeResult.code.slice(0,12);
    barcode.value = code;
    searchBarcode.value = code;
    Quagga.stop();
    scannerDiv.style.display = "none";
    beep();
  });
}

loadInventory();