import http.server
import socketserver
import json
import os
import subprocess
import threading

PORT = 8000

class ConfigHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path == '/settings.html':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Read existing config
            config = {"theme": "light", "levels": "hidden", "tooltip": "tools"}
            if os.path.exists("config.json"):
                with open("config.json", "r") as f:
                    config = json.load(f)
                    
            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <title>Framer Heatmap Settings</title>
                <style>
                    body {{ font-family: "Inter", system-ui, sans-serif; background: #f9fafb; display: flex; justify-content: center; padding: 40px; color: #111827; }}
                    .card {{ background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }}
                    h2 {{ margin-top: 0; margin-bottom: 24px; font-size: 20px; }}
                    .group {{ margin-bottom: 20px; }}
                    label {{ display: block; font-weight: 500; margin-bottom: 8px; font-size: 14px; color: #374151; }}
                    select {{ width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; background: white; }}
                    select:focus {{ border-color: #000; }}
                    button {{ width: 100%; padding: 12px; background: black; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; margin-top: 10px; }}
                    button:hover {{ background: #374151; }}
                    button:disabled {{ background: #9ca3af; cursor: not-allowed; }}
                    #status {{ margin-top: 15px; text-align: center; font-size: 14px; font-weight: 500; color: #059669; min-height: 20px; }}
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Heatmap Settings</h2>
                    <div class="group">
                        <label>Color Theme</label>
                        <select id="theme">
                            <option value="light" {"selected" if config["theme"]=="light" else ""}>Light Theme</option>
                            <option value="dark" {"selected" if config["theme"]=="dark" else ""}>Dark Theme</option>
                        </select>
                    </div>
                    <div class="group">
                        <label>Activity Mode</label>
                        <select id="levels">
                            <option value="hidden" {"selected" if config["levels"]=="hidden" else ""}>Hidden Levels (Clean)</option>
                            <option value="visible" {"selected" if config["levels"]=="visible" else ""}>Visible Levels (GitHub Style)</option>
                        </select>
                    </div>
                    <div class="group">
                        <label>Tooltip Format</label>
                        <select id="tooltip">
                            <option value="tools" {"selected" if config["tooltip"]=="tools" else ""}>Show Tool Names</option>
                            <option value="detailed" {"selected" if config["tooltip"]=="detailed" else ""}>Show File Counts</option>
                            <option value="simple" {"selected" if config["tooltip"]=="simple" else ""}>Show Simple Status</option>
                        </select>
                    </div>
                    <button id="updateBtn" onclick="saveAndUpdate()">Save & Update Framer</button>
                    <div id="status"></div>
                </div>
                <script>
                    function saveAndUpdate() {{
                        const btn = document.getElementById('updateBtn');
                        const status = document.getElementById('status');
                        btn.disabled = true;
                        btn.textContent = 'Updating (Please wait...)';
                        status.textContent = '';
                        status.style.color = '#059669';
                        
                        const payload = {{
                            theme: document.getElementById('theme').value,
                            levels: document.getElementById('levels').value,
                            tooltip: document.getElementById('tooltip').value
                        }};
                        
                        fetch('/update', {{
                            method: 'POST',
                            headers: {{'Content-Type': 'application/json'}},
                            body: JSON.stringify(payload)
                        }}).then(res => res.text()).then(msg => {{
                            btn.textContent = 'Save & Update Framer';
                            btn.disabled = false;
                            status.textContent = 'Success! Framer will reflect changes in ~60 seconds.';
                        }}).catch(err => {{
                            btn.textContent = 'Save & Update Framer';
                            btn.disabled = false;
                            status.style.color = 'red';
                            status.textContent = 'Error communicating with local server.';
                        }});
                    }}
                </script>
            </body>
            </html>
            """
            self.wfile.write(html.encode())
            return
            
        return super().do_GET()
        
    def do_POST(self):
        if self.path == '/update':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            config = json.loads(post_data.decode())
            
            # Save config.json
            with open("config.json", "w") as f:
                json.dump(config, f)
                
            # Run the update process in background so we can respond immediately
            def run_scripts():
                subprocess.run(["python", "scanner.py"], shell=True)
                subprocess.run(["git", "add", "."], shell=True)
                subprocess.run(["git", "commit", "-m", "Settings update from local web dashboard"], shell=True)
                subprocess.run(["git", "push"], shell=True)
                
            threading.Thread(target=run_scripts).start()
            
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"Success")

with socketserver.TCPServer(("127.0.0.1", PORT), ConfigHandler) as httpd:
    print(f"Settings Dashboard running at http://localhost:{PORT}")
    httpd.serve_forever()
