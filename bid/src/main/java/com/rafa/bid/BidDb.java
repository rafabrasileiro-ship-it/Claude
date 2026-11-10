package com.rafa.bid;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import com.rafa.bid.core.Hash;
import com.rafa.bid.core.Linha;
import com.rafa.bid.core.Modelos.Atleta;
import com.rafa.bid.core.Modelos.Evento;
import com.rafa.bid.core.Modelos.Vinculo;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Banco local (SQLite) com eventos do BID, atletas e vínculos (histórico). */
public class BidDb extends SQLiteOpenHelper {

    public BidDb(Context c) {
        super(c, "bid.db", null, 1);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE eventos (hash TEXT PRIMARY KEY, data_bid TEXT, atleta_id TEXT, atleta_nome TEXT,"
            + " nascimento TEXT, tipo TEXT, clube TEXT, clube_origem TEXT, federacao TEXT, categoria TEXT,"
            + " inicio TEXT, fim TEXT, extra_json TEXT, coletado_em TEXT DEFAULT CURRENT_TIMESTAMP)");
        db.execSQL("CREATE TABLE atletas (id_cbf TEXT PRIMARY KEY, nome TEXT, nascimento TEXT, historico_em TEXT)");
        db.execSQL("CREATE TABLE vinculos (hash TEXT PRIMARY KEY, atleta_id TEXT, clube TEXT, tipo TEXT,"
            + " federacao TEXT, categoria TEXT, inicio TEXT, fim TEXT, extra_json TEXT)");
        db.execSQL("CREATE INDEX ix_ev_data ON eventos(data_bid)");
        db.execSQL("CREATE INDEX ix_vinc_atleta ON vinculos(atleta_id)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int o, int n) { }

    private static String extraJson(Linha l) {
        return new JSONObject(l.extra).toString();
    }

    /** Insere evento; true se era novo. */
    public synchronized boolean addEvento(Linha l, String dataBid, String atletaId) {
        SQLiteDatabase db = getWritableDatabase();
        String nome = l.get("atleta_nome");
        String h = Hash.make(dataBid, atletaId != null ? atletaId : nome, l.get("tipo"), l.get("clube"),
            l.get("clube_origem"), l.get("inicio"), l.get("fim"));
        ContentValues v = new ContentValues();
        v.put("hash", h);
        v.put("data_bid", dataBid);
        v.put("atleta_id", atletaId);
        v.put("atleta_nome", nome);
        v.put("nascimento", l.get("nascimento"));
        v.put("tipo", l.get("tipo"));
        v.put("clube", l.get("clube"));
        v.put("clube_origem", l.get("clube_origem"));
        v.put("federacao", l.get("federacao"));
        v.put("categoria", l.get("categoria"));
        v.put("inicio", l.get("inicio"));
        v.put("fim", l.get("fim"));
        v.put("extra_json", extraJson(l));
        boolean novo = db.insertWithOnConflict("eventos", null, v, SQLiteDatabase.CONFLICT_IGNORE) != -1;
        if (atletaId != null) upsertAtleta(atletaId, nome, l.get("nascimento"), false);
        return novo;
    }

    public synchronized void upsertAtleta(String id, String nome, String nasc, boolean comHistorico) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues v = new ContentValues();
        v.put("id_cbf", id);
        v.put("nome", nome);
        v.put("nascimento", nasc);
        db.insertWithOnConflict("atletas", null, v, SQLiteDatabase.CONFLICT_IGNORE);
        ContentValues u = new ContentValues();
        if (nome != null) u.put("nome", nome);
        if (nasc != null) u.put("nascimento", nasc);
        if (comHistorico) u.put("historico_em", com.rafa.bid.core.Dia.hoje().toString());
        if (u.size() > 0) db.update("atletas", u, "id_cbf=?", new String[]{id});
    }

    public synchronized boolean addVinculo(String atletaId, Linha l) {
        String clube = l.get("clube") != null ? l.get("clube") : l.get("clube_origem");
        if (clube == null) return false;
        String inicio = l.get("inicio") != null ? l.get("inicio") : l.get("data_evento");
        ContentValues v = new ContentValues();
        v.put("hash", Hash.make(atletaId, clube, l.get("tipo"), inicio, l.get("fim")));
        v.put("atleta_id", atletaId);
        v.put("clube", clube);
        v.put("tipo", l.get("tipo"));
        v.put("federacao", l.get("federacao"));
        v.put("categoria", l.get("categoria"));
        v.put("inicio", inicio);
        v.put("fim", l.get("fim"));
        v.put("extra_json", extraJson(l));
        return getWritableDatabase().insertWithOnConflict("vinculos", null, v, SQLiteDatabase.CONFLICT_IGNORE) != -1;
    }

    public synchronized int count(String tabela) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM " + tabela, null)) {
            return c.moveToFirst() ? c.getInt(0) : 0;
        }
    }

    public synchronized void apagarTudo() {
        SQLiteDatabase db = getWritableDatabase();
        db.delete("eventos", null, null);
        db.delete("vinculos", null, null);
        db.delete("atletas", null, null);
    }

    /** Tabela inteira como colunas + linhas de texto (para CSV). */
    public synchronized Object[] exportar(String tabela, String orderBy) {
        List<String> cols = new ArrayList<>();
        List<List<String>> rows = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT * FROM " + tabela + " ORDER BY " + orderBy, null)) {
            for (String n : c.getColumnNames()) if (!n.equals("hash")) cols.add(n);
            while (c.moveToNext()) {
                List<String> r = new ArrayList<>();
                for (String n : cols) r.add(c.getString(c.getColumnIndexOrThrow(n)));
                rows.add(r);
            }
        }
        return new Object[]{cols, rows};
    }

    public synchronized List<Evento> listEventos() {
        List<Evento> out = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery(
                "SELECT data_bid,atleta_id,atleta_nome,nascimento,tipo,clube,clube_origem,inicio,fim FROM eventos"
                + " ORDER BY data_bid", null)) {
            while (c.moveToNext()) {
                Evento e = new Evento();
                e.dataBid = c.getString(0); e.atletaId = c.getString(1); e.atletaNome = c.getString(2);
                e.nascimento = c.getString(3); e.tipo = c.getString(4); e.clube = c.getString(5);
                e.clubeOrigem = c.getString(6); e.inicio = c.getString(7); e.fim = c.getString(8);
                out.add(e);
            }
        }
        return out;
    }

    public synchronized Map<String, Atleta> mapaAtletas() {
        Map<String, Atleta> m = new LinkedHashMap<>();
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor c = db.rawQuery("SELECT id_cbf,nome,nascimento FROM atletas", null)) {
            while (c.moveToNext()) {
                Atleta a = new Atleta();
                a.id = c.getString(0); a.nome = c.getString(1); a.nascimento = c.getString(2);
                m.put(a.id, a);
            }
        }
        try (Cursor c = db.rawQuery("SELECT atleta_id,clube,tipo,inicio,fim FROM vinculos", null)) {
            while (c.moveToNext()) {
                Atleta a = m.get(c.getString(0));
                if (a == null) continue;
                Vinculo v = new Vinculo();
                v.clube = c.getString(1); v.tipo = c.getString(2); v.inicio = c.getString(3); v.fim = c.getString(4);
                a.vinculos.add(v);
            }
        }
        return m;
    }
}
