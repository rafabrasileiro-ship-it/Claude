package com.rafa.bid.core;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Utilitários de texto e data (Java puro, sem dependências do Android). */
public final class Texto {
    private Texto() {}

    public static String norm(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        n = n.replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
        while (n.endsWith(":")) n = n.substring(0, n.length() - 1).trim();
        return n;
    }

    public static String clean(String s) {
        if (s == null) return "";
        return s.replace(' ', ' ').replaceAll("\\s+", " ").trim();
    }

    private static final Pattern DMY = Pattern.compile("(\\d{2})/(\\d{2})/(\\d{4})");
    private static final Pattern YMD = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");
    private static final Pattern DMY2 = Pattern.compile("(\\d{2})-(\\d{2})-(\\d{4})");

    /** Devolve AAAA-MM-DD ou null. */
    public static String parseDate(String s) {
        s = clean(s);
        Matcher m = DMY.matcher(s);
        if (m.find()) return iso(Integer.parseInt(m.group(3)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
        m = YMD.matcher(s);
        if (m.find()) return iso(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        m = DMY2.matcher(s);
        if (m.find()) return iso(Integer.parseInt(m.group(3)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
        return null;
    }

    private static String iso(int y, int m, int d) {
        if (m < 1 || m > 12 || d < 1 || d > Dia.diasNoMes(y, m)) return null;
        return new Dia(y, m, d).toString();
    }
}
