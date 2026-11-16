/**
 * demo-playlist.js — lista de teste embutida.
 *
 * É um M3U de verdade (passa pelo mesmo parser das listas do usuário), só com
 * streams públicos de demonstração mantidos por Mux, Apple,
 * Unified Streaming e Blender Foundation. Serve para validar o player sem
 * depender de nenhum servidor de IPTV.
 */
(function (IPTV) {
  'use strict';

  IPTV.Parsers.DEMO_PLAYLIST = [
    '#EXTM3U',
    '#EXTINF:-1 tvg-id="demo.unified.live" tvg-name="Unified Live Test" group-title="Ao vivo (teste)",Sinal de teste ao vivo (Unified Streaming)',
    'https://demo.unified-streaming.com/k8s/live/stable/live.isml/.m3u8',
    '#EXTINF:-1 tvg-id="demo.mux.bbb" tvg-name="Big Buck Bunny" group-title="HLS adaptativo",Big Buck Bunny (Mux, multi-bitrate)',
    'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    '#EXTINF:-1 tvg-id="demo.unified.tos" tvg-name="Tears of Steel" group-title="HLS adaptativo",Tears of Steel (Unified Streaming)',
    'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    '#EXTINF:-1 tvg-id="demo.mux.stream" tvg-name="Mux Stream" group-title="HLS adaptativo",Big Buck Bunny (Mux Video)',
    'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
    '#EXTINF:-1 tvg-id="demo.apple.fmp4" tvg-name="Apple BipBop fMP4" group-title="Apple (referência)",Apple BipBop avançado (fMP4)',
    'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    '#EXTINF:-1 tvg-id="demo.apple.ts" tvg-name="Apple BipBop TS" group-title="Apple (referência)",Apple BipBop 16:9 (MPEG-TS)',
    'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    '#EXTINF:-1 tvg-id="demo.blender.sintel" tvg-name="Sintel Trailer" group-title="Filmes (teste)",Sintel — Trailer 720p (MP4)',
    'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4'
  ].join('\n');
})(window.IPTV);
