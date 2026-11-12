document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);

    // Support hiding native cursor for Framer custom cursors (?cursor=none or ?custom_cursor=1)
    const cursorParam = urlParams.get('cursor');
    if (cursorParam === 'none' || cursorParam === 'custom' || urlParams.get('custom_cursor') === '1') {
        document.documentElement.classList.add('hide-cursor');
        document.body.classList.add('hide-cursor');
    }

    // Bridge iframe mouse/pointer events to parent window so Framer custom cursors track smoothly
    if (window.parent && window.parent !== window) {
        const forwardMouseEvent = (type, e) => {
            try {
                window.parent.postMessage({
                    type: type,
                    source: 'workspace-activity-heatmap',
                    x: e.clientX,
                    y: e.clientY,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    pageX: e.pageX,
                    pageY: e.pageY,
                    screenX: e.screenX,
                    screenY: e.screenY,
                    movementX: e.movementX || 0,
                    movementY: e.movementY || 0,
                    buttons: e.buttons || 0,
                }, '*');
            } catch (_) {}
        };

        window.addEventListener('mousemove', (e) => forwardMouseEvent('mousemove', e), { passive: true });
        window.addEventListener('pointermove', (e) => forwardMouseEvent('pointermove', e), { passive: true });
        window.addEventListener('mouseenter', (e) => forwardMouseEvent('mouseenter', e), { passive: true });
        window.addEventListener('mouseleave', (e) => forwardMouseEvent('mouseleave', e), { passive: true });
        window.addEventListener('mousedown', (e) => forwardMouseEvent('mousedown', e), { passive: true });
        window.addEventListener('mouseup', (e) => forwardMouseEvent('mouseup', e), { passive: true });
    }

    // Apply local mode immediately so layout measurements reflect the final container width
    const isEmbedPreview = urlParams.get('embed') === '1';
    const isLocalhost = !isEmbedPreview && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');
    if (!isLocalhost) {
        const controls = document.getElementById("ui-controls");
        if (controls) controls.style.display = "none";

        const saveStatus = document.getElementById("save-status");
        if (saveStatus) saveStatus.style.display = "none";
    } else {
        document.body.classList.add("local-mode");
    }

    const grid = document.getElementById("heatmap-grid");
    const gridScroll = document.getElementById("grid-scroll");
    const scrollIndicator = document.getElementById("scroll-indicator");
    const scrollThumb = document.getElementById("scroll-indicator-thumb");
    const monthsContainer = document.getElementById("months-container");
    const contributionCount = document.getElementById("contribution-count");
    const productionRate = document.getElementById("production-rate");
    const tooltip = document.getElementById("tooltip");
    // Read configuration from python scanner output, or fallback to URL parameters
    const serverConfig = typeof heatmapConfig !== 'undefined' ? heatmapConfig : {};
    const themeParam = urlParams.get('theme') || serverConfig.theme || 'light';
    const levelsParam = urlParams.get('levels') || serverConfig.levels || 'hidden';
    const tooltipParam = urlParams.get('tooltip') || serverConfig.tooltip || 'tools';
    
    let currentTooltipFormat = tooltipParam;

    
    // Theme toggle
    const toggleThemeBtn = document.getElementById("toggle-theme");
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener("click", () => {
            document.body.classList.toggle("dark");
        });
    }
    
    // Toggle functionality
    const toggleBtn = document.getElementById("toggle-heatmap");
    const heatmapWrapper = document.getElementById("heatmap-wrapper");
    if (toggleBtn && heatmapWrapper) {
        if (levelsParam === "hidden") {
            toggleBtn.textContent = "Show Levels";
        } else {
            toggleBtn.textContent = "Hide Levels";
        }
        toggleBtn.addEventListener("click", () => {
            if (heatmapWrapper.classList.contains("heatmap-hidden")) {
                heatmapWrapper.classList.remove("heatmap-hidden");
                toggleBtn.textContent = "Hide Levels";
            } else {
                heatmapWrapper.classList.add("heatmap-hidden");
                toggleBtn.textContent = "Show Levels";
            }
        });
    }

    // Custom Select Dropdown logic
    const customSelect = document.getElementById("tooltip-format-select");
    if (customSelect) {
        const selectTrigger = customSelect.querySelector(".custom-select-trigger");
        const selectValue = customSelect.querySelector(".custom-select-value");
        const selectContent = customSelect.querySelector(".custom-select-content");
        const selectItems = customSelect.querySelectorAll(".custom-select-item");

        // Initialize dropdown state
        selectItems.forEach(item => {
            if (item.getAttribute("data-value") === tooltipParam) {
                selectItems.forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                selectValue.textContent = item.querySelector(".custom-select-item-text").textContent;
            }
        });

        // Toggle dropdown open/close
        selectTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            selectContent.classList.toggle("hidden");
            const isExpanded = !selectContent.classList.contains("hidden");
            selectTrigger.setAttribute("aria-expanded", isExpanded);
        });

        // Handle item selection
        selectItems.forEach(item => {
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                // Update active state for styling (checkmark)
                selectItems.forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                
                // Update trigger text
                const itemText = item.querySelector(".custom-select-item-text").textContent;
                selectValue.textContent = itemText;
                
                // Update global format
                currentTooltipFormat = item.getAttribute("data-value");
                
                // Close dropdown
                selectContent.classList.add("hidden");
                selectTrigger.setAttribute("aria-expanded", "false");
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (!customSelect.contains(e.target)) {
                selectContent.classList.add("hidden");
                selectTrigger.setAttribute("aria-expanded", "false");
            }
        });
    }


    
    // Apply Theme
    if (themeParam === "dark") {
        document.body.classList.add("dark");
    } else {
        document.body.classList.remove("dark");
    }

    // Apply Levels Mode
    if (heatmapWrapper) {
        if (levelsParam === "hidden") {
            heatmapWrapper.classList.add("heatmap-hidden");
        } else {
            heatmapWrapper.classList.remove("heatmap-hidden");
        }
    }

    // 'const' in global scope does not attach to 'window', so we reference it directly
    let activeData = typeof heatmapData !== 'undefined' ? heatmapData : { contributions: {}, totalLastYear: 0, totalTools: 0, productionRate: 0, lastUpdated: null };
    const CELL_SIZE = 11;
    const CELL_GAP = 3;
    const COL_WIDTH = CELL_SIZE + CELL_GAP;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let totalWeeks = 0;
    let monthLabels = [];
    let hasAutoScrolled = false;
    let lastAvailableWidth = -1;
    let resizeRafId = null;

    function renderHeatmap(data) {
        activeData = data || { contributions: {}, totalLastYear: 0, totalTools: 0, productionRate: 0, lastUpdated: null };
        const currentYearForHeader = new Date().getFullYear();
        contributionCount.textContent = `${(activeData.totalTools || 0).toLocaleString()} Tools Built in ${currentYearForHeader}`;
        if (productionRate) {
            productionRate.textContent = `~${activeData.productionRate || 0} / month`;
        }

        // Relative Time Logic for "Last Updated"
        const lastUpdatedEl = document.getElementById("last-updated");
        if (lastUpdatedEl && activeData.lastUpdated) {
            const updatedTime = new Date(activeData.lastUpdated);
            const now = new Date();
            const diffMs = now - updatedTime;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            let timeStr = "just now";
            if (diffDays > 0) {
                timeStr = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
                timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else if (diffMins > 0) {
                timeStr = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            }
            lastUpdatedEl.textContent = `Updated ${timeStr}`;
        }

        grid.innerHTML = "";
        monthsContainer.innerHTML = "";
        monthLabels = [];
        hasAutoScrolled = false;

        // Calculate dates for current year up to today (no future blank cells)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthIdx = now.getMonth();
        const todayDateNum = now.getDate();
        const startDate = new Date(currentYear, 0, 1); // Jan 1st
        const endDate = new Date(currentYear, currentMonthIdx, todayDateNum); // Today

        // Find the Sunday before or on Jan 1st
        const startDayOfWeek = startDate.getDay();
        const calendarStart = new Date(startDate);
        calendarStart.setDate(startDate.getDate() - startDayOfWeek);

        let currentDate = new Date(calendarStart);
        let currentWeek = 0;

        while (currentDate <= endDate) {
            const cell = document.createElement("div");
            cell.className = "cell";

            const dateStr = [
                currentDate.getFullYear(),
                String(currentDate.getMonth() + 1).padStart(2, '0'),
                String(currentDate.getDate()).padStart(2, '0')
            ].join('-');

            const dailyData = activeData.contributions[dateStr];
            const count = dailyData ? dailyData.count : 0;

            let level = 0;
            if (count >= 1 && count <= 2) level = 1;
            else if (count >= 3 && count <= 10) level = 2;
            else if (count >= 11 && count <= 25) level = 3;
            else if (count >= 26) level = 4;

            cell.classList.add(`level-${level}`);

            const displayDate = `${months[currentDate.getMonth()]} ${currentDate.getDate()}`;

            cell.addEventListener("mouseenter", () => {
                const rect = cell.getBoundingClientRect();
                const format = currentTooltipFormat;
                let tooltipText = `${displayDate}`;

                if (count > 0) {
                    if (format === "detailed") {
                        const isLevelHidden = heatmapWrapper && heatmapWrapper.classList.contains("heatmap-hidden");
                        if (isLevelHidden) {
                            tooltipText += `, ${count} file changes`;
                        } else {
                            tooltipText += `, ${count} file changes, Level ${level}`;
                        }
                    } else if (format === "tools") {
                        const tools = (activeData.contributions[dateStr] && activeData.contributions[dateStr].tools) || [];
                        if (tools.length > 0) {
                            tooltipText += `, Worked on: ${tools.join(", ")}`;
                        } else {
                            tooltipText += `, Active Day`;
                        }
                    } else if (format === "simple") {
                        tooltipText += `, Active Day`;
                    }
                } else {
                    if (format === "detailed") {
                        const isLevelHidden = heatmapWrapper && heatmapWrapper.classList.contains("heatmap-hidden");
                        if (isLevelHidden) {
                            tooltipText += `, 0 file changes`;
                        } else {
                            tooltipText += `, 0 file changes, Level 0`;
                        }
                    } else {
                        tooltipText += `, No activity`;
                    }
                }

                tooltip.textContent = tooltipText;

                const centerX = rect.left + rect.width / 2;
                tooltip.style.setProperty('--arrow-left', '50%');
                tooltip.style.left = `${centerX}px`;
                tooltip.style.top = `${rect.top}px`;
                tooltip.classList.remove("hidden");

                const tipRect = tooltip.getBoundingClientRect();
                const pad = 8;
                let shift = 0;
                if (tipRect.left < pad) {
                    shift = pad - tipRect.left;
                } else if (tipRect.right > window.innerWidth - pad) {
                    shift = (window.innerWidth - pad) - tipRect.right;
                }
                if (shift !== 0) {
                    tooltip.style.left = `${centerX + shift}px`;
                    tooltip.style.setProperty('--arrow-left', `calc(50% - ${shift}px)`);
                }
            });

            cell.addEventListener("mouseleave", () => {
                tooltip.classList.add("hidden");
            });

            // Check if we need to render a month label (only for the current year to avoid duplicates at edges)
            if (currentDate.getDate() === 1 && currentDate.getFullYear() === currentYear) {
                const monthIdx = currentDate.getMonth();
                const monthLabel = document.createElement("div");
                monthLabel.className = "month-label";
                monthLabel.textContent = months[monthIdx];
                monthLabel.style.transform = "translateX(-50%)";
                monthsContainer.appendChild(monthLabel);
                monthLabels.push({ el: monthLabel, week: currentWeek });
            }

            grid.appendChild(cell);

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
            if (currentDate.getDay() === 0) {
                currentWeek++;
            }
        }

        totalWeeks = currentDate.getDay() === 0 ? currentWeek : currentWeek + 1;
        updateGridLayout(true);
    }

    function updateScrollIndicator() {
        if (!scrollIndicator || !scrollThumb || !gridScroll) return;
        const maxScroll = gridScroll.scrollWidth - gridScroll.clientWidth;
        if (maxScroll <= 1) {
            scrollIndicator.classList.add("hidden");
            return;
        }
        scrollIndicator.classList.remove("hidden");
        const visibleRatio = gridScroll.clientWidth / gridScroll.scrollWidth;
        const thumbWidthPct = Math.max(15, Math.min(100, visibleRatio * 100));
        const scrollProgress = Math.max(0, Math.min(1, gridScroll.scrollLeft / maxScroll));
        const thumbLeftPct = scrollProgress * (100 - thumbWidthPct);
        scrollThumb.style.width = `${thumbWidthPct}%`;
        scrollThumb.style.left = `${thumbLeftPct}%`;
    }

    function updateGridLayout() {
        if (!gridScroll || totalWeeks <= 0) return;

        const totalGridWidth = totalWeeks * COL_WIDTH - CELL_GAP;

        document.documentElement.style.setProperty('--cell-size', `${CELL_SIZE}px`);
        document.documentElement.style.setProperty('--cell-gap', `${CELL_GAP}px`);

        monthsContainer.style.width = `${totalGridWidth}px`;
        monthLabels.forEach((item, idx) => {
            const nextWeek = idx + 1 < monthLabels.length ? monthLabels[idx + 1].week : totalWeeks;
            const centerWeek = (item.week + nextWeek) / 2;
            const halfLabel = item.el.offsetWidth / 2;
            const rawLeft = centerWeek * COL_WIDTH - CELL_GAP / 2;
            const clampedLeft = Math.max(halfLabel, Math.min(totalGridWidth - halfLabel, rawLeft));
            item.el.style.left = `${clampedLeft}px`;
        });

        const maxScroll = gridScroll.scrollWidth - gridScroll.clientWidth;
        if (maxScroll > 1) {
            if (!hasAutoScrolled) {
                gridScroll.scrollLeft = maxScroll;
                hasAutoScrolled = true;
            }
        } else {
            hasAutoScrolled = false;
            gridScroll.scrollLeft = 0;
        }

        updateScrollIndicator();

        if (!isLocalhost && heatmapWrapper && window.parent !== window) {
            window.parent.postMessage({
                type: 'heatmap-resize',
                width: heatmapWrapper.offsetWidth,
                height: heatmapWrapper.offsetHeight
            }, '*');
        }
    }

    if (gridScroll) {
        gridScroll.addEventListener("scroll", () => {
            tooltip.classList.add("hidden");
            updateScrollIndicator();
        }, { passive: true });

        if (scrollIndicator) {
            let isDraggingIndicator = false;
            const scrollFromPointer = (clientX) => {
                const rect = scrollIndicator.getBoundingClientRect();
                if (rect.width <= 0) return;
                const maxScroll = gridScroll.scrollWidth - gridScroll.clientWidth;
                if (maxScroll <= 0) return;
                const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                gridScroll.scrollLeft = ratio * maxScroll;
            };
            scrollIndicator.addEventListener("pointerdown", (e) => {
                isDraggingIndicator = true;
                scrollIndicator.setPointerCapture(e.pointerId);
                scrollFromPointer(e.clientX);
            });
            scrollIndicator.addEventListener("pointermove", (e) => {
                if (isDraggingIndicator) scrollFromPointer(e.clientX);
            });
            const stopDrag = () => { isDraggingIndicator = false; };
            scrollIndicator.addEventListener("pointerup", stopDrag);
            scrollIndicator.addEventListener("pointercancel", stopDrag);
        }

        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                if (resizeRafId) cancelAnimationFrame(resizeRafId);
                resizeRafId = requestAnimationFrame(() => updateGridLayout());
            });
            resizeObserver.observe(gridScroll);
        } else {
            window.addEventListener("resize", () => updateGridLayout());
        }
    }

    renderHeatmap(activeData);

    // Local Scan Folders Manager (only active when served via Settings.bat / server.py)
    const toggleFoldersBtn = document.getElementById("toggle-folders");
    const foldersCountEl = document.getElementById("folders-count");
    const foldersPanel = document.getElementById("folders-panel");
    const foldersListEl = document.getElementById("folders-list");
    const folderPathInput = document.getElementById("folder-path-input");
    const browseFolderBtn = document.getElementById("browse-folder-btn");
    const addFolderBtn = document.getElementById("add-folder-btn");
    const rescanFoldersBtn = document.getElementById("rescan-folders-btn");
    const foldersErrorEl = document.getElementById("folders-error");

    function showFoldersError(msg) {
        if (!foldersErrorEl) return;
        if (!msg) {
            foldersErrorEl.textContent = "";
            foldersErrorEl.classList.add("hidden");
        } else {
            foldersErrorEl.textContent = msg;
            foldersErrorEl.classList.remove("hidden");
        }
    }

    function renderFoldersList(dirs) {
        if (!foldersListEl) return;
        const list = Array.isArray(dirs) ? dirs : [];
        if (foldersCountEl) {
            foldersCountEl.textContent = String(list.length);
        }
        foldersListEl.innerHTML = "";

        if (list.length === 0) {
            const empty = document.createElement("div");
            empty.className = "folders-empty";
            empty.textContent = "No folders configured. Add a workspace folder below to scan tools.";
            foldersListEl.appendChild(empty);
            return;
        }

        list.forEach((item) => {
            const row = document.createElement("div");
            row.className = "folder-row";

            const info = document.createElement("div");
            info.className = "folder-info";

            const pathSpan = document.createElement("span");
            pathSpan.className = "folder-path";
            pathSpan.textContent = item.path;
            pathSpan.title = item.path;

            const badge = document.createElement("span");
            badge.className = item.exists ? "folder-badge" : "folder-badge missing";
            badge.textContent = item.exists
                ? `${item.toolCount} tool${item.toolCount === 1 ? "" : "s"}`
                : "Not found";

            info.appendChild(pathSpan);
            info.appendChild(badge);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "toggle-button folder-remove-btn";
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", () => updateScanDirs({ action: "remove", path: item.path }));

            row.appendChild(info);
            row.appendChild(removeBtn);
            foldersListEl.appendChild(row);
        });
    }

    function setFoldersBusy(busy) {
        if (addFolderBtn) addFolderBtn.disabled = busy;
        if (browseFolderBtn) browseFolderBtn.disabled = busy;
        if (rescanFoldersBtn) rescanFoldersBtn.disabled = busy;
    }

    async function updateScanDirs(payload) {
        showFoldersError("");
        setFoldersBusy(true);
        try {
            const res = await fetch('/scan-dirs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const body = await res.json();
            if (!res.ok) {
                showFoldersError(body.error || "Could not update folders.");
                return false;
            }
            renderFoldersList(body.dirs);
            if (body.data) {
                renderHeatmap(body.data);
            }
            return true;
        } catch (err) {
            showFoldersError("Error: Run Settings.bat to manage scan folders.");
            return false;
        } finally {
            setFoldersBusy(false);
        }
    }

    if (isLocalhost && window.location.protocol !== 'file:' && toggleFoldersBtn && foldersPanel) {
        toggleFoldersBtn.addEventListener("click", () => {
            foldersPanel.classList.toggle("hidden");
            const expanded = !foldersPanel.classList.contains("hidden");
            toggleFoldersBtn.setAttribute("aria-expanded", String(expanded));
        });

        fetch('/scan-dirs')
            .then(res => (res.ok ? res.json() : Promise.reject()))
            .then(body => renderFoldersList(body.dirs))
            .catch(() => {
                if (toggleFoldersBtn) toggleFoldersBtn.style.display = "none";
            });

        if (addFolderBtn && folderPathInput) {
            const handleAdd = async () => {
                const raw = folderPathInput.value.trim();
                if (!raw) {
                    showFoldersError("Please enter or browse for a folder path.");
                    return;
                }
                const ok = await updateScanDirs({ action: "add", path: raw });
                if (ok) folderPathInput.value = "";
            };
            addFolderBtn.addEventListener("click", handleAdd);
            folderPathInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                }
            });
        }

        if (browseFolderBtn) {
            browseFolderBtn.addEventListener("click", async () => {
                showFoldersError("");
                setFoldersBusy(true);
                try {
                    const res = await fetch('/browse-folder', { method: 'POST' });
                    const body = await res.json();
                    if (!res.ok) {
                        showFoldersError(body.error || "Could not open folder picker.");
                        return;
                    }
                    if (body.path) {
                        await updateScanDirs({ action: "add", path: body.path });
                    }
                } catch (err) {
                    showFoldersError("Error: Run Settings.bat to browse folders.");
                } finally {
                    setFoldersBusy(false);
                }
            });
        }

        if (rescanFoldersBtn) {
            rescanFoldersBtn.addEventListener("click", () => updateScanDirs({ action: "rescan" }));
        }
    } else if (toggleFoldersBtn) {
        toggleFoldersBtn.style.display = "none";
    }

    // Save & Update Framer button logic
    const saveBtn = document.getElementById("save-framer-btn");
    const saveStatus = document.getElementById("save-status");
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            saveBtn.disabled = true;
            saveBtn.textContent = "Updating...";
            saveStatus.style.display = "block";
            saveStatus.textContent = "";
            saveStatus.style.color = "#059669";
            
            const isDark = document.body.classList.contains("dark");
            const isHidden = heatmapWrapper && heatmapWrapper.classList.contains("heatmap-hidden");
            
            const payload = {
                theme: isDark ? "dark" : "light",
                levels: isHidden ? "hidden" : "visible",
                tooltip: currentTooltipFormat
            };
            
            fetch('/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            }).then(async res => {
                const msg = await res.text();
                if (!res.ok) throw new Error(msg || "Update failed");
                return msg;
            }).then(() => {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save & Update Framer";
                saveStatus.textContent = "Success! Framer will reflect changes in ~60 seconds.";
            }).catch(err => {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save & Update Framer";
                saveStatus.style.color = "red";
                saveStatus.textContent = err && err.message && err.message.startsWith("Update failed")
                    ? err.message
                    : "Error: You must run Settings.bat to use the Save button.";
            });
        });
    }
});
