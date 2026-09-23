import decky
import json
import os
import random
import asyncio
import shutil
import signal
import subprocess
import logging
import base64
import urllib.parse
import urllib.request

_PY_MODULES = os.path.join(decky.DECKY_PLUGIN_DIR, "py_modules")
BROWSER_AUTH_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "browser.json")
SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
CAST_SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "cast-settings.json")
logger = logging.getLogger("YouTubeMusic")

# Integrated Cast Receiver backend
PLUGIN_DIR = os.path.dirname(os.path.realpath(__file__))
NODE_BIN_SRC = os.path.join(PLUGIN_DIR, "bin", "node")
YTDLP_BIN_SRC = os.path.join(PLUGIN_DIR, "bin", "yt-dlp")
SERVER_JS = os.path.join(PLUGIN_DIR, "backend", "out", "server.cjs")
RUNTIME_DIR = "/tmp/youtube-music-cast-receiver"
NODE_BIN = os.path.join(RUNTIME_DIR, "node")
YTDLP_BIN = os.path.join(RUNTIME_DIR, "yt-dlp")


def _stage_runtime_binaries():
    os.makedirs(RUNTIME_DIR, exist_ok=True)
    for src, dst in ((NODE_BIN_SRC, NODE_BIN), (YTDLP_BIN_SRC, YTDLP_BIN)):
        if not os.path.exists(src):
            continue
        try:
            shutil.copy2(src, dst)
        except OSError as e:
            logger.warning(f"Could not refresh {dst}: {e}; using existing copy")
        try:
            os.chmod(dst, 0o755)
        except OSError:
            pass


class Plugin:
    node_process = None
    authenticated = False
    ytmusic = None

    # Queue / playback state
    queue = []
    queue_position = 0
    is_playing = False
    shuffle = False
    shuffle_order = []
    repeat = "NONE"         # NONE | ALL | ONE
    volume = 1.0
    cast_device_name = "SteamDeck"
    notification_settings = {"connections": True, "tracks": True, "connectionSound": False, "trackSound": False}

    async def get_artwork_data_url(self, url):
        """Return only small Google-hosted cover art for local color sampling."""
        try:
            parsed = urllib.parse.urlparse(str(url or ''))
            hostname = (parsed.hostname or '').lower()
            allowed = parsed.scheme == 'https' and (
                hostname.endswith('.googleusercontent.com') or hostname.endswith('.ggpht.com') or hostname.endswith('.ytimg.com'))
            if not allowed:
                return {}

            def fetch():
                request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(request, timeout=8) as response:
                    final = urllib.parse.urlparse(response.geturl())
                    final_host = (final.hostname or '').lower()
                    if final.scheme != 'https' or not (
                            final_host.endswith('.googleusercontent.com') or final_host.endswith('.ggpht.com') or final_host.endswith('.ytimg.com')):
                        return None
                    mime = (response.headers.get_content_type() or '').lower()
                    if mime not in ('image/jpeg', 'image/png', 'image/webp'):
                        return None
                    content = response.read(524289)
                    if len(content) > 524288:
                        return None
                    return f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"

            data_url = await asyncio.to_thread(fetch)
            return {"dataUrl": data_url} if data_url else {}
        except Exception as error:
            decky.logger.debug(f"Artwork palette fallback failed: {error}")
            return {}

    # ── Authentication (browser cookies) ───────────────────────────

    def _try_init_ytmusic(self):
        """Initialize ytmusicapi using browser request headers (cookies)."""
        if os.path.exists(BROWSER_AUTH_FILE):
            try:
                from ytmusicapi import YTMusic
                self.ytmusic = YTMusic(BROWSER_AUTH_FILE)
                self.authenticated = True
                decky.logger.info("ytmusicapi initialized with browser auth")
                return
            except Exception as e:
                decky.logger.error(f"Failed to init ytmusicapi: {e}")
        self.authenticated = False
        self.ytmusic = None

    def _load_settings(self):
        """Load persisted settings (volume, etc.) from disk."""
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                self.volume = data.get("volume", 1.0)
                saved = data.get("notifications", {})
                self.notification_settings = {k: saved.get(k, v) if type(saved.get(k, v)) is bool else v
                                              for k, v in Plugin.notification_settings.items()}
            except Exception as e:
                decky.logger.error(f"Failed to load settings: {e}")

        if os.path.exists(CAST_SETTINGS_FILE):
            try:
                with open(CAST_SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                name = str(data.get("device_name", "")).strip()
                if name:
                    self.cast_device_name = name[:50]
            except Exception as e:
                decky.logger.error(f"Failed to load Cast settings: {e}")

    def _save_settings(self):
        """Save persisted settings to disk."""
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            json.dump({"volume": self.volume, "notifications": self.notification_settings}, f)

    async def get_notification_settings(self):
        return dict(self.notification_settings)

    async def set_notification_settings(self, settings):
        if not isinstance(settings, dict) or any(k not in Plugin.notification_settings or type(v) is not bool for k, v in settings.items()):
            return {"error": "Invalid notification settings"}
        previous = self.notification_settings
        self.notification_settings = {**previous, **settings}
        try:
            self._save_settings()
        except Exception:
            self.notification_settings = previous
            return {"error": "Could not save notification settings"}
        return dict(self.notification_settings)

    def _save_cast_settings(self):
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        with open(CAST_SETTINGS_FILE, "w") as f:
            json.dump({"device_name": self.cast_device_name}, f)

    async def _main(self):
        decky.logger.info("YouTube Music plugin loaded")
        self._load_settings()
        self._try_init_ytmusic()
        await self._start_cast_backend()

    async def _start_cast_backend(self):
        if not os.path.exists(SERVER_JS):
            decky.logger.error(f"Cast backend not found: {SERVER_JS}")
            return
        _stage_runtime_binaries()
        if not os.path.exists(NODE_BIN):
            decky.logger.error("Integrated Cast Receiver requires bin/node.")
            return
        env = {
            **os.environ,
            "NODE_ENV": "production",
            "YTCAST_YTDLP_PATH": YTDLP_BIN if os.path.exists(YTDLP_BIN) else YTDLP_BIN_SRC,
            "YTCAST_DEVICE_NAME": self.cast_device_name,
        }
        try:
            self.node_process = subprocess.Popen(
                [NODE_BIN, SERVER_JS],
                cwd=PLUGIN_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                start_new_session=True,
            )
            loop = asyncio.get_running_loop()

            def wait_for_ready():
                if self.node_process and self.node_process.stdout:
                    for line in iter(self.node_process.stdout.readline, b""):
                        decoded = line.decode("utf-8", errors="replace").strip()
                        decky.logger.info(f"[Cast] {decoded}")
                        if decoded == "READY":
                            return True
                return False

            try:
                ready = await asyncio.wait_for(
                    loop.run_in_executor(None, wait_for_ready), timeout=30.0
                )
            except asyncio.TimeoutError:
                decky.logger.error("Integrated Cast backend did not become ready within 30 seconds.")
                await self._stop_cast_backend()
                return

            if not ready:
                decky.logger.error("Integrated Cast backend exited before READY.")
                return

            async def log_stream(stream, level_fn):
                if stream:
                    while True:
                        line = await loop.run_in_executor(None, stream.readline)
                        if not line:
                            break
                        level_fn(f"[Cast] {line.decode('utf-8', errors='replace').strip()}")

            asyncio.ensure_future(log_stream(self.node_process.stdout, decky.logger.info))
            asyncio.ensure_future(log_stream(self.node_process.stderr, decky.logger.warning))
        except Exception as e:
            decky.logger.error(f"Failed to start integrated Cast backend: {e}")

    async def _stop_cast_backend(self):
        if not self.node_process:
            return
        pid = self.node_process.pid
        loop = asyncio.get_running_loop()
        try:
            pgid = os.getpgid(pid)
        except ProcessLookupError:
            self.node_process = None
            return
        try:
            os.killpg(pgid, signal.SIGTERM)
        except ProcessLookupError:
            self.node_process = None
            return
        try:
            await asyncio.wait_for(
                loop.run_in_executor(None, self.node_process.wait), timeout=2.0
            )
        except asyncio.TimeoutError:
            try:
                os.killpg(pgid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(
                    loop.run_in_executor(None, self.node_process.wait), timeout=3.0
                )
            except asyncio.TimeoutError:
                pass
        self.node_process = None

    async def _unload(self):
        decky.logger.info("Stopping integrated YouTube Cast Receiver...")
        await self._stop_cast_backend()
        decky.logger.info("YouTube Music plugin unloaded")

    async def get_cast_device_name(self):
        return {"name": self.cast_device_name}

    async def set_cast_device_name(self, name):
        name = str(name or "").strip()
        if not name:
            return {"error": "Device name cannot be empty"}
        if len(name) > 50:
            return {"error": "Device name must be 50 characters or fewer"}
        self.cast_device_name = name
        self._save_cast_settings()
        # The backend reads this value only at startup. Restart it so the new
        # name is advertised immediately, without requiring a full Deck reboot.
        try:
            await self._stop_cast_backend()
            await self._start_cast_backend()
        except Exception as e:
            decky.logger.error(f"Failed to restart Cast backend after name change: {e}")
            return {"error": str(e)}
        return {"success": True, "name": self.cast_device_name}

    async def get_auth_state(self):
        """Return current browser-cookie authentication status."""
        return {"authenticated": self.authenticated}

    async def load_headers_from_file(self, file_path: str):
        """Read browser request headers from a text file on the Deck.
        Uses ytmusicapi.setup() to parse raw headers into browser.json.
        """
        try:
            if not os.path.exists(file_path):
                return {"error": f"File not found: {file_path}"}

            with open(file_path, "r", encoding="utf-8") as f:
                headers_raw = f.read()

            if not headers_raw.strip():
                return {"error": "File is empty"}

            from ytmusicapi import setup
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            setup(filepath=BROWSER_AUTH_FILE, headers_raw=headers_raw)
            decky.logger.info(f"Browser headers loaded from {file_path}")

            self._try_init_ytmusic()
            if self.authenticated:
                return {"success": True}
            return {"error": "Headers saved but initialization failed. Check that the headers are correct."}
        except Exception as e:
            decky.logger.error(f"Failed to load headers from file: {e}")
            return {"error": str(e)}

    async def sign_out(self):
        """Sign out — delete browser.json and reset all authentication state."""
        self.authenticated = False
        self.ytmusic = None
        self.queue = []
        self.queue_position = 0
        self.is_playing = False
        self.shuffle = False
        self.shuffle_order = []
        self.repeat = "NONE"
        self._cached_playlists = None
        if os.path.exists(BROWSER_AUTH_FILE):
            try:
                os.remove(BROWSER_AUTH_FILE)
            except OSError as e:
                decky.logger.warning(f"Could not remove browser auth file: {e}")
        decky.logger.info("Signed out")
        return {"success": True}

    # ── Streaming URL ──────────────────────────────────────────────

    def _get_streaming_url(self, video_id):
        """Fetch the best audio streaming URL using yt-dlp as a subprocess.
        Runs in a separate Python process to avoid Decky sandbox import issues."""
        import subprocess
        try:
            env = os.environ.copy()
            # Add our py_modules to PYTHONPATH so the subprocess can find yt-dlp
            env['PYTHONPATH'] = _PY_MODULES + ':' + env.get('PYTHONPATH', '')
            # Strip LD_LIBRARY_PATH to avoid Decky's bundled OpenSSL conflicting
            # with the system Python's ssl module (same fix as Deckify)
            env.pop('LD_LIBRARY_PATH', None)

            # Prefer the bundled/staged standalone yt-dlp. This keeps local
            # playback on the same current extractor as Cast playback and avoids
            # SteamOS Python environments carrying an obsolete yt-dlp module.
            ytdlp = YTDLP_BIN if os.path.exists(YTDLP_BIN) else None
            command = ([ytdlp] if ytdlp else ['python3', '-m', 'yt_dlp']) + [
                '--print', 'urls',
                '-f', 'bestaudio[ext=m4a]/bestaudio',
                '--no-warnings',
                '-q',
                '--no-playlist',
                f'https://music.youtube.com/watch?v={video_id}',
            ]

            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                env=env,
                timeout=30,
            )

            url = result.stdout.strip()
            if result.returncode != 0 or not url or not url.startswith('http'):
                decky.logger.warning(f"yt-dlp failed for {video_id}. rc={result.returncode} stderr: {result.stderr[-500:]}")
                return None
            decky.logger.info(f"Got streaming URL for {video_id}")
            return url
        except subprocess.TimeoutExpired:
            decky.logger.error(f"yt-dlp timed out for {video_id}")
            return None
        except Exception as e:
            decky.logger.error(f"Failed to get streaming URL for {video_id}: {e}")
            return None

    def _current_track_with_url(self):
        """Return current track metadata + fresh streaming URL."""
        if not self.queue or self.queue_position >= len(self.queue):
            return None

        track = self.queue[self.queue_position]
        url = self._get_streaming_url(track["videoId"])

        return {
            "videoId": track["videoId"],
            "title": track.get("title", ""),
            "artist": track.get("artist", ""),
            "album": track.get("album", ""),
            "albumArt": track.get("albumArt", ""),
            "duration": track.get("duration", 0),
            "url": url,
            "queuePosition": self.queue_position,
            "queueLength": len(self.queue),
        }

    # ── Playback controls ──────────────────────────────────────────

    async def get_current_track(self):
        """Return current track with fresh streaming URL."""
        result = self._current_track_with_url()
        if result is None:
            return {"error": "No track in queue"}
        if result["url"] is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def resume(self):
        self.is_playing = True
        return {"success": True}

    async def pause(self):
        self.is_playing = False
        return {"success": True}

    def _advance_queue(self, direction=1):
        if not self.queue:
            return None

        if self.repeat == "ONE":
            return self._current_track_with_url()

        if self.shuffle and self.shuffle_order:
            try:
                shuffle_idx = self.shuffle_order.index(self.queue_position)
            except ValueError:
                shuffle_idx = 0
            shuffle_idx += direction

            if shuffle_idx >= len(self.shuffle_order):
                if self.repeat == "ALL":
                    shuffle_idx = 0
                else:
                    self.is_playing = False
                    return None
            elif shuffle_idx < 0:
                if self.repeat == "ALL":
                    shuffle_idx = len(self.shuffle_order) - 1
                else:
                    shuffle_idx = 0

            self.queue_position = self.shuffle_order[shuffle_idx]
        else:
            self.queue_position += direction

            if self.queue_position >= len(self.queue):
                if self.repeat == "ALL":
                    self.queue_position = 0
                else:
                    self.queue_position = len(self.queue) - 1
                    self.is_playing = False
                    return None
            elif self.queue_position < 0:
                if self.repeat == "ALL":
                    self.queue_position = len(self.queue) - 1
                else:
                    self.queue_position = 0

        self.is_playing = True
        return self._current_track_with_url()

    async def next_track(self):
        result = self._advance_queue(1)
        if result is None:
            return {"stopped": True}
        if result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def previous_track(self):
        result = self._advance_queue(-1)
        if result is None:
            return {"stopped": True}
        if result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def track_ended(self):
        return await self.next_track()

    async def get_playback_state(self):
        track = None
        if self.queue and self.queue_position < len(self.queue):
            track = self.queue[self.queue_position]
        return {
            "is_playing": self.is_playing,
            "shuffle": self.shuffle,
            "repeat": self.repeat,
            "volume": self.volume,
            "queue_position": self.queue_position,
            "queue_length": len(self.queue),
            "current_track": track,
        }

    # ── Volume ─────────────────────────────────────────────────────

    async def set_volume(self, value):
        """Set volume. value is 0-100 from frontend."""
        import subprocess
        try:
            value = float(value)
        except (TypeError, ValueError):
            return {"error": f"Invalid volume value: {value!r}"}
        self.volume = max(0, min(100, value)) / 100.0  # store as 0.0-1.0

        # Try to set PulseAudio volume for CEF sink-inputs
        try:
            env = os.environ.copy()
            env.pop('LD_LIBRARY_PATH', None)

            result = subprocess.run(
                ["pactl", "list", "sink-inputs"],
                capture_output=True, text=True, env=env, timeout=5,
            )
            output = result.stdout

            # Parse sink-input indices for steamwebhelper
            current_index = None
            indices = []
            for line in output.split("\n"):
                line = line.strip()
                if line.startswith("Sink Input #"):
                    current_index = line.split("#")[1].strip()
                elif "application.name" in line and "steamwebhelper" in line.lower():
                    if current_index:
                        indices.append(current_index)

            # Set volume on all matching sink-inputs
            percentage = int(value)
            for idx in indices:
                subprocess.run(
                    ["pactl", "set-sink-input-volume", idx, f"{percentage}%"],
                    capture_output=True, env=env, timeout=5,
                )

            if not indices:
                decky.logger.debug("No steamwebhelper sink-inputs found for volume control")
        except Exception as e:
            decky.logger.warning(f"PulseAudio volume control failed (falling back to <audio> only): {e}")

        self._save_settings()
        return {"volume": value}

    async def get_volume(self):
        """Return current volume (0-100 for frontend)."""
        return {"volume": self.volume * 100}

    # ── Like / Dislike ──────────────────────────────────────────────

    async def rate_song(self, video_id, rating):
        if not self.ytmusic:
            return {"error": "Not authenticated"}
        try:
            self.ytmusic.rate_song(video_id, rating)
            # Update the cached likeStatus in the queue
            for t in self.queue:
                if t.get("videoId") == video_id:
                    t["likeStatus"] = rating
            return {"rating": rating}
        except Exception as e:
            decky.logger.error(f"Failed to rate song {video_id}: {e}")
            error_msg = str(e)
            if "Sign in" in error_msg or "sign in" in error_msg:
                return {"error": "Session expired. Please re-authenticate in Settings."}
            return {"error": error_msg}

    async def get_song_rating(self, video_id):
        # Return cached likeStatus from queue data
        for t in self.queue:
            if t.get("videoId") == video_id:
                return {"rating": t.get("likeStatus", "INDIFFERENT")}
        return {"rating": "INDIFFERENT"}

    # ── Shuffle / Repeat ───────────────────────────────────────────

    async def toggle_shuffle(self):
        self.shuffle = not self.shuffle
        if self.shuffle and self.queue:
            self.shuffle_order = list(range(len(self.queue)))
            random.shuffle(self.shuffle_order)
            if self.queue_position in self.shuffle_order:
                self.shuffle_order.remove(self.queue_position)
                self.shuffle_order.insert(0, self.queue_position)
        else:
            self.shuffle_order = []
        return {"shuffle": self.shuffle}

    async def toggle_repeat(self):
        cycle = {"NONE": "ALL", "ALL": "ONE", "ONE": "NONE"}
        self.repeat = cycle.get(self.repeat, "NONE")
        return {"repeat": self.repeat}

    # ── Queue management ─────────────────────────────────────────────

    async def sync_cast_queue(self, tracks, position=-1):
        """Mirror the receiver queue into the Decky queue model.

        Cast is authoritative while a phone is connected. Keeping this mirror
        lets the normal Queue tab, ratings, and playback state refer to the same
        list instead of maintaining two unrelated queues.
        """
        try:
            self.queue = [dict(t) for t in (tracks or []) if t.get("videoId")]
            self.queue_position = max(0, min(int(position), len(self.queue) - 1)) if self.queue else 0
            self.is_playing = bool(self.queue) and self.is_playing
            self.shuffle_order = []
            return {"success": True, "queue_length": len(self.queue)}
        except Exception as e:
            decky.logger.error(f"Failed to sync Cast queue: {e}")
            return {"error": str(e)}

    async def get_queue(self):
        return {
            "tracks": self.queue,
            "position": self.queue_position,
        }

    async def edit_queue(self, index, action, expected_ids):
        # Reject stale UI selections, including duplicate songs at different positions.
        if expected_ids != [t.get("videoId") for t in self.queue]:
            return {"error": "Queue changed. Please try again."}
        if type(index) is not int or not 0 <= index < len(self.queue):
            return {"error": "Invalid queue position"}
        current = self.queue_position
        if action == "next":
            if index == current:
                return {"error": "This song is already playing"}
            target = current if index < current else current + 1
        elif action in ("up", "down"):
            target = index + (-1 if action == "up" else 1)
        else:
            return {"error": "Invalid queue action"}
        if not 0 <= target < len(self.queue):
            return {"error": "Already at the edge of the queue"}
        order = list(range(len(self.queue)))
        order.insert(target, order.pop(index))
        self.queue = [self.queue[i] for i in order]
        self.queue_position = order.index(current)
        if self.shuffle:
            old_shuffle = self.shuffle_order or list(range(len(order)))
            self.shuffle_order = [order.index(i) for i in old_shuffle]
            if action == "next":
                self.shuffle_order.remove(target)
                self.shuffle_order.insert(self.shuffle_order.index(self.queue_position) + 1, target)
        # Play next must also take precedence over Repeat One.
        if action == "next" and self.repeat == "ONE":
            self.repeat = "NONE"
        return {"success": True, "tracks": self.queue, "position": self.queue_position, "repeat": self.repeat}

    async def remove_from_queue(self, index):
        if index < 0 or index >= len(self.queue):
            return {"error": "Invalid index"}

        self.queue.pop(index)

        if index < self.queue_position:
            self.queue_position -= 1
        elif index == self.queue_position:
            if self.queue_position >= len(self.queue):
                self.queue_position = max(0, len(self.queue) - 1)

        if self.shuffle and self.queue:
            self.shuffle_order = list(range(len(self.queue)))
            random.shuffle(self.shuffle_order)
            if self.queue_position in self.shuffle_order:
                self.shuffle_order.remove(self.queue_position)
                self.shuffle_order.insert(0, self.queue_position)

        return {"success": True, "queue_length": len(self.queue)}

    async def jump_to_queue(self, index):
        if index < 0 or index >= len(self.queue):
            return {"error": "Invalid index"}

        self.queue_position = index
        result = self._current_track_with_url()
        if result is None or result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    # ── Library ─────────────────────────────────────────────────────

    _cached_playlists = None

    async def get_library_playlists(self, refresh=False):
        if not self.ytmusic:
            return {"error": "Not authenticated"}
        if self._cached_playlists and not refresh:
            return {"playlists": self._cached_playlists}
        try:
            playlists = self.ytmusic.get_library_playlists(limit=None)
            result = []
            # Liked Songs first
            result.append({
                "playlistId": "LM",
                "title": "Liked Songs",
                "count": None,
                "thumbnail": None,
            })
            for p in playlists:
                pid = p.get("playlistId", "")
                if pid == "LM":
                    continue
                thumbnails = p.get("thumbnails", [])
                thumb = thumbnails[0]["url"] if thumbnails else None
                result.append({
                    "playlistId": pid,
                    "title": p.get("title", "Unknown Playlist"),
                    "count": p.get("count"),
                    "thumbnail": thumb,
                })
            self._cached_playlists = result
            return {"playlists": result}
        except Exception as e:
            decky.logger.error(f"Failed to get library playlists: {e}")
            error_msg = str(e)
            if "Sign in" in error_msg or "sign in" in error_msg or "twoColumnBrowseResultsRenderer" in error_msg:
                return {"error": "Session expired. Please re-authenticate with fresh browser headers in Settings."}
            return {"error": error_msg}

    # ── Search ─────────────────────────────────────────────────────

    async def search_songs(self, query):
        if not self.ytmusic:
            return {"error": "Not authenticated"}
        try:
            results = self.ytmusic.search(query, filter="songs", limit=20)
            songs = []
            for r in results:
                thumbnails = r.get("thumbnails", [])
                album_art = thumbnails[-1]["url"] if thumbnails else ""
                artists = r.get("artists", [])
                artist_name = ", ".join(a.get("name", "") for a in artists) if artists else ""
                songs.append({
                    "videoId": r.get("videoId", ""),
                    "title": r.get("title", "Unknown"),
                    "artist": artist_name,
                    "albumArt": album_art,
                    "duration": r.get("duration", ""),
                })
            return {"results": [s for s in songs if s["videoId"]]}
        except Exception as e:
            decky.logger.error(f"Search failed: {e}")
            return {"error": str(e)}

    async def queue_song_next(self, metadata):
        if not self.ytmusic:
            return {"error": "Not authenticated"}
        if not isinstance(metadata, dict) or not metadata.get('videoId'):
            return {"error": "No song selected"}
        duration = 0
        try:
            for part in str(metadata.get('duration') or '0').split(':'):
                duration = duration * 60 + int(part)
        except ValueError:
            duration = 0
        track = {key: str(metadata.get(key) or '') for key in ('videoId', 'title', 'artist', 'albumArt')}
        track.update(album='', duration=duration, likeStatus='INDIFFERENT')
        if not self.queue:
            self.queue_position = 0
            self.shuffle_order = []
        index = self.queue_position + 1 if self.queue else 0
        self.queue.insert(index, track)
        if self.shuffle:
            order = [i + 1 if i >= index else i for i in self.shuffle_order]
            if not order:
                order = [i for i in range(len(self.queue)) if i != index]
            slot = order.index(self.queue_position) + 1 if self.queue_position in order else 0
            order.insert(slot, index)
            self.shuffle_order = order
        if self.repeat == 'ONE':
            self.repeat = 'NONE'
        return {"success": True}

    async def play_song(self, video_id, metadata=None):
        """Play the selected video directly; radio is a separate operation."""
        if not self.ytmusic:
            return {"error": "Not authenticated"}
        if not isinstance(video_id, str) or not video_id.strip():
            return {"error": "No song selected"}
        metadata = metadata if isinstance(metadata, dict) else {}
        duration = 0
        try:
            for part in str(metadata.get("duration") or "0").split(":"):
                duration = duration * 60 + int(part)
        except (ValueError, TypeError):
            duration = 0
        track = {
            "videoId": video_id,
            "title": metadata.get("title") or "Unknown",
            "artist": metadata.get("artist") or "",
            "album": "",
            "albumArt": metadata.get("albumArt") or "",
            "duration": duration,
            "likeStatus": "INDIFFERENT",
        }
        try:
            url = self._get_streaming_url(video_id)
            if not url:
                return {"error": "YouTube did not provide an audio stream for this song. Please try again in a moment."}
            self.queue = [track]
            self.queue_position = 0
            self.shuffle_order = [0] if self.shuffle else []
            self.is_playing = True
            return {**track, "url": url, "queuePosition": 0, "queueLength": 1}
        except Exception as e:
            decky.logger.error(f"Failed to play song {video_id}: {e}")
            return {"error": "Could not load audio for this song. Please try again."}

    async def play_song_radio(self, video_id):
        """Build a radio queue for a song.

        YouTube/ytmusicapi occasionally changes the Mix response and older
        ytmusicapi versions can raise KeyError("endpoint"). Treat that as a
        recoverable radio failure: fall back to the selected song instead of
        crashing the Decky command.
        """
        if not self.ytmusic:
            return {"error": "Not authenticated"}
        try:
            self.is_playing = False
            tracks = []
            radio_error = None
            try:
                watch = self.ytmusic.get_watch_playlist(videoId=video_id, radio=True)
                tracks = watch.get("tracks", []) or []
            except Exception as e:
                radio_error = str(e)
                if "endpoint" not in radio_error.lower():
                    raise
                decky.logger.warning(f"Radio endpoint is unavailable for {video_id}; falling back to single-track playback")

            # If radio failed because YouTube changed the endpoint shape, fetch
            # the selected song directly. This preserves playback even when Mix
            # generation is temporarily broken.
            # Always have a metadata fallback for the exact search result.
            if not tracks or not any(t.get("videoId") == video_id for t in tracks if isinstance(t, dict)):
                try:
                    details = self.ytmusic.get_song(video_id).get("videoDetails", {})
                    song = {
                        "videoId": details.get("videoId") or video_id,
                        "title": details.get("title", "Unknown"),
                        "uploader": details.get("author", ""),
                        "thumbnails": (details.get("thumbnail") or {}).get("thumbnails", []),
                        "duration_seconds": int(details.get("lengthSeconds") or 0),
                    }
                except Exception as e:
                    decky.logger.warning(f"Direct get_song failed for {video_id}: {e}")
                    song = None
                if song:
                    if tracks:
                        tracks = [song] + [t for t in tracks if t.get("videoId") != video_id]
                    else:
                        tracks = [song]

            if not tracks:
                return {"error": "Could not load this song. YouTube's radio endpoint is currently unavailable." if radio_error else "No playable tracks found"}

            queue = []
            for t in tracks:
                thumbnails = t.get("thumbnail", []) or t.get("thumbnails", [])
                album_art = thumbnails[-1].get("url", "") if thumbnails else ""
                artists = t.get("artists", []) or []
                artist_name = ", ".join(a.get("name", "") for a in artists) if artists else t.get("uploader", "")
                album = t.get("album") or {}
                album_name = album.get("name", "") if isinstance(album, dict) else ""
                duration_seconds = t.get("duration_seconds", 0) or 0
                duration_str = t.get("length", "") or t.get("duration", "0:00")
                if not duration_seconds and isinstance(duration_str, str):
                    try:
                        parts = duration_str.split(":")
                        if len(parts) == 2: duration_seconds = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3: duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                    except (ValueError, TypeError):
                        duration_seconds = 0
                queue.append({
                    "videoId": t.get("videoId", "") or t.get("videoId", ""),
                    "title": t.get("title", "Unknown"),
                    "artist": artist_name,
                    "album": album_name,
                    "albumArt": album_art,
                    "duration": duration_seconds,
                    "likeStatus": t.get("likeStatus", "INDIFFERENT"),
                })

            self.queue = [t for t in queue if t["videoId"]]
            if not self.queue:
                return {"error": "No playable tracks found"}

            # Selected song first whenever radio returned a larger queue.
            for i, t in enumerate(self.queue):
                if t["videoId"] == video_id:
                    if i != 0: self.queue.insert(0, self.queue.pop(i))
                    break

            self.queue_position = 0
            self.shuffle_order = list(range(len(self.queue))) if self.shuffle else []
            if self.shuffle_order:
                random.shuffle(self.shuffle_order)
                self.shuffle_order.remove(0)
                self.shuffle_order.insert(0, 0)

            result = self._current_track_with_url()
            if result is None or not result.get("url"):
                return {"error": "YouTube did not provide an audio stream for this song. Please try again in a moment."}
            self.is_playing = True
            return result
        except Exception as e:
            decky.logger.error(f"Failed to start song radio for {video_id}: {e}")
            msg = str(e)
            if "endpoint" in msg.lower():
                return {"error": "YouTube changed its radio response. The selected song could not be queued automatically; try again after updating the plugin."}
            if "Sign in" in msg or "sign in" in msg:
                return {"error": "Session expired. Please re-authenticate with fresh browser headers in Settings."}
            return {"error": msg}

    async def get_lyrics(self, video_id, metadata=None):
        if not isinstance(video_id, str) or not video_id.strip():
            return {"error": "No song selected"}
        from ytm_lyrics import LyricsResolver
        if not hasattr(self, '_lyrics_resolver'):
            self._lyrics_resolver = LyricsResolver()
        # Network calls run off Decky's event loop, on an isolated anonymous client.
        return await asyncio.to_thread(self._lyrics_resolver.resolve, video_id, metadata)

    async def stop_all(self):
        self.queue = []
        self.queue_position = 0
        self.shuffle_order = []
        self.is_playing = False
        return {"success": True}

    # ── Playlist loading ─────────────────────────────────────────────

    async def load_playlist(self, playlist_id):
        if not self.ytmusic:
            return {"error": "Not authenticated"}

        try:
            self.is_playing = False  # stop old playback state before rebuilding queue

            if playlist_id == "LM":
                playlist_data = self.ytmusic.get_liked_songs(limit=50)
            else:
                playlist_data = self.ytmusic.get_playlist(playlist_id, limit=50)

            tracks = playlist_data.get("tracks", [])
            if not tracks:
                return {"error": "Playlist is empty. If this is Liked Songs, try re-authenticating with fresh browser headers."}

            self.queue = []
            for t in tracks:
                thumbnails = t.get("thumbnails", [])
                album_art = thumbnails[-1]["url"] if thumbnails else ""

                artists = t.get("artists", [])
                artist_name = ", ".join(a.get("name", "") for a in artists) if artists else ""

                album = t.get("album")
                album_name = album.get("name", "") if album else ""

                duration_seconds = t.get("duration_seconds", 0)
                if not duration_seconds:
                    duration_str = t.get("duration", "0:00")
                    parts = duration_str.split(":")
                    try:
                        if len(parts) == 2:
                            duration_seconds = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3:
                            duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                    except ValueError:
                        duration_seconds = 0

                self.queue.append({
                    "videoId": t.get("videoId", ""),
                    "title": t.get("title", "Unknown"),
                    "artist": artist_name,
                    "album": album_name,
                    "albumArt": album_art,
                    "duration": duration_seconds,
                    "likeStatus": t.get("likeStatus", "INDIFFERENT"),
                })

            self.queue = [t for t in self.queue if t["videoId"]]

            if not self.queue:
                return {"error": "No playable tracks in playlist"}

            self.queue_position = 0

            if self.shuffle:
                self.shuffle_order = list(range(len(self.queue)))
                random.shuffle(self.shuffle_order)
                self.shuffle_order.remove(0)
                self.shuffle_order.insert(0, 0)
            else:
                self.shuffle_order = []

            result = self._current_track_with_url()
            if result is None or result.get("url") is None:
                return {"error": "Failed to get streaming URL for first track"}

            self.is_playing = True
            return result
        except Exception as e:
            decky.logger.error(f"Failed to load playlist {playlist_id}: {e}")
            error_msg = str(e)
            if "Sign in" in error_msg or "sign in" in error_msg or "twoColumnBrowseResultsRenderer" in error_msg:
                return {"error": "Session expired. Please re-authenticate with fresh browser headers in Settings."}
            return {"error": error_msg}
