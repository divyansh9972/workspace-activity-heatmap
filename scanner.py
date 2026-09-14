import os
import json
from datetime import datetime, timedelta

def scan_tool(tool_path, tool_name, activity_data):
    excludes = {'.git', 'node_modules', 'venv', '.obsidian', '__pycache__', '.next', 'dist', 'build'}
    
    for root, dirs, files in os.walk(tool_path):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in excludes]
        
        for file in files:
            filepath = os.path.join(root, file)
            try:
                stats = os.stat(filepath)
                ctime = datetime.fromtimestamp(stats.st_ctime)
                mtime = datetime.fromtimestamp(stats.st_mtime)
                
                # Consider both creation and modification as activity
                dates_to_record = {ctime.date().isoformat(), mtime.date().isoformat()}
                
                for date_str in dates_to_record:
                    if date_str not in activity_data:
                        activity_data[date_str] = {"count": 0, "tools": set()}
                    activity_data[date_str]["count"] += 1
                    activity_data[date_str]["tools"].add(tool_name)
            except Exception:
                pass

def main():
    dirs_to_scan = [
        r"C:\Users\divya\.gemini\antigravity\scratch",
        r"C:\Users\divya\.gemini\antigravity-ide\scratch"
    ]
    
    tool_count = 0
    excludes_top = {'workspace-activity-heatmap', '.git', 'node_modules', 'venv', '.obsidian', '__pycache__', '.next'}
    
    activity_data = {}
    for d in dirs_to_scan:
        if os.path.exists(d):
            # Count tools (top-level directories) and scan them
            for name in os.listdir(d):
                tool_path = os.path.join(d, name)
                if os.path.isdir(tool_path) and name not in excludes_top:
                    tool_count += 1
                    scan_tool(tool_path, name, activity_data)
            
    # Calculate total contributions in the last year
    one_year_ago = (datetime.now() - timedelta(days=365)).date()
    total_last_year = sum(data["count"] for date_str, data in activity_data.items() if datetime.fromisoformat(date_str).date() >= one_year_ago)
            
    # Calculate production rate (tools per month)
    production_rate = round(tool_count / 12.0, 1)

    # Convert sets to lists for JSON serialization
    for date_str in activity_data:
        activity_data[date_str]["tools"] = list(activity_data[date_str]["tools"])

    output_data = {
        "contributions": activity_data,
        "totalLastYear": total_last_year,
        "totalTools": tool_count,
        "productionRate": production_rate,
        "lastUpdated": datetime.now().isoformat()
    }
            
    # Read settings config
    config = {"theme": "light", "levels": "hidden", "tooltip": "tools"}
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)

    # Output to JS file
    out_path = os.path.join(os.path.dirname(__file__), 'activity-data.js')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(f"const heatmapConfig = {json.dumps(config, indent=2)};\n")
        f.write(f"const heatmapData = {json.dumps(output_data, indent=2)};\n")
        
    print(f"Generated data for {len(activity_data)} days. Total last year: {total_last_year}")

if __name__ == "__main__":
    main()
