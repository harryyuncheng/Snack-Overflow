export default function Thumb({ src, emoji, size = 40 }: { src?: string; emoji: string; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-lg border border-hairline bg-paper" style={{ width: size, height: size }}>
      {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <span style={{ fontSize: size * 0.5 }}>{emoji}</span>}
    </div>
  );
}
