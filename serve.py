"""Tiny local web server for the theory app (127.0.0.1 only, no internet access).
Started hidden by start-theory-app.bat with pythonw, which has no console, so logging is switched off."""
import os, sys, http.server

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, 'app'))
sys.stdout = sys.stderr = open(os.devnull, 'w')   # pythonw has no stdout/stderr; the default logger would crash on write
PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
                      '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'}

    def log_message(self, *args):
        pass


try:
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
except OSError:
    pass   # the port is already in use: the app is already running, nothing to do
