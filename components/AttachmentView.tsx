import { useEffect, useRef, useState } from "react";
import type { Attachment } from "@/lib/api-client";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** WhatsApp-style voice-note player — native <audio controls> renders as a browser-chrome
 * widget that can't be recolored to sit inside a chat bubble, hence the custom transport. */
function VoiceMessage({ src, mine }: { src: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  }

  const fg = mine ? "var(--color-bg)" : "var(--color-text)";
  const track = mine ? "color-mix(in srgb, var(--color-bg) 35%, transparent)" : "color-mix(in srgb, var(--color-text) 20%, transparent)";
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180, color: fg }}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: "none" }} />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: fg, flex: "none", display: "flex" }}
      >
        {playing ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: track, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct}%`, borderRadius: 2, background: fg }} />
      </div>
      <div className="mono" style={{ fontSize: 10.5, opacity: 0.85, flex: "none" }}>
        {formatDuration(playing || progress ? progress : duration)}
      </div>
    </div>
  );
}

export function AttachmentView({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  if (attachment.type.startsWith("audio/")) {
    return <VoiceMessage src={attachment.url} mine={mine} />;
  }

  if (attachment.type.startsWith("image/")) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer">
        <img src={attachment.url} alt={attachment.name} style={{ display: "block", maxWidth: 220, maxHeight: 220, borderRadius: 8, objectFit: "cover" }} />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.12)", color: "inherit", textDecoration: "none", maxWidth: 220 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachment.name}</div>
        <div style={{ fontSize: 10.5, opacity: 0.7 }}>{formatSize(attachment.size)}</div>
      </div>
    </a>
  );
}
