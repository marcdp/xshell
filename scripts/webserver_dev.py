from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, **kwargs):
        # Set custom directory (do NOT change working directory)
        super().__init__(*args, directory=directory, **kwargs)
    def end_headers(self):
        # Disable caching
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

# methods
def webserver_dev(path:str = "./src"):
    HOST = 'localhost'
    PORT = 8000

    # Create the server
    handler = lambda *args, **kwargs: NoCacheHTTPRequestHandler(*args, directory=str(path), **kwargs)
    with ThreadingHTTPServer((HOST, PORT), handler) as server:
        print(f"Serving HTTP on {HOST} port {PORT} (http://{HOST}:{PORT}/) ...")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")