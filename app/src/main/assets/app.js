
    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

    const STORAGE_KEY = "little-ugly-data-v1";
    const PALETTE_KEY = "little-ugly-palette";

    let palette = [
        { name: "Calm", color: "#bba28d" },
        { name: "Happy", color: "#d5b5a6" },
        { name: "Tired", color: "#d7cda7" },
        { name: "Focused", color: "#aebca5" },
        { name: "Quiet", color: "#a9b8c6" }
    ];

    let widgets = [];
    let draggedId = null;
    let draggedWidgetType = null;
    let toastTimeout;
    let activePixelWidget = null;
    let activeDayKey = null;
    let pendingDayPhotos = [];
    let selectedDayColour = null;

    const definitions = [
        ["heading", "T", "Heading", "Add a section title"],
        ["text", "≡", "Body text", "Write a paragraph"],
        ["note", "▤", "Note", "A simple editable note"],
        ["checklist", "☑", "Checkboxes", "Track little tasks"],
        ["pixels", "▦", "Year in Pixels", "Colour your days"],
        ["photo", "▧", "Photo", "Attach a picture"],
        ["clock", "◷", "Clock", "Show the time"]
    ];

    function uid() {
        return globalThis.crypto?.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

    function notify(message) {
        const toast = $("#toast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove("show"), 1800);
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                widgets,
                title: $("h1")?.innerHTML ?? "",
                subtitle: $(".subtitle")?.innerHTML ?? ""
            }));
            localStorage.setItem(PALETTE_KEY, JSON.stringify(palette));
        } catch (error) {
            notify("Couldn't save. Storage may be full.");
        }
    }

    function loadPalette() {
        try {
            const savedPalette = JSON.parse(localStorage.getItem(PALETTE_KEY) || "null");
            if (Array.isArray(savedPalette)) {
                palette = savedPalette.filter(item =>
                    item &&
                    typeof item.name === "string" &&
                    typeof item.color === "string"
                );
            }
        } catch {
            // Keep the default palette if saved data is invalid.
        }
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
                widget.data.items = [{ text: "A thing to do", done: false }];
                break;
            case "pixels":
                widget.data.days = {};
                widget.data.year = new Date().getFullYear();
                break;
            case "photo":
                widget.data.src = "";
                break;
        }

        return widget;
    }

    function migrateWidget(widget) {
        if (!widget.data || typeof widget.data !== "object") widget.data = {};

        if (widget.type === "pixels") {
            // Older versions stored a flat array in data.cells.
            if (!widget.data.days || typeof widget.data.days !== "object") {
                widget.data.days = {};
            }

            if (!Number.isInteger(widget.data.year)) {
                widget.data.year = new Date().getFullYear();
            }

            // Convert old numeric cell colours to dated entries where possible.
            if (Array.isArray(widget.data.cells)) {
                const year = widget.data.year;
                let oldIndex = 0;
                for (let month = 0; month < 12; month++) {
                    const count = new Date(year, month + 1, 0).getDate();
                    for (let day = 1; day <= count && oldIndex < widget.data.cells.length; day++) {
                        const colourIndex = widget.data.cells[oldIndex++];
                        if (Number.isInteger(colourIndex) && colourIndex >= 0 && palette[colourIndex]) {
                            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            widget.data.days[key] ||= {};
                            widget.data.days[key].colour = palette[colourIndex].name;
                        }
                    }
                }
                delete widget.data.cells;
            }
        }

        if (widget.type === "checklist" && !Array.isArray(widget.data.items)) {
            widget.data.items = [];
        }
    }

    function load() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (saved && Array.isArray(saved.widgets)) {
                widgets = saved.widgets;
                widgets.forEach(migrateWidget);

                if (saved.title && $("h1")) $("h1").innerHTML = saved.title;
                if (saved.subtitle && $(".subtitle")) {
                    $(".subtitle").innerHTML = saved.subtitle;
                }
            }
        } catch (error) {
            widgets = [];
        }

        if (widgets.length) return;

        const pixels = createWidget("pixels");
        pixels.title = "year in pixels";

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
                return `<div class="heading-content" contenteditable="true" data-text>${escapeHTML(data.text)}</div>`;

            case "text":
                return `<div class="text-content" contenteditable="true" data-text>${escapeHTML(data.text)}</div>`;

            case "note":
                return `<textarea class="note-content" data-note placeholder="start typing...">${escapeHTML(data.text)}</textarea>`;

            case "checklist":
                return `
                    <div>
                        ${(data.items || []).map((item, index) => `
                            <label class="check-row">
                                <input type="checkbox" data-check="${index}" ${item.done ? "checked" : ""}>
                                <span contenteditable="true" data-item="${index}" class="${item.done ? "completed" : ""}">${escapeHTML(item.text)}</span>
                                <button type="button" data-remove-item="${index}" style="border:0;background:transparent">×</button>
                            </label>
                        `).join("")}
                        <button type="button" data-action="add-item" style="border:0;background:transparent;color:var(--muted)">＋ add item</button>
                    </div>`;

            case "pixels": {
                data.days ||= {};
                const year = Number.isInteger(data.year) ? data.year : new Date().getFullYear();
                const months = Array.from({ length: 12 }, (_, month) =>
                    new Date(year, month, 1).toLocaleDateString(undefined, { month: "short" })
                );

                let cells = "";
                for (let day = 1; day <= 31; day++) {
                    for (let month = 0; month < 12; month++) {
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const valid = day <= daysInMonth;
                        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const entry = data.days[key] || {};
                        const selected = palette.find(item => item.name === entry.colour);
                        const background = selected ? selected.color : "#e3d9ce";
                        const title = valid
                            ? `${new Date(year, month, day).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}${entry.colour ? ` · ${entry.colour}` : ""}`
                            : "";

                        cells += `
                            <button type="button" class="calendar-day"
                                data-date="${key}" ${valid ? "" : "disabled"}
                                title="${escapeHTML(title)}"
                                aria-label="${escapeHTML(title)}"
                                style="background:${background}"></button>`;
                    }
                    cells += `<span class="calendar-day-number">${day}</span>`;
                }

                return `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                        <span style="font-size:12px;color:var(--muted)">${year}</span>
                        <div>
                            <button type="button" data-action="previous-year" title="Previous year">←</button>
                            <button type="button" data-action="next-year" title="Next year">→</button>
                        </div>
                    </div>
                    <div class="pixel-calendar-wrap">
                        <div class="pixel-calendar">
                            ${months.map(month => `<span class="calendar-month">${month}</span>`).join("")}
                            <span class="calendar-month">Day</span>
                            ${cells}
                        </div>
                    </div>
                    <p style="font-size:10px;color:var(--muted);margin-bottom:0">
                        Click a square to choose a colour, add a note, or attach photos.
                    </p>`;
            }

            case "photo":
                return `
                    <label class="photo-upload">
                        ${data.src
                            ? `<img src="${data.src}" alt="Your photo">`
                            : "<span>＋</span><span>choose a photo</span>"}
                        <input type="file" accept="image/*" data-photo>
                    </label>`;

            case "clock":
                return `
                    <div data-clock style="font-size:27px;font-weight:650"></div>
                    <p>${new Date().toLocaleDateString()}</p>`;

            default:
                return "";
        }
    }

    function render() {
        const container = $("#widgets");
        if (!container) return;

        container.innerHTML = "";
        widgets.forEach(widget => {
            migrateWidget(widget);
            const element = document.createElement("article");
            element.className = "widget" + (widget.wide ? " wide" : "");
            element.dataset.id = widget.id;
            element.draggable = true;

            const definition = definitions.find(item => item[0] === widget.type);
            element.innerHTML = `
                <div class="widget-header">
                    <span class="widget-icon">${definition?.[1] || "·"}</span>
                    <span class="widget-title" contenteditable="true" data-title>${escapeHTML(widget.title)}</span>
                    <div class="widget-actions">
                        <button type="button" data-action="width" title="Toggle width">↔</button>
                        <button type="button" data-action="up" title="Move up">↑</button>
                        <button type="button" data-action="delete" title="Delete">×</button>
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
        if (!definitions.some(item => item[0] === type)) return;
        const widget = createWidget(type);
        widgets.splice(Math.max(0, Math.min(index, widgets.length)), 0, widget);
        $("#sidebar")?.classList.remove("open");
        const contextMenu = $("#context-menu");
        if (contextMenu) contextMenu.style.display = "none";
        render();
        notify(`${widget.title} added`);
    }

    function openSidebar() {
        $("#sidebar")?.classList.add("open");
        const contextMenu = $("#context-menu");
        if (contextMenu) contextMenu.style.display = "none";
    }

    function closeSidebar() {
        $("#sidebar")?.classList.remove("open");
    }

    function buildMenu() {
        const menu = $("#widget-menu");
        if (!menu) return;
        menu.innerHTML = definitions.map(item => `
            <button type="button" class="widget-option"
                draggable="true" data-widget-type="${item[0]}">
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
            element.textContent = new Date().toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit"
            });
        });
    }

    function renderDayColours(selectedName) {
        const container = $("#day-colours");
        if (!container) return;
        container.innerHTML = palette.map((item, index) => `
            <button type="button" class="day-colour ${item.name === selectedName ? "selected" : ""}"
                data-colour-index="${index}">
                <span class="day-colour-swatch" style="background:${item.color}"></span>
                ${escapeHTML(item.name)}
            </button>
        `).join("") + `
            <button type="button" class="day-colour ${selectedName == null ? "selected" : ""}" data-no-colour>
                No colour
            </button>`;
    }

    function renderDayPhotos() {
        const gallery = $("#day-photo-gallery");
        if (!gallery) return;
        gallery.innerHTML = pendingDayPhotos.map((src, index) => `
            <div style="position:relative">
                <img src="${src}" alt="Memory ${index + 1}">
                <button type="button" data-remove-photo="${index}"
                    aria-label="Remove photo" style="position:absolute;top:4px;right:4px;padding:3px 7px">×</button>
            </div>
        `).join("");
    }

    function openDayEditor(widget, dateKey) {
        if (!widget.data) widget.data = {};
        if (!widget.data.days || typeof widget.data.days !== "object") {
            widget.data.days = {};
        }

        activePixelWidget = widget;
        activeDayKey = dateKey;

        const entry = widget.data.days[dateKey] || {
            colour: null,
            note: "",
            photos: []
        };

        selectedDayColour = entry.colour ?? null;
        $("#day-date").textContent = dateKey;
        $("#day-heading").textContent = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
        $("#day-note").value = entry.note || "";
        pendingDayPhotos = [...(entry.photos || [])];
        renderDayColours(selectedDayColour);
        renderDayPhotos();
        $("#day-editor").classList.add("open");
    }

    function closeDayEditor() {
        $("#day-editor")?.classList.remove("open");
        activePixelWidget = null;
        activeDayKey = null;
        pendingDayPhotos = [];
        selectedDayColour = null;
    }

    // Date heading
    if ($("#today")) {
        $("#today").textContent = new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        }).toUpperCase();
    }

    // Main buttons and sidebar
    $("#add-widget")?.addEventListener("click", openSidebar);
    $("#add-bottom")?.addEventListener("click", openSidebar);
    $("#close-sidebar")?.addEventListener("click", closeSidebar);
    $("#sidebar")?.addEventListener("click", event => {
        if (event.target === $("#sidebar")) closeSidebar();
    });
    $("#browse-widgets")?.addEventListener("click", openSidebar);

    buildMenu();

    $("#widget-menu")?.addEventListener("click", event => {
        const button = event.target.closest("[data-widget-type]");
        if (button) addWidget(button.dataset.widgetType);
    });

    // Drag a widget from the library onto the dashboard.
    $("#widget-menu")?.addEventListener("dragstart", event => {
        const button = event.target.closest("[data-widget-type]");
        if (!button) return;
        draggedWidgetType = button.dataset.widgetType;
        draggedId = null;
        event.dataTransfer?.setData("text/plain", `new:${draggedWidgetType}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    });

    // Right-click context menu
    $("#canvas")?.addEventListener("contextmenu", event => {
        event.preventDefault();
        const menu = $("#context-menu");
        if (!menu) return;
        const width = 210;
        const height = 320;
        menu.style.left = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)) + "px";
        menu.style.top = Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)) + "px";
        menu.style.display = "block";
    });

    $("#context-menu")?.addEventListener("click", event => {
        const button = event.target.closest("[data-add]");
        if (button) addWidget(button.dataset.add);
    });

    document.addEventListener("click", event => {
        if (!event.target.closest("#context-menu")) {
            const menu = $("#context-menu");
            if (menu) menu.style.display = "none";
        }
    });

    // Keep text edits saved.
    $("#canvas")?.addEventListener("input", event => {
        if (event.target.matches("h1, .subtitle")) {
            save();
            return;
        }

        const element = event.target.closest(".widget");
        if (!element) return;
        const widget = widgets.find(item => item.id === element.dataset.id);
        if (!widget) return;

        if (event.target.hasAttribute("data-title")) {
            widget.title = event.target.textContent;
        } else if (event.target.hasAttribute("data-text")) {
            widget.data.text = event.target.innerText;
        } else if (event.target.hasAttribute("data-note")) {
            widget.data.text = event.target.value;
        } else if (event.target.hasAttribute("data-item")) {
            const itemIndex = Number(event.target.dataset.item);
            if (widget.data.items?.[itemIndex]) {
                widget.data.items[itemIndex].text = event.target.innerText;
            }
        }
        save();
    });

    // Widget buttons, checklists, pixel dates and year navigation.
    $("#widgets")?.addEventListener("click", event => {
        const element = event.target.closest(".widget");
        if (!element) return;

        const index = widgets.findIndex(item => item.id === element.dataset.id);
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

        if (action === "previous-year" || action === "next-year") {
            widget.data.year = (widget.data.year || new Date().getFullYear()) +
                (action === "next-year" ? 1 : -1);
            render();
            return;
        }

        if (action === "add-item") {
            widget.data.items ||= [];
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
            widget.data.items[Number(checkbox.dataset.check)].done = checkbox.checked;
            checkbox.nextElementSibling?.classList.toggle("completed", checkbox.checked);
            save();
            return;
        }

        const dateButton = event.target.closest("[data-date]");
        if (dateButton && widget.type === "pixels") {
            openDayEditor(widget, dateButton.dataset.date);
        }
    });

    // Photos on the regular photo widget.
    $("#widgets")?.addEventListener("change", event => {
        if (!event.target.matches("[data-photo]")) return;
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 1_000_000) {
            notify("Choose a photo under 1 MB");
            event.target.value = "";
            return;
        }

        const element = event.target.closest(".widget");
        const widget = widgets.find(item => item.id === element?.dataset.id);
        if (!widget) return;

        const reader = new FileReader();
        reader.onload = () => {
            widget.data.src = reader.result;
            render();
        };
        reader.readAsDataURL(file);
    });

    // Reorder existing widgets by dragging.
    $("#widgets")?.addEventListener("dragstart", event => {
        const element = event.target.closest(".widget");
        if (!element) return;
        draggedId = element.dataset.id;
        draggedWidgetType = null;
        element.classList.add("dragging");
        event.dataTransfer?.setData("text/plain", draggedId);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });

    $("#widgets")?.addEventListener("dragover", event => {
        if (!draggedId && !draggedWidgetType) return;
        event.preventDefault();
        $$(".widget.drag-over").forEach(element => element.classList.remove("drag-over"));
        const target = event.target.closest(".widget");
        if (target && target.dataset.id !== draggedId) target.classList.add("drag-over");
    });

    $("#widgets")?.addEventListener("drop", event => {
        if (draggedWidgetType) {
            event.preventDefault();
            const target = event.target.closest(".widget");
            const index = target
                ? widgets.findIndex(item => item.id === target.dataset.id)
                : widgets.length;
            addWidget(draggedWidgetType, index < 0 ? widgets.length : index);
            draggedWidgetType = null;
            draggedId = null;
            return;
        }

        if (!draggedId) return;
        event.preventDefault();
        const target = event.target.closest(".widget");
        const from = widgets.findIndex(item => item.id === draggedId);
        const to = target ? widgets.findIndex(item => item.id === target.dataset.id) : widgets.length - 1;
        if (from >= 0 && to >= 0) moveWidget(from, to);
        draggedId = null;
    });

    $("#widgets")?.addEventListener("dragend", () => {
        draggedId = null;
        draggedWidgetType = null;
        $$(".widget").forEach(element => element.classList.remove("dragging", "drag-over"));
    });

    // Page title and subtitle
    $("h1")?.addEventListener("input", save);
    $(".subtitle")?.addEventListener("input", save);

    // Daily journal editor: colour palette
    $("#day-colours")?.addEventListener("click", event => {
        const button = event.target.closest("[data-colour-index]");
        if (button) {
            const colour = palette[Number(button.dataset.colourIndex)];
            if (!colour || !activePixelWidget || !activeDayKey) return;
            selectedDayColour = colour.name;
            activePixelWidget.data.days[activeDayKey] ||= {};
            activePixelWidget.data.days[activeDayKey].colour = colour.name;
            renderDayColours(selectedDayColour);
            return;
        }

        if (event.target.closest("[data-no-colour]")) {
            selectedDayColour = null;
            if (activePixelWidget && activeDayKey) {
                activePixelWidget.data.days[activeDayKey] ||= {};
                activePixelWidget.data.days[activeDayKey].colour = null;
            }
            renderDayColours(null);
        }
    });

    // Add custom palette colours.
    $("#add-colour")?.addEventListener("click", () => {
        const name = $("#new-colour-name")?.value.trim();
        const color = $("#new-colour-value")?.value;
        if (!name) {
            notify("Give your colour a name first");
            return;
        }
        if (palette.some(item => item.name.toLowerCase() === name.toLowerCase())) {
            notify("That colour name already exists");
            return;
        }

        palette.push({ name, color: color || "#bba28d" });
        try {
            localStorage.setItem(PALETTE_KEY, JSON.stringify(palette));
        } catch {}
        $("#new-colour-name").value = "";
        if (activePixelWidget && activeDayKey) {
            renderDayColours(selectedDayColour);
        }
        save();
        notify("Colour added");
    });

    // Attach multiple photos to a date.
    $("#day-photos")?.addEventListener("change", async event => {
        const files = [...(event.target.files || [])];
        for (const file of files) {
            if (!file.type.startsWith("image/")) continue;
            if (file.size > 1_000_000) {
                notify("Choose photos under 1 MB each");
                continue;
            }

            const src = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);
            });
            if (src) pendingDayPhotos.push(src);
        }
        renderDayPhotos();
        event.target.value = "";
    });

    $("#day-photo-gallery")?.addEventListener("click", event => {
        const button = event.target.closest("[data-remove-photo]");
        if (!button) return;
        pendingDayPhotos.splice(Number(button.dataset.removePhoto), 1);
        renderDayPhotos();
    });

    $("#save-day")?.addEventListener("click", () => {
        if (!activePixelWidget || !activeDayKey) return;
        const previous = activePixelWidget.data.days[activeDayKey] || {};
        activePixelWidget.data.days[activeDayKey] = {
            ...previous,
            colour: selectedDayColour,
            note: $("#day-note")?.value || "",
            photos: [...pendingDayPhotos]
        };
        save();
        render();
        closeDayEditor();
        notify("Day saved");
    });

    $("#close-day")?.addEventListener("click", closeDayEditor);
    $("#day-editor")?.addEventListener("click", event => {
        if (event.target === $("#day-editor")) closeDayEditor();
    });

    // Start the app only after saved colours and widgets have been loaded.
    loadPalette();
    load();
    buildMenu();
    render();
    setInterval(updateClocks, 30000);
