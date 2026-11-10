package com.rafa.bid.core;

import java.util.Calendar;

/** Data simples (sem java.time, para funcionar no Android 5+). */
public final class Dia implements Comparable<Dia> {
    public final int y, m, d;

    public Dia(int y, int m, int d) { this.y = y; this.m = m; this.d = d; }

    /** Lê o prefixo AAAA-MM-DD; null se inválido. */
    public static Dia parse(String iso) {
        if (iso == null || iso.length() < 10) return null;
        try {
            int y = Integer.parseInt(iso.substring(0, 4));
            int m = Integer.parseInt(iso.substring(5, 7));
            int d = Integer.parseInt(iso.substring(8, 10));
            if (iso.charAt(4) != '-' || iso.charAt(7) != '-') return null;
            if (m < 1 || m > 12 || d < 1 || d > diasNoMes(y, m)) return null;
            return new Dia(y, m, d);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static Dia hoje() {
        Calendar c = Calendar.getInstance();
        return new Dia(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    public static int diasNoMes(int y, int m) {
        switch (m) {
            case 2: return ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0) ? 29 : 28;
            case 4: case 6: case 9: case 11: return 30;
            default: return 31;
        }
    }

    /** Dias desde 1970-01-01. */
    public long epoch() {
        int yy = m <= 2 ? y - 1 : y;
        long era = (yy >= 0 ? yy : yy - 399) / 400;
        long yoe = yy - era * 400;
        long mp = (m + 9) % 12;
        long doy = (153 * mp + 2) / 5 + d - 1;
        long doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        return era * 146097 + doe - 719468;
    }

    public Dia plusYears(int n) {
        int ny = y + n;
        return new Dia(ny, m, Math.min(d, diasNoMes(ny, m)));
    }

    public int idadeEm(Dia ref) {
        int idade = ref.y - y;
        if (ref.m < m || (ref.m == m && ref.d < d)) idade--;
        return idade;
    }

    @Override public int compareTo(Dia o) { return Long.compare(epoch(), o.epoch()); }
    @Override public boolean equals(Object o) { return o instanceof Dia && compareTo((Dia) o) == 0; }
    @Override public int hashCode() { return (int) epoch(); }
    @Override public String toString() { return String.format("%04d-%02d-%02d", y, m, d); }
}
