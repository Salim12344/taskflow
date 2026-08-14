function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** Deterministic hue from the name so the same person always gets the same color, without storing one. */
function avatarHues(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return { a: `oklch(58% 0.13 ${hue})`, b: `oklch(38% 0.12 ${(hue + 40) % 360})` };
}

function OnlineDot({ size, name }: { size: number; name: string }) {
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <span
      role="status"
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
    >
      <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
        {name} is online
      </span>
    </span>
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
        <div
          className="avatar"
          style={{
            width: size,
            height: size,
            fontSize: fs,
            ...(name ? { "--avatar-a": avatarHues(name).a, "--avatar-b": avatarHues(name).b } as React.CSSProperties : {}),
          }}
        >
          {initialsOf(name) || "?"}
        </div>
      )}
      {online && <OnlineDot size={size} name={name} />}
    </div>
  );
}
