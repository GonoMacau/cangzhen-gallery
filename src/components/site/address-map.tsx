interface Props {
  address: string;
  className?: string;
}

export function AddressMap({ address, className }: Props) {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const src = `https://maps.google.com/maps?q=${encodeURIComponent(trimmed)}&z=15&output=embed`;

  return (
    <iframe
      title="地圖"
      className={className ?? "w-full aspect-video rounded-lg border"}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={src}
      allowFullScreen
    />
  );
}
