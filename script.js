document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("heatmap-grid");
    const monthsContainer = document.getElementById("months-container");
    const contributionCount = document.getElementById("contribution-count");
    const productionRate = document.getElementById("production-rate");
    const tooltip = document.getElementById("tooltip");
    // Read configuration from python scanner output, or fallback to URL parameters
    const serverConfig = typeof heatmapConfig !== 'undefined' ? heatmapConfig : {};
    const urlParams = new URLSearchParams(window.location.search);
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

    // Calculate dates for current year
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1); // Jan 1st
    const endDate = new Date(currentYear, 11, 31); // Dec 31st
    
    // Find the Sunday before or on Jan 1st
    const startDayOfWeek = startDate.getDay();
    const calendarStart = new Date(startDate);
    calendarStart.setDate(startDate.getDate() - startDayOfWeek);

    const CELL_SIZE = 11;
    const CELL_GAP = 3;
    const COL_WIDTH = CELL_SIZE + CELL_GAP;

    let currentDate = new Date(calendarStart);
    let currentWeek = 0;
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    while (currentDate <= endDate || currentDate.getDay() !== 0) {
        if (currentDate > endDate && currentDate.getDay() === 0) {
            break;
        }

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
        
        cell.addEventListener("mouseenter", (e) => {
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
            
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top}px`;
            tooltip.classList.remove("hidden");
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
            // Position based on current week index
            monthLabel.style.left = `${currentWeek * COL_WIDTH}px`;
            monthsContainer.appendChild(monthLabel);
        }
        
        grid.appendChild(cell);

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() === 0) {
            currentWeek++;
        }
    }

    // Hide controls if NOT running on localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
        const controls = document.getElementById("ui-controls");
        if (controls) controls.style.display = "none";
        
        const saveStatus = document.getElementById("save-status");
        if (saveStatus) saveStatus.style.display = "none";
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
