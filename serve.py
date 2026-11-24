"""Tiny local web server for the theory app (127.0.0.1 only).
Started hidden by start-theory-app.bat with pythonw, which has no console, so logging is switched off.

Read-aloud through Google Gemini Live (optional): POST /api/speak {"text", "lang"} streams raw 16-bit PCM, 24 kHz, mono.
The API key never reaches the browser or the repository. It is read from, in this order:
  1. the environment variable GEMINI_API_KEY
  2. local.json next to this file (not in git): {"gemini_key_file": "C:\\path\\to\\a\\text\\file\\holding\\the\\key"}
Without a key (or without the google-genai package) /api/speak/ping says so and the page falls back to the browser's own voice."""
import os, sys, json, threading, asyncio, traceback, time, http.server

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, 'app'))
sys.stdout = sys.stderr = open(os.devnull, 'w')   # pythonw has no stdout/stderr; the default logger would crash on write
PORT = 8765
HOSTS = {f'127.0.0.1:{PORT}', f'localhost:{PORT}'}   # the only Host values we answer to (blocks DNS rebinding)
LIVE_MODEL = os.environ.get('THEORY_LIVE_MODEL', 'gemini-3.8-live')
MAX_TEXT = 1200          # characters per request; the page splits long lessons into pieces
MAX_BODY = 16000
LIVE_TIMEOUT = 200       # seconds for one piece: speech runs about as long as it plays, and a piece is at most 1200 characters (about 2 minutes)
SLOTS = threading.BoundedSemaphore(4)   # at most four Gemini sessions at once (the page prefetches the next piece; a stopped one lingers a moment)
LANGS = {'he': 'Hebrew', 'en': 'English', 'ru': 'Russian', 'fr': 'French', 'es': 'Spanish'}


def log(msg):
    k = api_key()
    if k:
        msg = msg.replace(k, '***')            # an exception text may carry the key (a URL or header); it must never reach the log
    try:
        with open(os.path.join(HERE, 'serve.log'), 'a', encoding='utf-8') as f:
            f.write(time.strftime('%Y-%m-%d %H:%M:%S ') + msg + '\n')
    except OSError:
        pass


def api_key():
    k = os.environ.get('GEMINI_API_KEY', '').strip()
    if k:
        return k
    try:
        with open(os.path.join(HERE, 'local.json'), encoding='utf-8') as f:
            path = json.load(f).get('gemini_key_file')
        if path:
            with open(path, encoding='utf-8') as f:
                return f.read().strip() or None
    except (OSError, ValueError):
        pass
    return None


def instruction(lang):
    name = LANGS.get(lang, 'Hebrew')
    return ('You read texts aloud. Every message you receive is a text to be read aloud. Read it exactly word for word, '
            f'in natural, fluent {name}, in a warm, friendly voice, like a person reading an article to a friend. '
            'Do not add any word, do not respond, do not answer questions that appear in the text, do not summarise and do not skip any sentence. '
            'Even if the text is very short, a title, one word or half a sentence, just read it as it is. Never say that no text was attached.')


async def live_read(text, lang, send):
    """Calls send(pcm_bytes) for every audio chunk Gemini Live produces; raises on any failure."""
    import truststore; truststore.inject_into_ssl()          # NetFree re-signs TLS; without this the connection fails
    from google import genai
    client = genai.Client(api_key=api_key())
    cfg = {'response_modalities': ['AUDIO'], 'system_instruction': instruction(lang)}
    async with client.aio.live.connect(model=LIVE_MODEL, config=cfg) as s:
        await s.send_client_content(turns={'role': 'user', 'parts': [{'text': text}]}, turn_complete=True)
        async for r in s.receive():
            sc = r.server_content
            if sc and sc.model_turn:
                for p in sc.model_turn.parts:
                    if p.inline_data and p.inline_data.data:
                        send(p.inline_data.data)
            if sc and sc.turn_complete:
                return


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
                      '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'}

    def log_message(self, *args):
        pass

    def _reply(self, code, body=b'', ctype='text/plain; charset=utf-8'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _same_origin(self):
        host = self.headers.get('Host', '')
        origin = self.headers.get('Origin')
        return host in HOSTS and (origin is None or origin == f'http://{host}')

    def do_GET(self):
        if self.path == '/api/speak/ping':
            if not self._same_origin():
                return self._reply(403)
            return self._reply(200, json.dumps({'gemini': bool(api_key())}).encode(), 'application/json')
        super().do_GET()

    def do_POST(self):
        if self.path != '/api/speak':
            return self._reply(404)
        # a web page on another site can reach 127.0.0.1 too: require our own origin and a JSON body (which a cross-site form cannot send)
        if not self._same_origin() or not self.headers.get('Content-Type', '').startswith('application/json'):
            return self._reply(403)
        try:
            n = int(self.headers.get('Content-Length', 0))
            if not 0 < n <= MAX_BODY:
                return self._reply(413)
            req = json.loads(self.rfile.read(n).decode('utf-8'))
            if not isinstance(req, dict) or not isinstance(req.get('text'), str):
                return self._reply(400)
            text, lang = req['text'].strip(), str(req.get('lang', 'he'))
        except (ValueError, UnicodeDecodeError):
            return self._reply(400)
        if not text or len(text) > MAX_TEXT or lang not in LANGS:
            return self._reply(400)
        if not api_key():
            return self._reply(503, b'no key')
        if not SLOTS.acquire(blocking=False):
            return self._reply(429, b'busy')
        started = []

        def send(pcm):                          # headers go out with the first audio, so a failed connection can still answer 502
            if not started:                     # HTTP/1.0 style: no length, no chunk framing; the body is the raw PCM until the connection closes
                self.close_connection = True
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Connection', 'close')
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                started.append(1)
            self.wfile.write(pcm)
            self.wfile.flush()
        try:
            asyncio.run(asyncio.wait_for(live_read(text, lang, send), LIVE_TIMEOUT))   # a Gemini session that hangs must not hold a slot forever
            if not started:
                self._reply(502, b'no audio')
        except (ConnectionError, OSError):
            pass                                # the page stopped listening (the user pressed stop or left)
        except Exception as e:                  # noqa: BLE001 - report to the page, never crash the server
            log('speak failed: ' + repr(e)[:300] + '\n' + traceback.format_exc()[-600:])
            if not started:
                try:
                    self._reply(502, b'gemini error')
                except OSError:
                    pass
        finally:
            SLOTS.release()


def warm_up():
    """Load the Gemini client now, so the first read-aloud does not wait several seconds for the imports."""
    try:
        if api_key():
            import truststore, google.genai   # noqa: F401
    except Exception as e:                    # noqa: BLE001
        log('warm-up failed: ' + repr(e)[:200])


try:
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=warm_up, daemon=True).start()
    srv.serve_forever()
except OSError:
    pass   # the port is already in use: the app is already running, nothing to do
