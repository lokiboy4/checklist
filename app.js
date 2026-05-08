import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseSettings } from "./firebase-config.js";

const STORAGE_KEY = "pulse-checklist-v1";
const PERMANENT_TASKS = [
  {
    id: "perm-carrot",
    text: "Carrot",
    done: false,
    permanent: true,
    currentStock: 2,
    targetStock: 5,
    detail: "",
    photos: [],
    color: "default",
    section: "Produce",
  },
  {
    id: "perm-avocado",
    text: "Avocado",
    done: false,
    permanent: true,
    currentStock: 0,
    targetStock: 0,
    detail: "",
    photos: [],
    color: "default",
    section: "Produce",
  },
  {
    id: "perm-bread",
    text: "Bread",
    done: false,
    permanent: true,
    currentStock: 0,
    targetStock: 0,
    detail: "",
    photos: [],
    color: "default",
    section: "Bakery",
  },
];

const state = {
  ...loadInitialState(),
  syncMode: "local",
  selectedSection: "",
  currentPage: "checklist",
};

const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const sectionInput = document.getElementById("section-input");
const sectionPicker = document.getElementById("section-picker");
const fridgeForm = document.getElementById("fridge-form");
const fridgeInput = document.getElementById("fridge-input");
const fridgeSectionInput = document.getElementById("fridge-section-input");
const fridgeSectionPicker = document.getElementById("fridge-section-picker");
const mainMenuButton = document.getElementById("main-menu-button");
const mainPage = document.getElementById("main-page");
const checklistPage = document.getElementById("checklist-page");
const fridgePage = document.getElementById("fridge-page");
const orderPage = document.getElementById("order-page");
const menuPrep = document.getElementById("menu-prep");
const menuFridge = document.getElementById("menu-fridge");
const menuOrder = document.getElementById("menu-order");
const fridgeBack = document.getElementById("fridge-back");
const orderBack = document.getElementById("order-back");
const toolbarSectionSelector = document.getElementById("toolbar-section-selector");
const list = document.getElementById("task-list");
const fridgeList = document.getElementById("fridge-list");
const count = document.getElementById("count");
const syncStatus = document.getElementById("sync-status");
const template = document.getElementById("task-template");
const fridgeTemplate = document.getElementById("fridge-item-template");
const sectionHeaderTemplate = document.getElementById("section-header-template");
const fridgeSectionHeaderTemplate = document.getElementById("fridge-section-header-template");
const detailModal = document.getElementById("detail-modal");
const detailTitle = document.getElementById("detail-title");
const detailText = document.getElementById("detail-text");
const detailEdit = document.getElementById("detail-edit");
const detailPhotoInput = document.getElementById("detail-photo-input");
const detailPhotoPreview = document.getElementById("detail-photo-preview");
const detailPhotoButton = document.getElementById("detail-photo-button");
const detailSave = document.getElementById("detail-save");
const editModal = document.getElementById("edit-modal");
const editTitle = document.getElementById("edit-title");
const editRename = document.getElementById("edit-rename");
const editRemove = document.getElementById("edit-remove");
const pickupModal = document.getElementById("pickup-modal");
const pickupTitle = document.getElementById("pickup-title");
const pickupList = document.getElementById("pickup-list");

let activeDetailTaskId = null;
let activeDetailPhotos = [];
let activeEditTarget = null;
let cloudDocRef = null;

initializeSync();
render();

mainMenuButton.addEventListener("click", () => {
  state.currentPage = "main";
  render();
});

menuPrep.addEventListener("click", () => {
  state.currentPage = "checklist";
  render();
});

menuFridge.addEventListener("click", () => {
  state.currentPage = "fridge";
  render();
});

menuOrder.addEventListener("click", () => {
  state.currentPage = "order";
  render();
});

fridgeBack.addEventListener("click", () => {
  state.currentPage = "main";
  render();
});

orderBack.addEventListener("click", () => {
  state.currentPage = "main";
  render();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  const section = normalizeSection(sectionInput.value);
  if (!text) return;
  if (hasDuplicateName(state.tasks, text)) {
    window.alert(`"${text}" already exists in Prep checklist.`);
    return;
  }

  state.tasks.unshift(
    normalizeTask({
      id: crypto.randomUUID(),
      text,
      done: false,
      permanent: true,
      currentStock: 0,
      targetStock: 0,
      detail: "",
      photos: [],
      color: "default",
      section,
    }),
  );

  input.value = "";
  sectionInput.value = "";
  sectionPicker.value = "";
  state.selectedSection = "";
  render();
  void saveState();
});

fridgeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = fridgeInput.value.trim();
  const section = normalizeSection(fridgeSectionInput.value);
  if (!text) return;
  if (hasDuplicateName(state.fridgeItems, text)) {
    window.alert(`"${text}" already exists in My Fridge.`);
    return;
  }

  state.fridgeItems.unshift(
    normalizeFridgeItem({
      id: crypto.randomUUID(),
      text,
      currentStock: 0,
      targetStock: 0,
      section,
    }),
  );

  fridgeInput.value = "";
  fridgeSectionInput.value = "";
  fridgeSectionPicker.value = "";
  render();
  void saveState();
});

sectionPicker.addEventListener("change", () => {
  if (sectionPicker.value) {
    sectionInput.value = sectionPicker.value;
  }
});

fridgeSectionPicker.addEventListener("change", () => {
  if (fridgeSectionPicker.value) {
    fridgeSectionInput.value = fridgeSectionPicker.value;
  }
});

toolbarSectionSelector.addEventListener("change", () => {
  state.selectedSection = toolbarSectionSelector.value;
  render();
});

list.addEventListener("click", (event) => {
  const sectionButton = event.target.closest(".section-title-button");
  if (sectionButton) {
    const sectionItem = sectionButton.closest(".section-header");
    if (!sectionItem) return;
    renameChecklistSection(sectionItem.dataset.section);
    return;
  }

  const item = event.target.closest(".task-item");
  if (!item) return;

  const { id } = item.dataset;
  if (event.target.classList.contains("detail")) {
    const targetTask = state.tasks.find((task) => task.id === id);
    if (!targetTask) return;
    activeDetailTaskId = id;
    detailTitle.textContent = `${targetTask.text} detail`;
    detailText.value = targetTask.detail || "";
    activeDetailPhotos = normalizePhotos(targetTask.photos);
    detailPhotoInput.value = "";
    renderDetailPhotos();
    setDetailEditing(false);
    detailModal.showModal();
    return;
  }

  if (event.target.classList.contains("edit")) {
    openEditModal("task", id);
  }
});

fridgeList.addEventListener("click", (event) => {
  const sectionButton = event.target.closest(".section-title-button");
  if (sectionButton) {
    const sectionItem = sectionButton.closest(".section-header");
    if (!sectionItem) return;
    renameFridgeSection(sectionItem.dataset.section);
    return;
  }

  const pickupButton = event.target.closest(".pickup-button");
  if (pickupButton) {
    const sectionItem = pickupButton.closest(".section-header");
    if (!sectionItem) return;
    openPickupModal(sectionItem.dataset.section);
    return;
  }

  const item = event.target.closest(".fridge-item");
  if (!item) return;

  if (event.target.classList.contains("fridge-task-button")) {
    openEditModal("fridge", item.dataset.id);
  }
});

detailEdit.addEventListener("click", () => {
  setDetailEditing(true);
  detailText.focus();
});

detailPhotoInput.addEventListener("change", () => {
  const files = Array.from(detailPhotoInput.files || []);
  if (files.length === 0) return;

  const nextPhotos = [];
  let loadedCount = 0;

  for (const file of files) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        nextPhotos.push(reader.result);
      }
      loadedCount += 1;
      if (loadedCount === files.length) {
        activeDetailPhotos = [...activeDetailPhotos, ...nextPhotos];
        renderDetailPhotos();
      }
    });
    reader.readAsDataURL(file);
  }
});

detailSave.addEventListener("click", (event) => {
  event.preventDefault();
  if (!activeDetailTaskId) return;
  const task = state.tasks.find((entry) => entry.id === activeDetailTaskId);
  if (!task) return;

  task.detail = detailText.value.trim();
  task.photos = normalizePhotos(activeDetailPhotos);
  setDetailEditing(false);
  detailModal.close();
  activeDetailTaskId = null;
  render();
  void saveState();
});

detailModal.addEventListener("close", () => {
  activeDetailTaskId = null;
  activeDetailPhotos = [];
  detailPhotoInput.value = "";
  setDetailEditing(false);
});

editRename.addEventListener("click", () => {
  const target = getActiveEditEntry();
  if (!target) return;

  const nextName = window.prompt("New item name:", target.entry.text);
  if (nextName === null) return;
  const trimmed = nextName.trim();
  if (!trimmed) return;
  if (hasDuplicateName(target.items, trimmed, target.entry.id)) {
    window.alert(`"${trimmed}" already exists.`);
    return;
  }

  target.entry.text = trimmed;
  editModal.close();
  render();
  void saveState();
});

editRemove.addEventListener("click", () => {
  const target = getActiveEditEntry();
  if (!target) return;

  const confirmed = window.confirm(`Remove "${target.entry.text}"?`);
  if (!confirmed) return;

  target.items.splice(target.index, 1);
  editModal.close();
  render();
  void saveState();
});

editModal.addEventListener("close", () => {
  activeEditTarget = null;
});

list.addEventListener("change", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  const task = state.tasks.find((entry) => entry.id === item.dataset.id);
  if (!task) return;

  if (event.target.type === "checkbox") {
    task.done = event.target.checked;
    item.classList.toggle("done", task.done);
    updateCount();
    void saveState();
    return;
  }

  if (event.target.classList.contains("stock-current")) {
    task.currentStock = clampStock(Number.parseInt(event.target.value, 10));
    event.target.value = String(task.currentStock);
    void saveState();
    return;
  }

  if (event.target.classList.contains("stock-target")) {
    task.targetStock = clampStock(Number.parseInt(event.target.value, 10));
    event.target.value = String(task.targetStock);
    void saveState();
    return;
  }

  if (event.target.classList.contains("row-color")) {
    task.color = isAllowedColor(event.target.value) ? event.target.value : "default";
    render();
    void saveState();
  }
});

fridgeList.addEventListener("change", (event) => {
  const item = event.target.closest(".fridge-item");
  if (!item) return;
  const fridgeItem = state.fridgeItems.find((entry) => entry.id === item.dataset.id);
  if (!fridgeItem) return;

  if (event.target.classList.contains("stock-current")) {
    fridgeItem.currentStock = clampStock(Number.parseInt(event.target.value, 10));
    event.target.value = String(fridgeItem.currentStock);
    render();
    void saveState();
    return;
  }

  if (event.target.classList.contains("stock-target")) {
    fridgeItem.targetStock = clampStock(Number.parseInt(event.target.value, 10));
    event.target.value = String(fridgeItem.targetStock);
    render();
    void saveState();
  }
});

async function initializeSync() {
  if (!isFirebaseConfigured()) {
    render();
    return;
  }

  const app = initializeApp(firebaseSettings.config);
  const db = getFirestore(app);
  cloudDocRef = doc(db, firebaseSettings.collection, firebaseSettings.document);
  state.syncMode = "cloud";

  onSnapshot(
    cloudDocRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        await setDoc(cloudDocRef, serializeState());
        render();
        return;
      }

      const remoteData = snapshot.data() || {};
      const remoteTasksRaw = Array.isArray(remoteData.tasks) ? remoteData.tasks : [];
      const remoteFridgeRaw = Array.isArray(remoteData.fridgeItems)
        ? remoteData.fridgeItems
        : null;

      const remoteTasks = remoteTasksRaw.map(normalizeTask);
      const fallbackFridge = state.fridgeItems.length > 0
        ? state.fridgeItems
        : remoteTasks.map(createFridgeItemFromTask);
      const remoteFridgeItems = remoteFridgeRaw
        ? remoteFridgeRaw.map(normalizeFridgeItem)
        : fallbackFridge.map(normalizeFridgeItem);

      const shouldSeedCloud =
        remoteTasksRaw.length === 0 ||
        remoteFridgeRaw === null;

      if (remoteTasks.length > 0) {
        state.tasks = remoteTasks;
      }

      if (remoteFridgeItems.length > 0) {
        state.fridgeItems = remoteFridgeItems;
      }

      if (shouldSeedCloud) {
        await setDoc(cloudDocRef, serializeState());
      }

      render();
    },
    () => {
      state.syncMode = "local";
      render();
    },
  );
}

function render() {
  list.innerHTML = "";
  fridgeList.innerHTML = "";
  renderPages();
  renderSectionOptions();
  renderFridgeSectionOptions();
  renderToolbarSectionSelector();
  renderChecklist(getVisibleTasks());
  renderFridge(getSortedFridgeItems());
  updateCount();
}

function renderChecklist(visibleTasks) {
  let currentSection = null;

  for (const task of visibleTasks) {
    const normalizedSection = normalizeSection(task.section);
    if (normalizedSection !== currentSection) {
      const sectionNode = sectionHeaderTemplate.content.firstElementChild.cloneNode(true);
      sectionNode.dataset.section = normalizedSection;
      sectionNode.querySelector(".section-title-button").textContent = normalizedSection;
      list.appendChild(sectionNode);
      currentSection = normalizedSection;
    }

    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.querySelector("input").checked = task.done;
    node.querySelector(".task-text").textContent = task.text;
    fillStockOptions(node.querySelector(".stock-current"), task.currentStock);
    fillStockOptions(node.querySelector(".stock-target"), task.targetStock);
    node.querySelector(".row-color").value = isAllowedColor(task.color)
      ? task.color
      : "default";
    node.classList.add(`row-${isAllowedColor(task.color) ? task.color : "default"}`);
    node.classList.toggle("done", task.done);
    list.appendChild(node);
  }
}

function renderFridge(items) {
  let currentSection = null;

  for (const fridgeItem of items) {
    const normalizedSection = normalizeSection(fridgeItem.section);
    if (normalizedSection !== currentSection) {
      const sectionNode = fridgeSectionHeaderTemplate.content.firstElementChild.cloneNode(true);
      sectionNode.dataset.section = normalizedSection;
      sectionNode.querySelector(".section-title-button").textContent = normalizedSection;
      fridgeList.appendChild(sectionNode);
      currentSection = normalizedSection;
    }

    const node = fridgeTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = fridgeItem.id;
    node.querySelector(".fridge-task-text").textContent = fridgeItem.text;
    fillStockOptions(node.querySelector(".stock-current"), fridgeItem.currentStock);
    fillStockOptions(node.querySelector(".stock-target"), fridgeItem.targetStock);
    node.querySelector(".fridge-gap-value").textContent = String(
      Math.max(0, fridgeItem.targetStock - fridgeItem.currentStock),
    );
    fridgeList.appendChild(node);
  }
}

function renameChecklistSection(sectionName) {
  if (!sectionName) return;
  const nextName = window.prompt("New section name:", sectionName);
  if (nextName === null) return;

  const normalizedNext = normalizeSection(nextName);
  if (!normalizedNext) return;

  let changed = false;
  for (const task of state.tasks) {
    if (normalizeSection(task.section) === sectionName) {
      task.section = normalizedNext;
      changed = true;
    }
  }

  if (!changed) return;

  if (state.selectedSection === sectionName) {
    state.selectedSection = normalizedNext;
  }

  render();
  void saveState();
}

function renameFridgeSection(sectionName) {
  if (!sectionName) return;
  const nextName = window.prompt("New section name:", sectionName);
  if (nextName === null) return;

  const normalizedNext = normalizeSection(nextName);
  if (!normalizedNext) return;

  let changed = false;
  for (const item of state.fridgeItems) {
    if (normalizeSection(item.section) === sectionName) {
      item.section = normalizedNext;
      changed = true;
    }
  }

  if (!changed) return;

  render();
  void saveState();
}

function openPickupModal(sectionName) {
  const items = getSortedFridgeItems().filter(
    (item) =>
      normalizeSection(item.section) === sectionName &&
      item.targetStock - item.currentStock > 0,
  );

  pickupTitle.textContent = `${sectionName} pick up`;
  pickupList.innerHTML = "";

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "pickup-empty";
    emptyItem.textContent = "No items to pick up.";
    pickupList.appendChild(emptyItem);
  } else {
    for (const item of items) {
      const listItem = document.createElement("li");
      listItem.className = "pickup-item";
      const gapValue = item.targetStock - item.currentStock;
      listItem.textContent = `${item.text} ${gapValue}`;
      pickupList.appendChild(listItem);
    }
  }

  pickupModal.showModal();
}

function renderPages() {
  mainPage.hidden = state.currentPage !== "main";
  checklistPage.hidden = state.currentPage !== "checklist";
  fridgePage.hidden = state.currentPage !== "fridge";
  orderPage.hidden = state.currentPage !== "order";
}

function getVisibleTasks() {
  const sortedTasks = getSortedTasks();
  if (!state.selectedSection) return sortedTasks;

  return sortedTasks.filter(
    (task) => normalizeSection(task.section) === state.selectedSection,
  );
}

function getSortedTasks() {
  return [...state.tasks].sort((a, b) => {
    const sectionCompare = normalizeSection(a.section).localeCompare(
      normalizeSection(b.section),
      undefined,
      { sensitivity: "base" },
    );
    if (sectionCompare !== 0) return sectionCompare;
    return a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
  });
}

function getSortedFridgeItems() {
  return [...state.fridgeItems].sort((a, b) => {
    const sectionCompare = normalizeSection(a.section).localeCompare(
      normalizeSection(b.section),
      undefined,
      { sensitivity: "base" },
    );
    if (sectionCompare !== 0) return sectionCompare;
    return a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
  });
}

function renderSectionOptions() {
  const previousValue = sectionPicker.value;
  sectionPicker.innerHTML = "";
  const names = Array.from(
    new Set(state.tasks.map((task) => normalizeSection(task.section))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  appendPickerOptions(sectionPicker, names, previousValue);
}

function renderFridgeSectionOptions() {
  const previousValue = fridgeSectionPicker.value;
  fridgeSectionPicker.innerHTML = "";
  const names = Array.from(
    new Set(state.fridgeItems.map((item) => normalizeSection(item.section))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  appendPickerOptions(fridgeSectionPicker, names, previousValue);
}

function appendPickerOptions(select, names, previousValue) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Pick";
  placeholder.selected = previousValue === "";
  select.appendChild(placeholder);

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === previousValue;
    select.appendChild(option);
  }
}

function renderToolbarSectionSelector() {
  const previousValue = state.selectedSection;
  toolbarSectionSelector.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Show all sections";
  toolbarSectionSelector.appendChild(allOption);

  const names = Array.from(
    new Set(state.tasks.map((task) => normalizeSection(task.section))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    toolbarSectionSelector.appendChild(option);
  }

  toolbarSectionSelector.value = previousValue;
}

function updateCount() {
  const activeCount = state.tasks.filter((task) => !task.done).length;
  count.textContent = `${activeCount} task${activeCount === 1 ? "" : "s"} left`;
  syncStatus.textContent = state.syncMode === "cloud" ? "Cloud sync" : "Local only";
}

function setDetailEditing(isEditing) {
  detailText.disabled = !isEditing;
  detailSave.disabled = !isEditing;
  detailEdit.hidden = isEditing;
  detailPhotoInput.disabled = !isEditing;
  detailPhotoButton.classList.toggle("is-disabled", !isEditing);
}

function renderDetailPhotos() {
  detailPhotoPreview.innerHTML = "";
  if (activeDetailPhotos.length === 0) {
    detailPhotoPreview.hidden = true;
    return;
  }

  for (const photo of activeDetailPhotos) {
    const image = document.createElement("img");
    image.src = photo;
    image.alt = "Task detail photo";
    detailPhotoPreview.appendChild(image);
  }

  detailPhotoPreview.hidden = false;
}

function openEditModal(kind, id) {
  activeEditTarget = { kind, id };
  const target = getActiveEditEntry();
  if (!target) return;
  editTitle.textContent = `Edit ${target.entry.text}`;
  editModal.showModal();
}

function getActiveEditEntry() {
  if (!activeEditTarget) return null;
  const items = activeEditTarget.kind === "fridge" ? state.fridgeItems : state.tasks;
  const index = items.findIndex((entry) => entry.id === activeEditTarget.id);
  if (index < 0) return null;
  return {
    items,
    index,
    entry: items[index],
  };
}

async function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));

  if (cloudDocRef) {
    await setDoc(cloudDocRef, serializeState());
  }
}

function serializeState() {
  return {
    tasks: state.tasks.map(normalizeTask),
    fridgeItems: state.fridgeItems.map(normalizeFridgeItem),
  };
}

function loadInitialState() {
  const saved = loadLocalState();
  return {
    tasks: saved.tasks.map(normalizeTask),
    fridgeItems: saved.fridgeItems.map(normalizeFridgeItem),
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        tasks: PERMANENT_TASKS.map(cloneTask),
        fridgeItems: PERMANENT_TASKS.map(createFridgeItemFromTask),
      };
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        tasks: parsed,
        fridgeItems: parsed.map(createFridgeItemFromTask),
      };
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        tasks: PERMANENT_TASKS.map(cloneTask),
        fridgeItems: PERMANENT_TASKS.map(createFridgeItemFromTask),
      };
    }

    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : PERMANENT_TASKS.map(cloneTask);
    const fridgeItems = Array.isArray(parsed.fridgeItems)
      ? parsed.fridgeItems
      : tasks.map(createFridgeItemFromTask);

    return { tasks, fridgeItems };
  } catch {
    return {
      tasks: PERMANENT_TASKS.map(cloneTask),
      fridgeItems: PERMANENT_TASKS.map(createFridgeItemFromTask),
    };
  }
}

function normalizeTask(item) {
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    text: typeof item.text === "string" && item.text.trim() ? item.text.trim() : "Untitled",
    done: Boolean(item.done),
    permanent: true,
    currentStock: clampStock(item.currentStock),
    targetStock: clampStock(item.targetStock),
    detail: typeof item.detail === "string" ? item.detail : "",
    photos: normalizePhotos(item.photos ?? item.photo),
    color: isAllowedColor(item.color) ? item.color : "default",
    section: normalizeSection(item.section),
  };
}

function normalizeFridgeItem(item) {
  return {
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    text: typeof item.text === "string" && item.text.trim() ? item.text.trim() : "Untitled",
    currentStock: clampStock(item.currentStock),
    targetStock: clampStock(item.targetStock),
    section: normalizeSection(item.section),
  };
}

function createFridgeItemFromTask(task) {
  return normalizeFridgeItem({
    id: `fridge-${task.id}`,
    text: task.text,
    currentStock: task.currentStock,
    targetStock: task.targetStock,
    section: task.section,
  });
}

function hasDuplicateName(items, text, excludeId = "") {
  const normalizedText = normalizeName(text);
  return items.some(
    (item) => item.id !== excludeId && normalizeName(item.text) === normalizedText,
  );
}

function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePhotos(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

function fillStockOptions(select, selectedValue) {
  select.innerHTML = "";
  for (let value = 0; value <= 20; value += 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    option.selected = value === selectedValue;
    select.appendChild(option);
  }
}

function isAllowedColor(value) {
  return (
    value === "default" ||
    value === "red" ||
    value === "yellow" ||
    value === "blue" ||
    value === "green"
  );
}

function normalizeSection(value) {
  if (typeof value !== "string") return "General";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "General";

  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function clampStock(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(20, Math.max(0, Math.floor(value)));
}

function cloneTask(task) {
  return {
    ...task,
    photos: [...normalizePhotos(task.photos)],
  };
}

function isFirebaseConfigured() {
  const { enabled, config, collection, document } = firebaseSettings;
  return Boolean(
    enabled &&
      config &&
      collection &&
      document &&
      !Object.values(config).some(
        (value) => typeof value === "string" && value.startsWith("PASTE_"),
      ),
  );
}
