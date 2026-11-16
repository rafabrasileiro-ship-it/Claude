package com.rafa.brapocalipse;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * Ponte JavaScript ⇄ Android exposta ao jogo como "BRApp".
 *
 * Co-op local: o celular do Piloto abre um servidor TCP (porta 47820) e anuncia a sala por UDP broadcast
 * (porta 47821) uma vez por segundo. Os outros celulares escutam os anúncios, conectam por TCP e trocam
 * mensagens JSON, uma por linha. O jogo lê tudo o que chegou chamando poll() a cada quadro; cada linha
 * devolvida vem como "id do remetente" + TAB + mensagem (id 0 = o host, visto pelo cliente).
 */
public class Bridge {
    static final int TCP_PORT = 47820, UDP_PORT = 47821;
    private static final String SNAP_PREFIX = "{\"t\":\"s\"";

    private final Context ctx;
    private final ConcurrentLinkedQueue<String> inbox = new ConcurrentLinkedQueue<>();
    private final Map<Integer, Peer> peers = new ConcurrentHashMap<>();
    private volatile Peer hostLink;
    private volatile ServerSocket server;
    private volatile boolean hosting, scanning;
    private volatile DatagramSocket scanSock;
    private volatile String roomName = "";
    private WifiManager.MulticastLock mlock;
    private int nextId = 1;

    Bridge(Context c) { ctx = c.getApplicationContext(); }

    /* ------------------------------------------------------------ tela */

    /** Margens seguras do furo da câmera, em px CSS: "esquerda,topo,direita,base". */
    private volatile String insets = "0,0,0,0";

    void setInsets(float l, float t, float r, float b) {
        insets = Math.round(l) + "," + Math.round(t) + "," + Math.round(r) + "," + Math.round(b);
    }

    @JavascriptInterface
    public String insets() { return insets; }

    /* ------------------------------------------------------------ vibração */

    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public void vibrate(String json) {
        try {
            Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            String s = json == null ? "" : json.trim();
            if (s.startsWith("[")) {
                JSONArray a = new JSONArray(s);
                long[] p = new long[a.length() + 1];   // padrão web começa vibrando; o do Android começa com uma pausa
                for (int i = 0; i < a.length(); i++) p[i + 1] = Math.max(0, Math.min(1000, a.getLong(i)));
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(p, -1)); else v.vibrate(p, -1);
            } else {
                long ms = Math.max(1, Math.min(1000, (long) Double.parseDouble(s)));
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)); else v.vibrate(ms);
            }
        } catch (Exception ignored) { }
    }

    /* ------------------------------------------------------------ host */

    @JavascriptInterface
    public boolean host(String name) {
        stop();
        roomName = name == null ? "" : name.replace('|', ' ').replace('\n', ' ');
        try {
            ServerSocket ss = new ServerSocket();
            ss.setReuseAddress(true);
            ss.bind(new InetSocketAddress(TCP_PORT));
            server = ss;
        } catch (IOException e) {
            return false;
        }
        hosting = true;
        Thread acc = new Thread(() -> {
            ServerSocket ss = server;
            while (hosting && ss != null) {
                try {
                    Socket s = ss.accept();
                    s.setTcpNoDelay(true);
                    s.setKeepAlive(true);
                    int id;
                    synchronized (this) { id = nextId++; }
                    Peer p = new Peer(id, s);
                    peers.put(id, p);
                    inbox.add(id + "\t{\"t\":\"_join\"}");
                    p.start();
                } catch (IOException e) {
                    if (!hosting) break;
                }
            }
        }, "br-accept");
        acc.setDaemon(true);
        acc.start();
        Thread beacon = new Thread(this::beaconLoop, "br-beacon");
        beacon.setDaemon(true);
        beacon.start();
        return true;
    }

    private void beaconLoop() {
        DatagramSocket ds = null;
        try {
            ds = new DatagramSocket();
            ds.setBroadcast(true);
            while (hosting) {
                byte[] msg = ("BRAPOC|" + roomName + "|" + TCP_PORT).getBytes(StandardCharsets.UTF_8);
                for (InetAddress b : broadcastAddrs()) {
                    try { ds.send(new DatagramPacket(msg, msg.length, b, UDP_PORT)); } catch (IOException ignored) { }
                }
                try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
            }
        } catch (IOException ignored) {
        } finally {
            if (ds != null) ds.close();
        }
    }

    private List<InetAddress> broadcastAddrs() {
        List<InetAddress> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !out.contains(b)) out.add(b);
                }
            }
        } catch (Exception ignored) { }
        try {
            InetAddress all = InetAddress.getByAddress(new byte[]{(byte) 255, (byte) 255, (byte) 255, (byte) 255});
            if (!out.contains(all)) out.add(all);
        } catch (Exception ignored) { }
        return out;
    }

    /* ------------------------------------------------------------ cliente */

    @JavascriptInterface
    public void scan(boolean on) {
        scanning = on;
        if (!on) {
            DatagramSocket s = scanSock;
            scanSock = null;
            if (s != null) s.close();
            releaseLock();
            return;
        }
        if (scanSock != null) return;
        acquireLock();
        Thread t = new Thread(() -> {
            DatagramSocket ds = null;
            try {
                ds = new DatagramSocket(null);
                ds.setReuseAddress(true);
                ds.setBroadcast(true);
                ds.bind(new InetSocketAddress(UDP_PORT));
                scanSock = ds;
                byte[] buf = new byte[512];
                while (scanning) {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    ds.receive(p);
                    String s = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
                    if (!s.startsWith("BRAPOC|")) continue;
                    String[] f = s.split("\\|", -1);
                    String ip = p.getAddress().getHostAddress();
                    inbox.add("0\t{\"t\":\"_host\",\"ip\":" + JSONObject.quote(ip) + ",\"name\":" + JSONObject.quote(f.length > 1 ? f[1] : "") + "}");
                }
            } catch (IOException ignored) {
            } finally {
                if (ds != null) ds.close();
                if (scanSock == ds) scanSock = null;
            }
        }, "br-scan");
        t.setDaemon(true);
        t.start();
    }

    @JavascriptInterface
    public void join(String ip) {
        Peer old = hostLink;
        if (old != null) old.close(false);
        final String addr = ip == null ? "" : ip.trim();
        Thread t = new Thread(() -> {
            try {
                Socket s = new Socket();
                s.connect(new InetSocketAddress(addr, TCP_PORT), 5000);
                s.setTcpNoDelay(true);
                s.setKeepAlive(true);
                Peer p = new Peer(0, s);
                hostLink = p;
                inbox.add("0\t{\"t\":\"_conn\"}");
                p.start();
            } catch (Exception e) {
                inbox.add("0\t{\"t\":\"_fail\"}");
            }
        }, "br-join");
        t.setDaemon(true);
        t.start();
    }

    /* ------------------------------------------------------------ mensagens */

    @JavascriptInterface
    public void send(String msg) { Peer h = hostLink; if (h != null) h.send(msg); }

    @JavascriptInterface
    public void sendTo(int id, String msg) { Peer p = peers.get(id); if (p != null) p.send(msg); }

    @JavascriptInterface
    public void broadcast(String msg) { for (Peer p : peers.values()) p.send(msg); }

    @JavascriptInterface
    public void kick(int id) { Peer p = peers.remove(id); if (p != null) p.finish(); }

    @JavascriptInterface
    public String poll() {
        StringBuilder sb = new StringBuilder();
        String s;
        while ((s = inbox.poll()) != null) {
            if (sb.length() > 0) sb.append('\n');
            sb.append(s);
        }
        return sb.toString();
    }

    @JavascriptInterface
    public void stop() {
        hosting = false;
        ServerSocket ss = server;
        server = null;
        if (ss != null) try { ss.close(); } catch (IOException ignored) { }
        for (Peer p : peers.values()) p.finish();   // envia o que falta (ex.: "o Piloto fechou a sala") e fecha
        peers.clear();
        Peer h = hostLink;
        hostLink = null;
        if (h != null) h.finish();
        scan(false);
        inbox.clear();
    }

    @JavascriptInterface
    public String myIp() {
        String best = "", any = "";
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String n = ni.getName(), ip = a.getHostAddress();
                    if (any.isEmpty()) any = ip;
                    if (!a.isSiteLocalAddress()) continue;
                    if (n.startsWith("wlan") || n.startsWith("ap") || n.startsWith("swlan")) return ip;
                    if (best.isEmpty()) best = ip;
                }
            }
        } catch (Exception ignored) { }
        return best.isEmpty() ? any : best;
    }

    private void acquireLock() {
        try {
            if (mlock == null) {
                WifiManager wm = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
                if (wm == null) return;
                mlock = wm.createMulticastLock("brapocalipse");
                mlock.setReferenceCounted(false);
            }
            mlock.acquire();
        } catch (Exception ignored) { }
    }

    private void releaseLock() {
        try { if (mlock != null && mlock.isHeld()) mlock.release(); } catch (Exception ignored) { }
    }

    /* ------------------------------------------------------------ conexão TCP */

    private static final String FIN = new String("\u0000fim");

    private class Peer {
        final int id;
        final Socket sock;
        final LinkedBlockingQueue<String> out = new LinkedBlockingQueue<>();
        private boolean alive = true, quiet = false;

        Peer(int id, Socket s) { this.id = id; sock = s; }

        void start() {
            Thread r = new Thread(() -> {
                try {
                    BufferedReader in = new BufferedReader(new InputStreamReader(sock.getInputStream(), StandardCharsets.UTF_8));
                    String line;
                    while ((line = in.readLine()) != null) {
                        if (!line.isEmpty()) inbox.add(id + "\t" + line);
                    }
                } catch (IOException ignored) { }
                close(true);
            }, "br-rd-" + id);
            Thread w = new Thread(() -> {
                try {
                    Writer wr = new BufferedWriter(new OutputStreamWriter(sock.getOutputStream(), StandardCharsets.UTF_8));
                    while (true) {
                        String m = out.take();
                        if (m == FIN) { wr.flush(); break; }
                        if (!isAlive()) break;
                        wr.write(m);
                        wr.write('\n');
                        if (out.isEmpty()) wr.flush();
                    }
                } catch (Exception ignored) { }
                close(true);
            }, "br-wr-" + id);
            r.setDaemon(true);
            w.setDaemon(true);
            r.start();
            w.start();
        }

        synchronized boolean isAlive() { return alive; }

        void send(String m) {
            if (!isAlive() || m == null) return;
            if (out.size() > 90) {   // celular lento ou em segundo plano: descarta snapshots velhos, mantém o resto
                Iterator<String> it = out.iterator();
                while (it.hasNext()) if (it.next().startsWith(SNAP_PREFIX)) it.remove();
            }
            out.offer(m);
        }

        /** Encerramento pedido por este celular: esvazia a fila de envio, fecha e não avisa o jogo. */
        void finish() {
            synchronized (this) {
                if (!alive) return;
                quiet = true;
            }
            out.offer(FIN);
            Thread t = new Thread(() -> {   // rede travada: fecha mesmo assim depois de 1 s
                try { Thread.sleep(1000); } catch (InterruptedException ignored) { }
                close(false);
            }, "br-fin-" + id);
            t.setDaemon(true);
            t.start();
        }

        void close(boolean notify) {
            synchronized (this) {
                if (!alive) return;
                alive = false;
                if (quiet) notify = false;
            }
            try { sock.close(); } catch (IOException ignored) { }
            out.offer("");   // destrava a thread de escrita
            if (id != 0) peers.remove(id); else if (hostLink == this) hostLink = null;
            if (notify) inbox.add(id + "\t{\"t\":\"_bye\"}");
        }
    }
}
