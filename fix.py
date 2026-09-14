import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Move config parsing to top
config_block = '''    // Read configuration from python scanner output, or fallback to URL parameters
    const serverConfig = typeof heatmapConfig !== 'undefined' ? heatmapConfig : {};
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme') || serverConfig.theme || 'light';
    const levelsParam = urlParams.get('levels') || serverConfig.levels || 'hidden';
    const tooltipParam = urlParams.get('tooltip') || serverConfig.tooltip || 'tools';
    
    let currentTooltipFormat = tooltipParam;
'''

content = content.replace('''    // Read configuration from python scanner output, or fallback to URL parameters
    const serverConfig = typeof heatmapConfig !== 'undefined' ? heatmapConfig : {};
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme') || serverConfig.theme || 'light';
    const levelsParam = urlParams.get('levels') || serverConfig.levels || 'hidden';
    const tooltipParam = urlParams.get('tooltip') || serverConfig.tooltip || 'tools';''', '')

content = content.replace('''    const tooltip = document.getElementById("tooltip");''', 
'''    const tooltip = document.getElementById("tooltip");
''' + config_block)

# 2. Update toggle level UI on load
content = content.replace('''    if (toggleBtn && heatmapWrapper) {''',
'''    if (toggleBtn && heatmapWrapper) {
        if (levelsParam === "hidden") {
            toggleBtn.textContent = "Show Levels";
        } else {
            toggleBtn.textContent = "Hide Levels";
        }''')

# 3. Update dropdown UI on load and update currentTooltipFormat on click
dropdown_init = '''        // Initialize dropdown state
        selectItems.forEach(item => {
            if (item.getAttribute("data-value") === tooltipParam) {
                selectItems.forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                selectValue.textContent = item.querySelector(".custom-select-item-text").textContent;
            }
        });

        // Toggle dropdown open/close'''

content = content.replace('''        // Toggle dropdown open/close''', dropdown_init)

content = content.replace('''                // Update trigger text
                const itemText = item.querySelector(".custom-select-item-text").textContent;
                selectValue.textContent = itemText;''',
'''                // Update trigger text
                const itemText = item.querySelector(".custom-select-item-text").textContent;
                selectValue.textContent = itemText;
                
                // Update global format
                currentTooltipFormat = item.getAttribute("data-value");''')

# 4. Use currentTooltipFormat in mouseenter
content = content.replace('''            // Dynamically check the dropdown format on hover
            let format = tooltipParam;
            const selectEl = document.getElementById("tooltip-format-select");
            if (selectEl) {
                const activeItem = selectEl.querySelector(".custom-select-item.active");
                if (activeItem) format = activeItem.getAttribute("data-value");
            }''',
'''            const format = currentTooltipFormat;''')

# 5. Use currentTooltipFormat in save payload
content = content.replace('''            let tooltipFormat = tooltipParam;
            const customSelect = document.getElementById("tooltip-format-select");
            if (customSelect) {
                const activeItem = customSelect.querySelector(".custom-select-item.active");
                if (activeItem) tooltipFormat = activeItem.getAttribute("data-value");
            }
            
            const payload = {
                theme: isDark ? "dark" : "light",
                levels: isHidden ? "hidden" : "visible",
                tooltip: tooltipFormat
            };''',
'''            const payload = {
                theme: isDark ? "dark" : "light",
                levels: isHidden ? "hidden" : "visible",
                tooltip: currentTooltipFormat
            };''')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)
