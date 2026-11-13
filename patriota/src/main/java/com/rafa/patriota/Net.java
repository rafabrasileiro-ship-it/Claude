package com.rafa.patriota;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothServerSocket;
import android.bluetooth.BluetoothSocket;

import java.io.DataInputStream;
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
    private BluetoothSocket sock;
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
        sock = s;
        out = new DataOutputStream(new java.io.BufferedOutputStream(s.getOutputStream(), 8192));
        final DataInputStream in = new DataInputStream(new java.io.BufferedInputStream(s.getInputStream(), 8192));
        state = CONNECTED;
        new Thread(() -> {
            try {
                while (!closed) {
                    int len = in.readInt();
                    if (len <= 0 || len > 200000) throw new IOException("bad frame");
                    byte[] m = new byte[len];
                    in.readFully(m);
                    if (m[0] == Snap.M_SNAP) inSnap = m; else inbox.add(m);
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

    // ---------------------------------------------------------------- uso
    boolean connected() { return state == CONNECTED; }

    /** Mensagem pequena e importante (entradas, controle): sempre entregue, em ordem. */
    void send(byte[] m) { if (state == CONNECTED) { outQ.add(m); wake(); } }

    /** Estado do jogo: se o anterior ainda não saiu, é substituído. */
    void sendSnap(byte[] m) { if (state == CONNECTED) { outSnap = m; wake(); } }

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
        server = null; sock = null; out = null;
        outQ.clear(); inbox.clear(); outSnap = null; inSnap = null;
        wake();
        state = IDLE;
    }
}
