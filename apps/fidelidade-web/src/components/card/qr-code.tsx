import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { generateQrSvg } from "@/lib/qr";

type QrCodeProps = {
  value: string;
  size?: number;
  className?: string;
  /** Accessible description; the QR itself is decorative to a screen reader. */
  label: string;
};

export function QrCode({ value, size = 240, className, label }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);

    generateQrSvg(value, { size })
      .then((markup) => {
        if (!cancelled) {
          setSvg(markup);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    // The QR is a convenience; the code or link underneath is the real payload,
    // so a generation failure must not blank the screen.
    return null;
  }

  if (!svg) {
    return (
      <Skeleton
        className={cn("rounded-lg", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-white p-2",
        className,
      )}
      style={{ width: size + 16, height: size + 16 }}
      // The markup comes from `qrcode`'s SVG serializer over a value we
      // control, not from user input or the network.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: locally generated SVG
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default QrCode;
