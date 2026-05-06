const STORAGE_KEY = "pulse-checklist-v1";
const PERMANENT_TASKS = [
  { id: "perm-carrot", text: "Carrot", done: false, permanent: true, currentStock: 2, targetStock: 5, detail: "", color: "default", section: "Produce" },
  { id: "perm-avocado", text: "Avocado", done: false, permanent: true, currentStock: 0, targetStock: 0, detail: "", color: "default", section: "Produce" },
  { id: "perm-bread", text: "Bread", done: false, permanent: true, currentStock: 0, targetStock: 0, detail: "", color: "default", section: "Bakery" },
];

const state = {
  tasks: loadTasks(),
};

const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const sectionInput = document.getElementById("section-input");
const sectionOptions = document.getElementById("section-options");
const list = document.getElementById("task-list");
const count = document.getElementById("count");
const clearDoneButton = document.getElementById("clear-done");
const template = document.getElementById("task-template");
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
let activeDetailTaskId = null;
let activeEditTaskId = null;
let activeDetailPhotos = [];

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  const section = normalizeSection(sectionInput.value);
  if (!text) return;

  state.tasks.unshift({
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
  });

  input.value = "";
  sectionInput.value = "";
  persist();
  render();
});

list.addEventListener("click", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;

  const { id } = item.dataset;
  if (event.target.classList.contains("detail")) {
    const targetTask = state.tasks.find((task) => task.id === id);
    if (!targetTask) return;
    activeDetailTaskId = id;
    detailTitle.textContent = `${targetTask.text} detail`;
    detailText.value = targetTask.detail || "";
    activeDetailPhotos = normalizePhotos(targetTask.photos ?? targetTask.photo);
    detailPhotoInput.value = "";
    renderDetailPhotos();
    setDetailEditing(false);
    detailModal.showModal();
    return;
  }

  if (event.target.classList.contains("edit")) {
    const targetTask = state.tasks.find((task) => task.id === id);
    if (!targetTask) return;
    activeEditTaskId = id;
    editTitle.textContent = `Edit ${targetTask.text}`;
    editModal.showModal();
    return;
  }
});

detailEdit.addEventListener("click", () => {
  setDetailEditing(true);
  detailText.focus();
});

detailPhotoInput.addEventListener("change", () => {
  const files = Array.from(detailPhotoInput.files || []);
  if (files.length === 0) return;

  const pending = files.length;
  let loaded = 0;
  const nextPhotos = [];

  for (const file of files) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        nextPhotos.push(reader.result);
      }
      loaded += 1;
      if (loaded === pending) {
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
  task.photos = [...activeDetailPhotos];
  persist();
  setDetailEditing(false);
  detailModal.close();
  activeDetailTaskId = null;
});

detailModal.addEventListener("close", () => {
  activeDetailTaskId = null;
  activeDetailPhotos = [];
  detailPhotoInput.value = "";
  setDetailEditing(false);
});

editRename.addEventListener("click", () => {
  if (!activeEditTaskId) return;
  const targetTask = state.tasks.find((task) => task.id === activeEditTaskId);
  if (!targetTask) return;
  const nextName = window.prompt("New checklist name:", targetTask.text);
  if (nextName === null) return;
  const trimmed = nextName.trim();
  if (!trimmed) return;
  targetTask.text = trimmed;
  persist();
  render();
  editModal.close();
});

editRemove.addEventListener("click", () => {
  if (!activeEditTaskId) return;
  const targetTask = state.tasks.find((task) => task.id === activeEditTaskId);
  if (!targetTask) return;
  const confirmed = window.confirm(`Remove "${targetTask.text}"?`);
  if (!confirmed) return;
  state.tasks = state.tasks.filter((task) => task.id !== activeEditTaskId);
  persist();
  render();
  editModal.close();
});

editModal.addEventListener("close", () => {
  activeEditTaskId = null;
});

list.addEventListener("change", (event) => {
  const item = event.target.closest(".task-item");
  if (!item) return;
  const { id } = item.dataset;
  const task = state.tasks.find((entry) => entry.id === id);
  if (!task) return;

  if (event.target.type === "checkbox") {
    task.done = event.target.checked;
    persist();
    item.classList.toggle("done", task.done);
    updateCount();
    return;
  }

  if (event.target.classList.contains("stock-current")) {
    task.currentStock = clampStock(Number.parseInt(event.target.value, 10));
    event.target.value = task.currentStock;
    persist();
    return;
  }

  if (event.target.classList.contains("stock-target")) {
    task.targetStock = clampStock(Number.parseInt(event.target.value, 10));
    event.target.value = task.targetStock;
    persist();
    return;
  }

  if (event.target.classList.contains("row-color")) {
    const nextColor = event.target.value;
    task.color = isAllowedColor(nextColor) ? nextColor : "default";
    persist();
    render();
  }
});

clearDoneButton.addEventListener("click", () => {
  state.tasks = state.tasks.map((task) => ({ ...task, done: false }));
  persist();
  render();
});

function getVisibleTasks() {
  return [...state.tasks].sort((a, b) => {
    const sectionCompare = normalizeSection(a.section).localeCompare(normalizeSection(b.section), undefined, { sensitivity: "base" });
    if (sectionCompare !== 0) return sectionCompare;
    return a.text.localeCompare(b.text, undefined, { sensitivity: "base" });
  });
}

function render() {
  list.innerHTML = "";
  renderSectionOptions();

  const visibleTasks = getVisibleTasks();
  let currentSection = null;
  for (const task of visibleTasks) {
    const normalizedSection = normalizeSection(task.section);
    if (normalizedSection !== currentSection) {
      const sectionNode = document.createElement("li");
      sectionNode.className = "section-header";
      sectionNode.textContent = normalizedSection;
      list.appendChild(sectionNode);
      currentSection = normalizedSection;
    }

    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.querySelector("input").checked = task.done;
    node.querySelector(".task-text").textContent = task.text;
    fillStockOptions(node.querySelector(".stock-current"), task.currentStock);
    fillStockOptions(node.querySelector(".stock-target"), task.targetStock);
    node.querySelector(".row-color").value = isAllowedColor(task.color) ? task.color : "default";
    node.classList.add(`row-${isAllowedColor(task.color) ? task.color : "default"}`);
    node.classList.toggle("done", task.done);
    list.appendChild(node);
  }

  updateCount();
}

function renderSectionOptions() {
  sectionOptions.innerHTML = "";
  const names = Array.from(
    new Set(state.tasks.map((task) => normalizeSection(task.section))),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    sectionOptions.appendChild(option);
  }
}

function updateCount() {
  const activeCount = state.tasks.filter((task) => !task.done).length;
  count.textContent = `${activeCount} task${activeCount === 1 ? "" : "s"} left`;
}

function setDetailEditing(isEditing) {
  detailText.disabled = !isEditing;
  detailSave.disabled = !isEditing;
  detailEdit.hidden = isEditing;
  detailPhotoInput.disabled = !isEditing;
  detailPhotoButton.classList.toggle("is-disabled", !isEditing);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PERMANENT_TASKS.map((task) => ({ ...task }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PERMANENT_TASKS.map((task) => ({ ...task }));

    const normalizedTasks = parsed
      .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        typeof item.done === "boolean",
      )
      .map((item) => ({
        id: item.id,
        text: item.text,
        done: item.done,
        permanent: true,
        currentStock: clampStock(item.currentStock),
        targetStock: clampStock(item.targetStock),
        detail: typeof item.detail === "string" ? item.detail : "",
        photos: normalizePhotos(item.photos ?? item.photo),
        color: isAllowedColor(item.color) ? item.color : "default",
        section: normalizeSection(item.section),
      }));

    for (const permanentTask of PERMANENT_TASKS) {
      if (!normalizedTasks.some((task) => task.id === permanentTask.id)) {
        normalizedTasks.unshift({ ...permanentTask });
      }
    }

    return normalizedTasks;
  } catch {
    return PERMANENT_TASKS.map((task) => ({ ...task }));
  }
}

function isAllowedColor(value) {
  return value === "default" || value === "red" || value === "yellow" || value === "blue" || value === "green";
}

function normalizeSection(value) {
  if (typeof value !== "string") return "General";
  const trimmed = value.trim();
  return trimmed || "General";
}

function clampStock(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(20, Math.max(0, Math.floor(value)));
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

function normalizePhotos(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

render();
