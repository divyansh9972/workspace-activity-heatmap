import http.server
import socketserver
import json
import os
import subprocess
import threading

PORT = 8000

class ConfigHandler(http.server.SimpleHTTPRequestHandler):
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
