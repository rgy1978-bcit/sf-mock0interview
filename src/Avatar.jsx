import avatarSarah from "./assets/avatar-sarah.svg";
import avatarMarcus from "./assets/avatar-marcus.svg";
import avatarJennifer from "./assets/avatar-jennifer.svg";
import avatarDavid from "./assets/avatar-david.svg";

// Keyed on person, not the SF job code — Premia uses the person key directly.
// For historical reasons the prop is still called jobId; the SF branch sets
// job.id to the SF job code, and Avatar.SF maps that to a person. On Premia,
// job.id IS the person key.
const ART = {
  sarah: avatarSarah,
  marcus: avatarMarcus,
  jennifer: avatarJennifer,
  david: avatarDavid,
  // SF legacy keys — kept so this file works on either branch without edits.
  canes: avatarSarah,
  petplus: avatarMarcus,
  sfcamp: avatarJennifer,
  sfpark: avatarJennifer,
  swim: avatarDavid,
  guard: avatarDavid,
};

export default function Avatar({ jobId, accent, accentBg, speaking, size = 140 }) {
  const src = ART[jobId] || avatarSarah;
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: accentBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: speaking
          ? `0 0 0 3px ${accent}66, 0 0 0 8px ${accent}22`
          : `0 0 0 1px ${accent}22`,
        transform: speaking ? "scale(1.03)" : "scale(1)",
        transition: "box-shadow 0.35s, transform 0.35s",
        overflow: "hidden",
        flexShrink: 0,
        animation: speaking ? "avatarBreath 2.4s ease-in-out infinite" : "none",
      }}
    >
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
      />
    </div>
  );
}
