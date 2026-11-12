document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
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
    const data = typeof heatmapData !== 'undefined' ? heatmapData : { contributions: {}, totalLastYear: 0, totalTools: 0, productionRate: 0, lastUpdated: null };
    const currentYearForHeader = new Date().getFullYear();
    contributionCount.textContent = `${(data.totalTools || 0).toLocaleString()} Tools Built in ${currentYearForHeader}`;
    if (productionRate) {
        productionRate.textContent = `~${data.productionRate || 0} / month`;
    }
    
    // Relative Time Logic for "Last Updated"
    const lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl && data.lastUpdated) {
        const updatedTime = new Date(data.lastUpdated);
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

    const MIN_CELL_SIZE = 11;
    const MIN_CELL_GAP = 3;
    const MAX_CELL_SIZE = 24;

    let currentDate = new Date(calendarStart);
    let currentWeek = 0;
    const monthLabels = [];
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    while (currentDate <= endDate) {
        const cell = document.createElement("div");
        cell.className = "cell";
        
        const dateStr = [
            currentDate.getFullYear(),
            String(currentDate.getMonth() + 1).padStart(2, '0'),
            String(currentDate.getDate()).padStart(2, '0')
        ].join('-');

        const dailyData = data.contributions[dateStr];
        const count = dailyData ? dailyData.count : 0;
        
        let level = 0;
        if (count >= 1 && count <= 2) level = 1;
        else if (count >= 3 && count <= 10) level = 2;
        else if (count >= 11 && count <= 25) level = 3;
        else if (count >= 26) level = 4;

        cell.classList.add(`level-${level}`);
        
        // Format for tooltip: "[Date], [Number of file changes], [Activity level]"
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
                    const tools = (data.contributions[dateStr] && data.contributions[dateStr].tools) || [];
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

    const totalWeeks = currentDate.getDay() === 0 ? currentWeek : currentWeek + 1;
    let hasAutoScrolled = false;
    let lastAvailableWidth = -1;
    let resizeRafId = null;

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

    function updateGridLayout(force = false) {
        if (!gridScroll || totalWeeks <= 0) return;

        const availableWidth = gridScroll.clientWidth;
        if (availableWidth <= 0) return;
        if (!force && availableWidth === lastAvailableWidth) return;
        lastAvailableWidth = availableWidth;

        const minGridWidth = totalWeeks * (MIN_CELL_SIZE + MIN_CELL_GAP) - MIN_CELL_GAP;
        let cellSize = MIN_CELL_SIZE;
        let cellGap = MIN_CELL_GAP;

        // Fill container width cleanly on desktop/wide viewports; keep minimum readable size + horizontal scroll on phone
        if (availableWidth > minGridWidth) {
            cellGap = Math.max(MIN_CELL_GAP, Math.min(5, Math.round(availableWidth / (totalWeeks * 4.5))));
            cellSize = Math.min(MAX_CELL_SIZE, (availableWidth - (totalWeeks - 1) * cellGap) / totalWeeks);
        }

        const colWidth = cellSize + cellGap;
        const totalGridWidth = totalWeeks * colWidth - cellGap;

        document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
        document.documentElement.style.setProperty('--cell-gap', `${cellGap}px`);

        monthsContainer.style.width = `${totalGridWidth}px`;
        monthLabels.forEach((item, idx) => {
            const nextWeek = idx + 1 < monthLabels.length ? monthLabels[idx + 1].week : totalWeeks;
            const centerWeek = (item.week + nextWeek) / 2;
            const halfLabel = item.el.offsetWidth / 2;
            const rawLeft = centerWeek * colWidth - cellGap / 2;
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

    updateGridLayout(true);

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
            }).then(res => res.text()).then(msg => {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save & Update Framer";
                saveStatus.textContent = "Success! Framer will reflect changes in ~60 seconds.";
            }).catch(err => {
                saveBtn.disabled = false;
                saveBtn.textContent = "Save & Update Framer";
                saveStatus.style.color = "red";
                saveStatus.textContent = "Error: You must run Settings.bat to use the Save button.";
            });
        });
    }
});
