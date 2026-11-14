package com.rafa.combate;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Servidor do Combate (porte do server.js): HTTP + SSE, sem dependências além de org.json. */
public final class GameServer {
    public interface Assets { byte[] read(String name) throws IOException; }

    static final int N = 10;
    // quantidade por patente (índice = patente): 0 bandeira ... 10 marechal, 11 bomba
    static final int[] COUNTS = {1, 1, 8, 5, 4, 4, 4, 3, 2, 1, 1, 6};

    static final class HttpErr extends RuntimeException {
        final int status;
        HttpErr(int status, String msg) { super(msg); this.status = status; }
    }
    static final class Piece {
        final int id, owner, rank; boolean known;
        Piece(int id, int owner, int rank) { this.id = id; this.owner = owner; this.rank = rank; }
    }
    static final class Hist {
        final int id; final int[] from, to;
        Hist(int id, int[] from, int[] to) { this.id = id; this.from = from; this.to = to; }
    }
    static final class Battle {
        int seq, attacker, att, def; int[] from, to; String result;
    }
    static final class Client {
        final OutputStream out;
        Client(OutputStream out) { this.out = out; }
        synchronized boolean write(String s) {
            try { out.write(s.getBytes(StandardCharsets.UTF_8)); out.flush(); return true; }
            catch (IOException e) { return false; }
        }
    }
    static final class Player {
        final String token; final Set<Client> clients = new HashSet<>(); boolean ready, rematch;
        Player(String token) { this.token = token; }
    }
    static final class Room {
        final String code; final Player[] players = new Player[2];
        String phase = "waiting"; int first = 0, seq = 0, turn, nextId;
        Piece[][] board; List<int[]>[] setup; List<Integer>[] lost; List<Hist>[] hist;
        Battle lastBattle; int[] lastMove; int winner = -1; String reason; long updated = System.currentTimeMillis();
        Room(String code) { this.code = code; }
    }

    private final Assets assets;
    private final int port;
    private final Object lock = new Object();
    private final Map<String, Room> rooms = new HashMap<>();
    private final SecureRandom rnd = new SecureRandom();
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private volatile ServerSocket server;
    private volatile boolean running;

    public GameServer(int port, Assets assets) { this.port = port; this.assets = assets; }

    public void start() throws IOException {
        server = new ServerSocket(port);
        running = true;
        Thread t = new Thread(() -> {
            while (running) {
                try { final Socket s = server.accept(); pool.execute(() -> handle(s)); }
                catch (IOException e) { if (!running) return; }
            }
        }, "combate-accept");
        t.setDaemon(true); t.start();
        Thread ping = new Thread(() -> {
            while (running) {
                try { Thread.sleep(20000); } catch (InterruptedException e) { return; }
                synchronized (lock) {
                    long now = System.currentTimeMillis();
                    rooms.values().removeIf(r -> now - r.updated > 4 * 3600 * 1000L);
                    for (Room r : rooms.values()) for (Player p : r.players) if (p != null) {
                        for (java.util.Iterator<Client> it = p.clients.iterator(); it.hasNext();) {
                            if (!it.next().write(": ping\n\n")) it.remove();
                        }
                    }
                }
            }
        }, "combate-ping");
        ping.setDaemon(true); ping.start();
    }

    public void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (IOException ignored) { }
        pool.shutdownNow();
    }

    public int port() { return port; }

    public static List<String> lanIps() {
        List<String> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && !a.isLoopbackAddress()) out.add(a.getHostAddress());
                }
            }
        } catch (Exception ignored) { }
        return out;
    }

    // ---------- regras ----------
    static boolean inb(int r, int c) { return r >= 0 && r < N && c >= 0 && c < N; }
    static boolean lake(int r, int c) { return (r == 4 || r == 5) && (c == 2 || c == 3 || c == 6 || c == 7); }
    static int[] flip(int p, int r, int c) { return p == 0 ? new int[]{r, c} : new int[]{N - 1 - r, N - 1 - c}; }
    static boolean same(int[] a, int[] b) { return a[0] == b[0] && a[1] == b[1]; }

    @SuppressWarnings("unchecked")
    private void resetGame(Room room) {
        room.board = null;
        room.setup = new List[]{null, null};
        room.turn = room.first;
        room.lost = new List[]{new ArrayList<Integer>(), new ArrayList<Integer>()};
        room.hist = new List[]{new ArrayList<Hist>(), new ArrayList<Hist>()};
        room.lastBattle = null; room.lastMove = null; room.winner = -1; room.reason = null; room.nextId = 1;
        for (Player p : room.players) if (p != null) { p.ready = false; p.rematch = false; }
    }

    private String token() {
        byte[] b = new byte[12]; rnd.nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private boolean validSetup(JSONArray pl) {
        if (pl == null || pl.length() != 40) return false;
        Set<Integer> seen = new HashSet<>();
        int[] cnt = new int[12];
        for (int i = 0; i < 40; i++) {
            JSONObject x = pl.optJSONObject(i);
            if (x == null || !x.has("r") || !x.has("c") || !x.has("rank")) return false;
            int r = x.optInt("r", -1), c = x.optInt("c", -1), rank = x.optInt("rank", -1);
            if (r < 6 || r > 9 || c < 0 || c > 9 || rank < 0 || rank > 11) return false;
            if (!seen.add(r * 10 + c)) return false;
            cnt[rank]++;
        }
        for (int k = 0; k < 12; k++) if (cnt[k] != COUNTS[k]) return false;
        return true;
    }

    private void startGame(Room room) {
        room.board = new Piece[N][N];
        for (int p = 0; p < 2; p++) for (int[] x : room.setup[p]) {
            room.board[x[0]][x[1]] = new Piece(room.nextId++, p, x[2]);
        }
        room.phase = "play"; room.turn = room.first;
    }

    private boolean violatesRepeat(Room room, Piece pc, int[] from, int[] to) {
        List<Hist> h = room.hist[pc.owner];
        if (h.size() < 3) return false;
        Hist a = h.get(h.size() - 3), b = h.get(h.size() - 2), c = h.get(h.size() - 1);
        if (a.id != pc.id || b.id != pc.id || c.id != pc.id) return false;
        return same(c.to, from) && same(c.from, to) && same(b.to, c.from) && same(b.from, c.to)
                && same(a.to, b.from) && same(a.from, b.to);
    }

    private List<int[]> pieceMoves(Room room, int r, int c) {
        List<int[]> out = new ArrayList<>();
        Piece pc = room.board[r][c];
        if (pc == null || pc.rank == 0 || pc.rank == 11) return out;
        int[][] dirs = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
        for (int[] d : dirs) {
            int rr = r + d[0], cc = c + d[1];
            while (inb(rr, cc) && !lake(rr, cc)) {
                Piece t = room.board[rr][cc];
                if (t != null) { if (t.owner != pc.owner) add(room, pc, out, r, c, rr, cc); break; }
                add(room, pc, out, r, c, rr, cc);
                if (pc.rank != 2) break; // só o soldado anda várias casas
                rr += d[0]; cc += d[1];
            }
        }
        return out;
    }
    private void add(Room room, Piece pc, List<int[]> out, int r, int c, int rr, int cc) {
        if (!violatesRepeat(room, pc, new int[]{r, c}, new int[]{rr, cc})) out.add(new int[]{rr, cc});
    }

    private boolean hasMoves(Room room, int p) {
        for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) {
            Piece pc = room.board[r][c];
            if (pc != null && pc.owner == p && !pieceMoves(room, r, c).isEmpty()) return true;
        }
        return false;
    }

    private void finish(Room room, int winner, String reason) {
        room.phase = "over"; room.winner = winner; room.reason = reason;
    }

    @SuppressWarnings("unchecked")
    private void doMove(Room room, int p, int[] from, int[] to) {
        if (!room.phase.equals("play")) throw new HttpErr(400, "A partida não está em andamento");
        if (room.turn != p) throw new HttpErr(400, "Não é a sua vez");
        int fr = from[0], fc = from[1], tr = to[0], tc = to[1];
        if (!inb(fr, fc) || !inb(tr, tc)) throw new HttpErr(400, "Movimento inválido");
        Piece att = room.board[fr][fc];
        if (att == null || att.owner != p) throw new HttpErr(400, "Peça inválida");
        boolean ok = false;
        for (int[] m : pieceMoves(room, fr, fc)) if (m[0] == tr && m[1] == tc) ok = true;
        if (!ok) throw new HttpErr(400, "Movimento não permitido");
        Piece def = room.board[tr][tc];
        room.lastMove = new int[]{fr, fc, tr, tc};
        if (def == null) {
            room.board[fr][fc] = null; room.board[tr][tc] = att;
            List<Hist> h = room.hist[p];
            h.add(new Hist(att.id, new int[]{fr, fc}, new int[]{tr, tc}));
            if (h.size() > 6) h.remove(0);
            if (Math.abs(fr - tr) + Math.abs(fc - tc) > 1) att.known = true; // soldado se revela
        } else {
            room.hist = new List[]{new ArrayList<Hist>(), new ArrayList<Hist>()};
            String result;
            if (def.rank == 0) result = "att";
            else if (def.rank == 11) result = att.rank == 3 ? "att" : "def";
            else if (att.rank == 1 && def.rank == 10) result = "att";
            else if (att.rank > def.rank) result = "att";
            else if (att.rank == def.rank) result = "both";
            else result = "def";
            room.board[fr][fc] = null;
            if (result.equals("att")) {
                room.board[tr][tc] = att; att.known = true; room.lost[def.owner].add(def.rank);
            } else if (result.equals("def")) {
                def.known = true; room.lost[p].add(att.rank);
            } else {
                room.board[tr][tc] = null; room.lost[def.owner].add(def.rank); room.lost[p].add(att.rank);
            }
            Battle b = new Battle();
            b.seq = ++room.seq; b.attacker = p; b.att = att.rank; b.def = def.rank;
            b.from = new int[]{fr, fc}; b.to = new int[]{tr, tc}; b.result = result;
            room.lastBattle = b;
            if (def.rank == 0) { finish(room, p, "flag"); return; }
        }
        room.turn = 1 - p;
        if (!hasMoves(room, room.turn)) finish(room, p, "nomoves");
    }

    private static JSONArray pt(int[] v) { return new JSONArray().put(v[0]).put(v[1]); }

    private JSONObject view(Room room, int p) throws Exception {
        int q = 1 - p; boolean over = room.phase.equals("over");
        JSONObject[][] board = new JSONObject[N][N];
        if (room.board != null) {
            for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) {
                Piece pc = room.board[r][c];
                if (pc == null) continue;
                boolean mine = pc.owner == p;
                JSONObject cell = new JSONObject().put("o", mine ? 1 : 0);
                if (mine || pc.known || over) cell.put("r", pc.rank).put("k", pc.known ? 1 : 0);
                int[] v = flip(p, r, c); board[v[0]][v[1]] = cell;
            }
        } else if (room.setup[p] != null) {
            for (int[] x : room.setup[p]) {
                int[] v = flip(p, x[0], x[1]);
                board[v[0]][v[1]] = new JSONObject().put("o", 1).put("r", x[2]).put("k", 0);
            }
        }
        JSONArray rows = new JSONArray();
        for (int r = 0; r < N; r++) {
            JSONArray row = new JSONArray();
            for (int c = 0; c < N; c++) row.put(board[r][c] == null ? JSONObject.NULL : board[r][c]);
            rows.put(row);
        }
        Object moves = JSONObject.NULL;
        if (room.phase.equals("play") && room.turn == p) {
            JSONObject mv = new JSONObject();
            for (int r = 0; r < N; r++) for (int c = 0; c < N; c++) {
                Piece pc = room.board[r][c];
                if (pc == null || pc.owner != p) continue;
                List<int[]> m = pieceMoves(room, r, c);
                if (m.isEmpty()) continue;
                int[] v = flip(p, r, c); JSONArray arr = new JSONArray();
                for (int[] t : m) { int[] w = flip(p, t[0], t[1]); arr.put(pt(w)); }
                mv.put(v[0] + "," + v[1], arr);
            }
            moves = mv;
        }
        Player opp = room.players[q];
        JSONObject o = new JSONObject();
        o.put("code", room.code).put("you", p).put("phase", room.phase).put("turn", room.turn);
        o.put("meReady", room.players[p].ready);
        o.put("opp", new JSONObject().put("joined", opp != null)
                .put("connected", opp != null && !opp.clients.isEmpty())
                .put("ready", opp != null && opp.ready));
        o.put("board", rows).put("moves", moves);
        JSONArray lost = new JSONArray();
        for (int i = 0; i < 2; i++) lost.put(new JSONArray(room.lost[i]));
        o.put("lost", lost);
        o.put("winner", room.winner < 0 ? JSONObject.NULL : room.winner);
        o.put("reason", room.reason == null ? JSONObject.NULL : room.reason);
        if (room.lastMove == null) o.put("lastMove", JSONObject.NULL);
        else o.put("lastMove", new JSONObject()
                .put("from", pt(flip(p, room.lastMove[0], room.lastMove[1])))
                .put("to", pt(flip(p, room.lastMove[2], room.lastMove[3]))));
        Battle b = room.lastBattle;
        if (b == null) o.put("lastBattle", JSONObject.NULL);
        else o.put("lastBattle", new JSONObject().put("seq", b.seq).put("mine", b.attacker == p)
                .put("att", b.att).put("def", b.def).put("result", b.result)
                .put("from", pt(flip(p, b.from[0], b.from[1]))).put("to", pt(flip(p, b.to[0], b.to[1]))));
        o.put("rematch", new JSONObject().put("me", room.players[p].rematch)
                .put("opp", opp != null && opp.rematch));
        return o;
    }

    private void broadcast(Room room) {
        room.updated = System.currentTimeMillis();
        for (int i = 0; i < 2; i++) {
            Player pl = room.players[i];
            if (pl == null || pl.clients.isEmpty()) continue;
            String data;
            try { data = "event: state\ndata: " + view(room, i) + "\n\n"; } catch (Exception e) { continue; }
            for (java.util.Iterator<Client> it = pl.clients.iterator(); it.hasNext();) {
                if (!it.next().write(data)) it.remove();
            }
        }
    }

    // ---------- ações ----------
    private Room room(String code) {
        Room r = rooms.get(code == null ? "" : code);
        return r;
    }
    private int[] pair(JSONArray a) {
        if (a == null || a.length() != 2) throw new HttpErr(400, "Movimento inválido");
        return new int[]{a.optInt(0, -1), a.optInt(1, -1)};
    }

    private JSONObject action(String name, JSONObject b) throws Exception {
        synchronized (lock) {
            if (name.equals("create")) {
                String code;
                do { code = String.valueOf(1000 + rnd.nextInt(9000)); } while (rooms.containsKey(code));
                Room room = new Room(code);
                room.players[0] = new Player(token());
                resetGame(room); rooms.put(code, room);
                return new JSONObject().put("code", code).put("token", room.players[0].token);
            }
            if (name.equals("join")) {
                Room room = room(b.optString("code"));
                if (room == null) throw new HttpErr(404, "Sala não encontrada");
                if (room.players[1] != null) throw new HttpErr(409, "Esta sala já está cheia");
                room.players[1] = new Player(token());
                room.phase = "setup";
                broadcast(room);
                return new JSONObject().put("code", room.code).put("token", room.players[1].token);
            }
            Room room = room(b.optString("code"));
            int p = -1;
            if (room != null) for (int i = 0; i < 2; i++) {
                if (room.players[i] != null && room.players[i].token.equals(b.optString("token"))) p = i;
            }
            if (p < 0) throw new HttpErr(403, "Sessão inválida");
            switch (name) {
                case "ready": {
                    if (!room.phase.equals("setup")) throw new HttpErr(400, "Fase inválida");
                    JSONArray pl = b.optJSONArray("placement");
                    if (!validSetup(pl)) throw new HttpErr(400, "Posicionamento inválido");
                    List<int[]> list = new ArrayList<>();
                    for (int i = 0; i < 40; i++) {
                        JSONObject x = pl.getJSONObject(i);
                        int[] v = flip(p, x.getInt("r"), x.getInt("c"));
                        list.add(new int[]{v[0], v[1], x.getInt("rank")});
                    }
                    room.setup[p] = list; room.players[p].ready = true;
                    if (room.players[0].ready && room.players[1] != null && room.players[1].ready) startGame(room);
                    broadcast(room);
                    return new JSONObject();
                }
                case "move": {
                    int[] f = pair(b.optJSONArray("from")), t = pair(b.optJSONArray("to"));
                    int[] ff = flip(p, f[0], f[1]), tt = flip(p, t[0], t[1]);
                    doMove(room, p, ff, tt);
                    broadcast(room);
                    return new JSONObject();
                }
                case "resign": {
                    if (!room.phase.equals("play")) throw new HttpErr(400, "Nada para desistir");
                    finish(room, 1 - p, "resign"); broadcast(room);
                    return new JSONObject();
                }
                case "rematch": {
                    if (!room.phase.equals("over")) throw new HttpErr(400, "Fase inválida");
                    room.players[p].rematch = true;
                    if (room.players[0].rematch && room.players[1] != null && room.players[1].rematch) {
                        room.first = 1 - room.first; resetGame(room); room.phase = "setup";
                    }
                    broadcast(room);
                    return new JSONObject();
                }
                default: throw new HttpErr(404, "Ação desconhecida");
            }
        }
    }

    // ---------- HTTP ----------
    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        int ch;
        while ((ch = in.read()) != -1) {
            if (ch == '\n') break;
            if (ch != '\r') bo.write(ch);
            if (bo.size() > 8192) throw new IOException("linha grande demais");
        }
        if (ch == -1 && bo.size() == 0) return null;
        return new String(bo.toByteArray(), StandardCharsets.ISO_8859_1);
    }

    private static void respond(OutputStream out, int status, String type, byte[] data) throws IOException {
        String head = "HTTP/1.1 " + status + " " + (status == 200 ? "OK" : "Erro") + "\r\n"
                + "Content-Type: " + type + "\r\nContent-Length: " + data.length + "\r\n"
                + "Cache-Control: no-store\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.ISO_8859_1));
        out.write(data); out.flush();
    }
    private static void json(OutputStream out, int status, JSONObject o) throws IOException {
        respond(out, status, "application/json; charset=utf-8", o.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static Map<String, String> query(String q) {
        Map<String, String> m = new HashMap<>();
        if (q == null) return m;
        for (String kv : q.split("&")) {
            int i = kv.indexOf('=');
            try {
                if (i > 0) m.put(URLDecoder.decode(kv.substring(0, i), "UTF-8"), URLDecoder.decode(kv.substring(i + 1), "UTF-8"));
            } catch (Exception ignored) { }
        }
        return m;
    }

    private void handle(Socket s) {
        boolean keep = false;
        try {
            s.setTcpNoDelay(true);
            s.setSoTimeout(15000);
            InputStream in = s.getInputStream(); OutputStream out = s.getOutputStream();
            String line = readLine(in);
            if (line == null) return;
            String[] parts = line.split(" ");
            if (parts.length < 2) return;
            String method = parts[0], target = parts[1];
            int len = 0; String h;
            while ((h = readLine(in)) != null && !h.isEmpty()) {
                if (h.toLowerCase().startsWith("content-length:")) len = Integer.parseInt(h.substring(15).trim());
            }
            if (len > 20000) { json(out, 413, new JSONObject().put("error", "Pedido grande demais")); return; }
            byte[] body = new byte[len];
            for (int off = 0; off < len;) { int n = in.read(body, off, len - off); if (n < 0) return; off += n; }
            int qi = target.indexOf('?');
            String path = qi < 0 ? target : target.substring(0, qi);
            Map<String, String> q = query(qi < 0 ? null : target.substring(qi + 1));
            try {
                if (method.equals("GET") && path.equals("/api/events")) {
                    keep = events(s, in, out, q);
                } else if (method.equals("GET") && path.equals("/api/check")) {
                    boolean ok;
                    synchronized (lock) { ok = findPlayer(q.get("code"), q.get("token")) != null; }
                    json(out, ok ? 200 : 404, new JSONObject());
                } else if (method.equals("GET") && path.equals("/api/info")) {
                    JSONArray urls = new JSONArray();
                    for (String ip : lanIps()) urls.put("http://" + ip + ":" + port);
                    json(out, 200, new JSONObject().put("urls", urls));
                } else if (method.equals("POST") && path.startsWith("/api/")) {
                    JSONObject b = body.length == 0 ? new JSONObject() : new JSONObject(new String(body, StandardCharsets.UTF_8));
                    json(out, 200, action(path.substring(5), b));
                } else if (method.equals("GET")) {
                    String name = path.equals("/") ? "index.html" : path.substring(1);
                    byte[] data = null;
                    if (name.matches("[A-Za-z0-9_.\\-]+")) { try { data = assets.read(name); } catch (IOException ignored) { } }
                    if (data == null) respond(out, 404, "text/plain; charset=utf-8", "Não encontrado".getBytes(StandardCharsets.UTF_8));
                    else respond(out, 200, name.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream", data);
                } else {
                    respond(out, 405, "text/plain", new byte[0]);
                }
            } catch (HttpErr e) {
                json(out, e.status, new JSONObject().put("error", e.getMessage()));
            } catch (Exception e) {
                json(out, 400, new JSONObject().put("error", "Pedido inválido"));
            }
        } catch (Exception ignored) {
        } finally {
            if (!keep) try { s.close(); } catch (IOException ignored) { }
        }
    }

    private Player findPlayer(String code, String token) {
        Room r = rooms.get(code == null ? "" : code);
        if (r == null || token == null) return null;
        for (Player p : r.players) if (p != null && p.token.equals(token)) return p;
        return null;
    }

    /** Conexão SSE: fica aberta até o cliente fechar. */
    private boolean events(Socket s, InputStream in, OutputStream out, Map<String, String> q) throws Exception {
        Room room; int p = -1; Client cl = new Client(out);
        synchronized (lock) {
            room = rooms.get(q.get("code") == null ? "" : q.get("code"));
            if (room != null) for (int i = 0; i < 2; i++) {
                if (room.players[i] != null && room.players[i].token.equals(q.get("token"))) p = i;
            }
            if (p < 0) { json(out, 404, new JSONObject().put("error", "Sessão inválida")); return false; }
            String head = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache, no-transform\r\n"
                    + "Connection: keep-alive\r\nX-Accel-Buffering: no\r\n\r\nretry: 1500\n\n";
            cl.write(head);
            room.players[p].clients.add(cl);
            broadcast(room);
        }
        s.setSoTimeout(0);
        final Room fr = room; final int fp = p;
        try { while (in.read() != -1) { /* aguarda fechamento */ } } catch (IOException ignored) { }
        synchronized (lock) { fr.players[fp].clients.remove(cl); broadcast(fr); }
        try { s.close(); } catch (IOException ignored) { }
        return true;
    }
}
