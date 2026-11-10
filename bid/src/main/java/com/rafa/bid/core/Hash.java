package com.rafa.bid.core;

import java.security.MessageDigest;
import java.util.Locale;

public final class Hash {
    private Hash() {}

    /** SHA-1 de partes normalizadas (igual ao make_hash da versão Windows). */
    public static String make(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append('|');
            sb.append(parts[i] == null ? "" : parts[i].trim().toLowerCase(Locale.ROOT));
        }
        try {
            byte[] d = MessageDigest.getInstance("SHA-1").digest(sb.toString().getBytes("UTF-8"));
            StringBuilder hex = new StringBuilder();
            for (byte b : d) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
