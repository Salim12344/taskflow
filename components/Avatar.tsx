function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function OnlineDot({ size }: { size: number }) {
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <span
      style={{
        position: "absolute",
        bottom: -1,
        right: -1,
        width: dot,
        height: dot,
        borderRadius: "50%",
        background: "var(--color-green, #34d399)",
        border: "2px solid var(--color-surface)",
      }}
    />
  );
}

export function Avatar({ name, avatarUrl, size = 32, fontSize, online = false }: { name: string; avatarUrl?: string | null; size?: number; fontSize?: number; online?: boolean }) {
  const fs = fontSize ?? Math.round(size * 0.38);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          width={size}
          height={size}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <div className="avatar" style={{ width: size, height: size, fontSize: fs }}>
          {initialsOf(name) || "?"}
        </div>
      )}
      {online && <OnlineDot size={size} />}
    </div>
  );
}
