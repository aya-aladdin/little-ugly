
const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

const STORAGE_KEY = "little-ugly-data-v1";

const palette = [
    "#bba28d",
    "#d5b5a6",
    "#d7cda7",
    "#aebca5",
    "#a9b8c6"
];

const definitions = [
    ["heading", "T", "Heading", "Add a section title"],
    ["text", "≡", "Body text", "Write a paragraph"],
    ["note", "▤", "Note", "A simple editable note"],
    ["checklist", "☑", "Checkboxes", "Track little tasks"],
    ["pixels", "▦", "Year in Pixels", "Colour your days"],
    ["photo", "▧", "Photo", "Attach a picture"],
    ["clock", "◷", "Clock", "Show the time"]
];

let widgets = [];
let draggedId = null;
let toastTimeout;

$("#today").textContent = new Date().toLocaleDateString(
    undefined,
    {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }
).toUpperCase();

function uid() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function createWidget(type) {
    const definition = definitions.find(item => item[0] === type);

    const widget = {
        id: uid(),
        type,
        title: definition ? definition[2] : "Widget",
        wide: ["heading", "text", "pixels", "photo"].includes(type),
        data: {}
    };

    switch (type) {
        case "heading":
            widget.data.text = "Your new heading";
            break;

        case "text":
            widget.data.text = "Click here to write something...";
            break;

        case "note":
            widget.data.text = "";
            break;

        case "checklist":
            widget.data.items = [
                { text: "A thing to do", done: false }
            ];
            break;

        case "pixels":
            widget.data.cells = Array(365).fill(-1);
            break;

        case "photo":
            widget.data.src = "";
            break;
    }

    return widget;
}

function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 1800);
}

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            widgets,
            title: $("h1").innerHTML,
            subtitle: $(".subtitle").innerHTML
        }));
    } catch (error) {
        notify("Couldn't save. Storage may be full.");
    }
}

function load() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || "null"
        );

        if (saved && Array.isArray(saved.widgets)) {
            widgets = saved.widgets;

            if (saved.title) $("h1").innerHTML = saved.title;
            if (saved.subtitle) {
                $(".subtitle").innerHTML = saved.subtitle;
            }
        }
    } catch (error) {
        widgets = [];
    }

    if (widgets.length) return;

    const pixels = createWidget("pixels");
    pixels.title = "year in pixels";
    pixels.data.cells.forEach((_, index) => {
        if (index % 13 === 3) {
            pixels.data.cells[index] = index % palette.length;
        }
    });

    const note = createWidget("note");
    note.title = "today's thoughts";
    note.data.text = "a small thought, a tiny plan, a reminder...";

    const checklist = createWidget("checklist");
    checklist.title = "little things";
    checklist.data.items = [
        { text: "drink some water", done: false },
        { text: "make something", done: true },
        { text: "take a little break", done: false }
    ];

    const photo = createWidget("photo");
    photo.title = "a memory";

    widgets = [pixels, note, checklist, photo];
}

function widgetBody(widget) {
    const data = widget.data || {};

    switch (widget.type) {
        case "heading":
            return `
                <div class="heading-content"
                     contenteditable="true"
                     data-text>${escapeHTML(data.text)}</div>
            `;

        case "text":
            return `
                <div class="text-content"
                     contenteditable="true"
                     data-text>${escapeHTML(data.text)}</div>
            `;

        case "note":
            return `
                <textarea class="note-content"
                    data-note
                    placeholder="start typing...">${escapeHTML(data.text)}</textarea>
            `;

        case "checklist":
            return `
                <div>
                    ${(data.items || []).map((item, index) => `
                        <label class="check-row">
                            <input type="checkbox"
                                data-check="${index}"
                                ${item.done ? "checked" : ""}>
                            <span contenteditable="true"
                                data-item="${index}"
                                class="${item.done ? "completed" : ""}">${escapeHTML(item.text)}</span>
                            <button data-remove-item="${index}"
                                style="border:0;background:transparent">×</button>
                        </label>
                    `).join("")}
                    <button data-action="add-item"
                        style="border:0;background:transparent;color:var(--muted)">
                        ＋ add item
                    </button>
                </div>
            `;

        case "pixels":
            return `
                <p style="font-size:11px;color:var(--muted)">
                    Click a square to cycle its colour.
                </p>
                <div class="pixels">
                    ${(data.cells || Array(365).fill(-1)).map((colour, index) => `
                        <button class="pixel"
                            data-pixel="${index}"
                            aria-label="Day ${index + 1}"
                            style="background:${
                                colour < 0 ? "#e3d9ce" : palette[colour % palette.length]
                            }"></button>
                    `).join("")}
                </div>
                <div class="legend">
                    ${palette.map((colour, index) => `
                        <span>
                            <i class="dot" style="background:${colour}"></i>
                            ${["okay", "happy", "tired", "focused", "quiet"][index]}
                        </span>
                    `).join("")}
                </div>
            `;

        case "photo":
            return `
                <label class="photo-upload">
                    ${data.src
                        ? `<img src="${data.src}" alt="Your photo">`
                        : "<span>＋</span><span>choose a photo</span>"
                    }
                    <input type="file" accept="image/*" data-photo>
                </label>
            `;

        case "clock":
            return `
                <div data-clock style="font-size:27px;font-weight:650"></div>
                <p>${new Date().toLocaleDateString()}</p>
            `;

        default:
            return "";
    }
}

function render() {
    const container = $("#widgets");
    container.innerHTML = "";

    widgets.forEach(widget => {
        const element = document.createElement("article");

        element.className = "widget" + (
            widget.wide ? " wide" : ""
        );

        element.dataset.id = widget.id;
        element.draggable = true;

        const definition = definitions.find(
            item => item[0] === widget.type
        );

        element.innerHTML = `
            <div class="widget-header">
                <span class="widget-icon">${definition?.[1] || "·"}</span>

                <span class="widget-title"
                    contenteditable="true"
                    data-title>${escapeHTML(widget.title)}</span>

                <div class="widget-actions">
                    <button data-action="width" title="Toggle width">↔</button>
                    <button data-action="up" title="Move up">↑</button>
                    <button data-action="delete" title="Delete">×</button>
                </div>
            </div>

            ${widgetBody(widget)}
        `;

        container.appendChild(element);
    });

    save();
    updateClocks();
}

function addWidget(type, index = widgets.length) {
    const widget = createWidget(type);

    widgets.splice(index, 0, widget);

    $("#sidebar").classList.remove("open");
    $("#context-menu").style.display = "none";

    render();
    notify(`${widget.title} added`);
}

function openSidebar() {
    $("#sidebar").classList.add("open");
    $("#context-menu").style.display = "none";
}

function closeSidebar() {
    $("#sidebar").classList.remove("open");
}

function buildMenu() {
    $("#widget-menu").innerHTML = definitions.map(item => `
        <button class="widget-option"
            draggable="true"
            data-widget-type="${item[0]}">
            <span class="option-icon">${item[1]}</span>
            <strong>${item[2]}</strong>
            <small>${item[3]}</small>
        </button>
    `).join("");
}

function moveWidget(from, to) {
    if (from < 0 || to < 0 || from === to) return;

    const [widget] = widgets.splice(from, 1);

    if (to > from) to--;

    widgets.splice(Math.max(0, Math.min(to, widgets.length)), 0, widget);

    render();
}

function updateClocks() {
    $$("[data-clock]").forEach(element => {
        element.textContent = new Date().toLocaleTimeString(
            undefined,
            { hour: "2-digit", minute: "2-digit" }
        );
    });
}

// Main buttons
$("#add-widget").addEventListener("click", openSidebar);
$("#add-bottom").addEventListener("click", openSidebar);
$("#close-sidebar").addEventListener("click", closeSidebar);

$("#sidebar").addEventListener("click", event => {
    if (event.target === $("#sidebar")) closeSidebar();
});

$("#browse-widgets").addEventListener("click", openSidebar);

// Widget menu
buildMenu();

$("#widget-menu").addEventListener("click", event => {
    const button = event.target.closest("[data-widget-type]");
    if (button) addWidget(button.dataset.widgetType);
});

// Right-click menu
$("#canvas").addEventListener("contextmenu", event => {
    event.preventDefault();

    const menu = $("#context-menu");
    const width = 200;
    const height = 300;

    menu.style.left = Math.min(
        event.clientX,
        window.innerWidth - width - 10
    ) + "px";

    menu.style.top = Math.min(
        event.clientY,
        window.innerHeight - height - 10
    ) + "px";

    menu.style.display = "block";
});

// Context menu widget creation
$("#context-menu").addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (button) addWidget(button.dataset.add);
});

document.addEventListener("click", event => {
    if (!event.target.closest("#context-menu")) {
        $("#context-menu").style.display = "none";
    }
});

// Edit content and persist changes
$("#canvas").addEventListener("input", event => {
    if (event.target.matches("h1, .subtitle")) {
        save();
        return;
    }

    const element = event.target.closest(".widget");
    if (!element) return;

    const widget = widgets.find(
        item => item.id === element.dataset.id
    );

    if (!widget) return;

    if (event.target.hasAttribute("data-title")) {
        widget.title = event.target.textContent;
    } else if (event.target.hasAttribute("data-text")) {
        widget.data.text = event.target.innerText;
    } else if (event.target.hasAttribute("data-note")) {
        widget.data.text = event.target.value;
    } else if (event.target.hasAttribute("data-item")) {
        widget.data.items[Number(event.target.dataset.item)].text =
            event.target.innerText;
    }

    save();
});

// Widget controls
$("#widgets").addEventListener("click", event => {
    const element = event.target.closest(".widget");
    if (!element) return;

    const index = widgets.findIndex(
        item => item.id === element.dataset.id
    );

    if (index < 0) return;

    const widget = widgets[index];
    const action = event.target.closest("[data-action]")?.dataset.action;

    if (action === "delete") {
        widgets.splice(index, 1);
        render();
        notify("Widget removed");
        return;
    }

    if (action === "width") {
        widget.wide = !widget.wide;
        render();
        return;
    }

    if (action === "up") {
        if (index > 0) moveWidget(index, index - 1);
        return;
    }

    if (action === "add-item") {
        widget.data.items.push({ text: "New item", done: false });
        render();
        return;
    }

    const remove = event.target.closest("[data-remove-item]");

    if (remove) {
        widget.data.items.splice(Number(remove.dataset.removeItem), 1);
        render();
        return;
    }

    const checkbox = event.target.closest("[data-check]");

    if (checkbox) {
        widget.data.items[Number(checkbox.dataset.check)].done =
            checkbox.checked;

        checkbox.nextElementSibling.classList.toggle(
            "completed",
            checkbox.checked
        );

        save();
        return;
    }

    const pixel = event.target.closest("[data-pixel]");

    if (pixel) {
        const i = Number(pixel.dataset.pixel);

        widget.data.cells[i] =
            widget.data.cells[i] >= palette.length - 1
                ? -1
                : widget.data.cells[i] + 1;

        pixel.style.background = widget.data.cells[i] < 0
            ? "#e3d9ce"
            : palette[widget.data.cells[i]];

        save();
    }
});

// Photo attachments
$("#widgets").addEventListener("change", event => {
    if (!event.target.matches("[data-photo]")) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1_000_000) {
        notify("For this prototype, choose a photo under 1 MB");
        return;
    }

    const element = event.target.closest(".widget");
    const widget = widgets.find(
        item => item.id === element.dataset.id
    );

    const reader = new FileReader();

    reader.onload = () => {
        widget.data.src = reader.result;
        render();
    };

    reader.readAsDataURL(file);
});

// Drag and drop
$("#widgets").addEventListener("dragstart", event => {
    const element = event.target.closest(".widget");
    if (!element) return;

    draggedId = element.dataset.id;
    element.classList.add("dragging");

    event.dataTransfer.setData("text/plain", draggedId);
    event.dataTransfer.effectAllowed = "move";
});

$("#widgets").addEventListener("dragover", event => {
    if (!draggedId) return;

    event.preventDefault();

    $$(".widget.drag-over").forEach(element =>
        element.classList.remove("drag-over")
    );

    const target = event.target.closest(".widget");

    if (target && target.dataset.id !== draggedId) {
        target.classList.add("drag-over");
    }
});

$("#widgets").addEventListener("drop", event => {
    if (!draggedId) return;

    event.preventDefault();

    const target = event.target.closest(".widget");
    const from = widgets.findIndex(
        item => item.id === draggedId
    );

    const to = target
        ? widgets.findIndex(item => item.id === target.dataset.id)
        : widgets.length - 1;

    if (from >= 0 && to >= 0) moveWidget(from, to);

    draggedId = null;
});

$("#widgets").addEventListener("dragend", () => {
    draggedId = null;

    $$(".widget").forEach(element => {
        element.classList.remove("dragging", "drag-over");
    });
});

// Page title and subtitle
$("h1").addEventListener("input", save);
$(".subtitle").addEventListener("input", save);

// Start
load();
buildMenu();
render();
setInterval(updateClocks, 30000);
