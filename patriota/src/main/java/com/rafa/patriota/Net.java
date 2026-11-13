package com.rafa.patriota;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;

import java.io.Closeable;
import java.io.DataInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.*;
import java.util.Collections;
import java.util.Enumeration;
import java.util.concurrent.ConcurrentHashMap;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

/** Conexão Bluetooth (RFCOMM) entre dois celulares para o modo dupla. */
final class Net {
    static final UUID ID = UUID.fromString("5b1c2d9e-7a43-4f0e-9a52-0c6f1e4d7a21");
    static final int IDLE = 0, LISTENING = 1, CONNECTING = 2, CONNECTED = 3, FAILED = 4;

    volatile int state = IDLE;
    volatile String info = "";
    boolean host;

    private BluetoothServerSocket server;
    private Closeable sock;
    private ServerSocket tcpServer;
    private volatile boolean wifi;
    /** atualizações de estado por segundo (Wi-Fi aguenta 60; Bluetooth 30) */
    volatile int rate = 30;
    volatile int rtt = -1;
    static final int TCP_PORT = 47321, UDP_PORT = 47322;
    final ConcurrentHashMap<String, Object[]> found = new ConcurrentHashMap<>(); // ip -> {nome, ultimaVez}
    private DatagramSocket scanSock;
    private DataOutputStream out;
    private final Object lock = new Object();
    private final ConcurrentLinkedQueue<byte[]> outQ = new ConcurrentLinkedQueue<>();
    private volatile byte[] outSnap;
    private final ConcurrentLinkedQueue<byte[]> inbox = new ConcurrentLinkedQueue<>();
    private volatile byte[] inSnap;
    private volatile boolean closed;
    private int gen;

    static BluetoothAdapter adapter() {
        try { return BluetoothAdapter.getDefaultAdapter(); } catch (Exception e) { return null; }
    }

    static boolean supported() { return adapter() != null; }

    static boolean enabled() {
        try { BluetoothAdapter a = adapter(); return a != null && a.isEnabled(); } catch (Exception e) { return false; }
    }

    /** Aparelhos já pareados (o pareamento é feito nas configurações do Android). */
    @SuppressWarnings("MissingPermission")
    static ArrayList<BluetoothDevice> paired() {
        ArrayList<BluetoothDevice> l = new ArrayList<>();
        try {
            BluetoothAdapter a = adapter();
            if (a != null && a.isEnabled()) l.addAll(a.getBondedDevices());
        } catch (Exception ignored) { }
        return l;
    }

    @SuppressWarnings("MissingPermission")
    static String nameOf(BluetoothDevice d) {
        try { String n = d.getName(); return n != null && !n.isEmpty() ? n : d.getAddress(); } catch (Exception e) { return "?"; }
    }

    // ---------------------------------------------------------------- anfitrião
    @SuppressWarnings("MissingPermission")
    void listen() {
        close();
        closed = false; gen++; host = true; state = LISTENING; info = "";
        new Thread(() -> {
            try {
                BluetoothAdapter a = adapter();
                server = a.listenUsingInsecureRfcommWithServiceRecord("OperacaoPatriota", ID);
                BluetoothSocket s = server.accept();
                try { server.close(); } catch (Exception ignored) { }
                if (closed) { try { s.close(); } catch (Exception ignored) { } return; }
                attach(s);
            } catch (Exception e) {
                if (!closed) { state = FAILED; info = "Não foi possível abrir a sala."; }
            }
        }, "bt-accept").start();
    }

    // ---------------------------------------------------------------- convidado
    @SuppressWarnings("MissingPermission")
    void connect(BluetoothDevice d) {
        close();
        closed = false; gen++; host = false; state = CONNECTING; info = nameOf(d);
        new Thread(() -> {
            BluetoothSocket s = null;
            try {
                try { adapter().cancelDiscovery(); } catch (Exception ignored) { }
                s = d.createInsecureRfcommSocketToServiceRecord(ID);
                s.connect();
                if (closed) { s.close(); return; }
                attach(s);
            } catch (Exception e) {
                try { if (s != null) s.close(); } catch (Exception ignored) { }
                if (!closed) { state = FAILED; info = "Não conectou. O amigo já criou a sala?"; }
            }
        }, "bt-connect").start();
    }

    private void attach(BluetoothSocket s) throws IOException {
        rate = 30;
        attach(s, s.getInputStream(), s.getOutputStream());
    }

    private void attach(Closeable s, InputStream is, OutputStream os) throws IOException {
        sock = s; rtt = -1;
        out = new DataOutputStream(new java.io.BufferedOutputStream(os, 8192));
        final DataInputStream in = new DataInputStream(new java.io.BufferedInputStream(is, 8192));
        state = CONNECTED;
        new Thread(() -> {
            try {
                while (!closed) {
                    int len = in.readInt();
                    if (len <= 0 || len > 200000) throw new IOException("bad frame");
                    byte[] m = new byte[len];
                    in.readFully(m);
                    if (m[0] == Snap.M_SNAP) inSnap = m;
                    else if (m[0] == Snap.M_PING) { m[0] = Snap.M_PONG; outQ.add(m); wake(); }
                    else if (m[0] == Snap.M_PONG) { if (m.length >= 5) { int t = ((m[1] & 0xFF) << 24) | ((m[2] & 0xFF) << 16) | ((m[3] & 0xFF) << 8) | (m[4] & 0xFF); rtt = (int) (System.nanoTime() / 1000000L) - t; } }
                    else inbox.add(m);
                }
            } catch (Exception e) {
                if (!closed) { state = FAILED; info = "Conexão perdida."; }
                wake();
            }
        }, "bt-read").start();
        new Thread(() -> {
            try {
                while (!closed) {
                    byte[] m;
                    synchronized (lock) {
                        while (!closed && outQ.isEmpty() && outSnap == null) lock.wait(500);
                    }
                    if (closed) break;
                    while ((m = outQ.poll()) != null) frame(m);
                    m = outSnap;
                    if (m != null) { outSnap = null; frame(m); }
                    out.flush();
                }
            } catch (Exception e) {
                if (!closed) { state = FAILED; info = "Conexão perdida."; }
            }
        }, "bt-write").start();
    }

    private void frame(byte[] m) throws IOException { out.writeInt(m.length); out.write(m); }

    private void wake() { synchronized (lock) { lock.notifyAll(); } }

    // ---------------------------------------------------------------- Wi-Fi (rede local, TCP + aviso por UDP)
    boolean isWifi() { return wifi; }

    /** Endereços de broadcast de todas as redes locais ativas (Wi-Fi ou ponto de acesso). */
    private static ArrayList<InetAddress> broadcasts() {
        ArrayList<InetAddress> l = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    if (ia.getAddress() instanceof Inet4Address && ia.getBroadcast() != null) l.add(ia.getBroadcast());
                }
            }
        } catch (Exception ignored) { }
        return l;
    }

    static boolean wifiAvailable() { return !broadcasts().isEmpty(); }

    void listenWifi(final String name) {
        close();
        closed = false; gen++; host = true; wifi = true; state = LISTENING; info = "";
        new Thread(() -> {
            DatagramSocket ds = null;
            try {
                tcpServer = new ServerSocket();
                tcpServer.setReuseAddress(true);
                tcpServer.bind(new InetSocketAddress(TCP_PORT));
                final ServerSocket ss = tcpServer;
                // aviso periódico na rede para o amigo achar a sala
                Thread beacon = new Thread(() -> {
                    try {
                        DatagramSocket d = new DatagramSocket();
                        d.setBroadcast(true);
                        byte[] data = ("OPATRIOTA1|" + name).getBytes("UTF-8");
                        while (!closed && state == LISTENING) {
                            for (InetAddress b : broadcasts()) {
                                try { d.send(new DatagramPacket(data, data.length, b, UDP_PORT)); } catch (Exception ignored) { }
                            }
                            Thread.sleep(700);
                        }
                        d.close();
                    } catch (Exception ignored) { }
                }, "wifi-beacon");
                beacon.start();
                Socket s = ss.accept();
                try { ss.close(); } catch (Exception ignored) { }
                if (closed) { s.close(); return; }
                s.setTcpNoDelay(true);
                rate = 60;
                attach(s, s.getInputStream(), s.getOutputStream());
            } catch (Exception e) {
                if (!closed) { state = FAILED; info = "Não foi possível abrir a sala no Wi-Fi."; }
            }
        }, "wifi-accept").start();
    }

    /** Fica ouvindo os avisos das salas na rede (preenche "found"). */
    void scanWifi() {
        close();
        closed = false; gen++; host = false; wifi = true; state = IDLE;
        new Thread(() -> {
            try {
                DatagramSocket ds = new DatagramSocket(null);
                ds.setReuseAddress(true);
                ds.bind(new InetSocketAddress(UDP_PORT));
                ds.setSoTimeout(500);
                scanSock = ds;
                byte[] buf = new byte[256];
                while (!closed) {
                    try {
                        DatagramPacket p = new DatagramPacket(buf, buf.length);
                        ds.receive(p);
                        String t = new String(p.getData(), 0, p.getLength(), "UTF-8");
                        if (t.startsWith("OPATRIOTA1|")) found.put(p.getAddress().getHostAddress(), new Object[]{t.substring(11), System.currentTimeMillis()});
                    } catch (SocketTimeoutException ignored) { }
                    long now = System.currentTimeMillis();
                    for (String k : new ArrayList<>(found.keySet())) { Object[] v = found.get(k); if (v != null && now - (Long) v[1] > 4000) found.remove(k); }
                }
            } catch (Exception ignored) { }
        }, "wifi-scan").start();
    }

    void connectWifi(final String ip, String name) {
        try { if (scanSock != null) scanSock.close(); } catch (Exception ignored) { }
        closed = true; wake();
        closed = false; gen++; host = false; wifi = true; state = CONNECTING; info = name;
        new Thread(() -> {
            Socket s = new Socket();
            try {
                s.connect(new InetSocketAddress(ip, TCP_PORT), 5000);
                s.setTcpNoDelay(true);
                if (closed) { s.close(); return; }
                rate = 60;
                attach(s, s.getInputStream(), s.getOutputStream());
            } catch (Exception e) {
                try { s.close(); } catch (Exception ignored) { }
                if (!closed) { state = FAILED; info = "Não conectou. O amigo já criou a sala?"; }
            }
        }, "wifi-connect").start();
    }

    // ---------------------------------------------------------------- uso
    boolean connected() { return state == CONNECTED; }

    /** Mensagem pequena e importante (entradas, controle): sempre entregue, em ordem. */
    void send(byte[] m) { if (state == CONNECTED) { outQ.add(m); wake(); } }

    /** Estado do jogo: se o anterior ainda não saiu, é substituído. */
    void sendSnap(byte[] m) { if (state == CONNECTED) { outSnap = m; wake(); } }

    /** Mede a latência (convidado chama ~1x por segundo). */
    void ping() {
        int t = (int) (System.nanoTime() / 1000000L);
        send(new byte[]{Snap.M_PING, (byte) (t >> 24), (byte) (t >> 16), (byte) (t >> 8), (byte) t});
    }

    byte[] poll() { return inbox.poll(); }

    byte[] takeSnap() { byte[] m = inSnap; inSnap = null; return m; }

    /** Avisa o parceiro e fecha logo depois (dá tempo de a mensagem sair). */
    void bye() {
        if (state == CONNECTED) send(new byte[]{Snap.M_BYE});
        final int g0 = gen;
        new Thread(() -> {
            try { Thread.sleep(300); } catch (InterruptedException ignored) { }
            if (g0 == gen) close();
        }, "bt-bye").start();
    }

    void close() {
        closed = true;
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        try { if (sock != null) sock.close(); } catch (Exception ignored) { }
        try { if (tcpServer != null) tcpServer.close(); } catch (Exception ignored) { }
        try { if (scanSock != null) scanSock.close(); } catch (Exception ignored) { }
        server = null; sock = null; out = null; tcpServer = null; scanSock = null; wifi = false; found.clear();
        outQ.clear(); inbox.clear(); outSnap = null; inSnap = null;
        wake();
        state = IDLE;
    }
}
