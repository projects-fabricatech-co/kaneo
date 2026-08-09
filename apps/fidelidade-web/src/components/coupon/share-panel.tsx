import { Copy } from "lucide-react";
import { useState } from "react";
import { QrCode } from "@/components/card/qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { copy } from "@/lib/copy";
import { publicCouponUrl } from "@/lib/qr";
import { toast } from "@/lib/toast";

type SharePanelProps = {
  token: string;
  title: string;
};

/**
 * How a campaign actually reaches customers: a link to paste into WhatsApp, and
 * a QR to print and leave on the counter. Both point at the same public page.
 */
export function SharePanel({ token, title }: SharePanelProps) {
  const url = publicCouponUrl(token);
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Not available on http:// outside localhost, which is exactly where a
      // lojista testing from their phone will be — so failure has to be handled,
      // not assumed away.
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      toast.success(copy.coupon.copied);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      toast.error(copy.coupon.copyFailed);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-sm font-medium">{copy.coupon.shareTitle}</h2>
          <p className="text-sm text-muted-foreground">
            {copy.coupon.shareHint}
          </p>
        </div>

        <QrCode value={url} size={180} label={`QR de ${title}`} />

        {/* Selectable, so copying by hand works when the clipboard API doesn't. */}
        <p className="w-full break-all rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
          {url}
        </p>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleCopy}
          aria-live="polite"
        >
          <Copy aria-hidden="true" className="size-4" />
          {justCopied ? copy.coupon.copied : copy.coupon.copyLink}
        </Button>
      </CardContent>
    </Card>
  );
}

export default SharePanel;
