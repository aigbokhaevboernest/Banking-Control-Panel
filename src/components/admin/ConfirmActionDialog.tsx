import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const BRAND = "#5B6EF5";

export interface ConfirmActionOptions {
  /** Header title e.g. "Approve Wire Transfer" */
  title: string;
  /** Body text e.g. 'Do you want to approve this wire transfer?' */
  description?: string;
  /** Defaults to true. When false the checkbox is hidden. */
  showSendMail?: boolean;
  /** Called with sendMail flag if confirmed; not called on close. */
  onConfirm: (sendMail: boolean) => Promise<unknown> | unknown;
}

interface Props extends ConfirmActionOptions {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  showSendMail = true,
  onConfirm,
}: Props) {
  const [sendMail, setSendMail] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSendMail(true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="p-0 overflow-hidden gap-0">
        <DialogHeader
          className="px-5 py-4 text-white"
          style={{ backgroundColor: BRAND }}
        >
          <DialogTitle className="text-white text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-foreground">
            {description || "Do you want to perform this action?"}
          </p>
          {showSendMail && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="send-mail"
                checked={sendMail}
                onCheckedChange={(v) => setSendMail(!!v)}
              />
              <Label htmlFor="send-mail" className="text-sm cursor-pointer">
                Send Mail
              </Label>
            </div>
          )}
        </div>
        <DialogFooter className="px-5 pb-4 gap-2 sm:gap-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="flex-1 sm:flex-none"
          >
            Close
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(showSendMail ? sendMail : false);
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 sm:flex-none text-white hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            {busy ? "Working…" : "Yes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convenience hook-style controller. Use when you want to imperatively open
 * the dialog for different actions on the same page.
 */
export function useConfirmAction() {
  const [opts, setOpts] = useState<ConfirmActionOptions | null>(null);
  return {
    dialog: (
      <ConfirmActionDialog
        open={!!opts}
        onOpenChange={(o) => !o && setOpts(null)}
        title={opts?.title || ""}
        description={opts?.description}
        showSendMail={opts?.showSendMail}
        onConfirm={async (sm) => {
          if (opts) await opts.onConfirm(sm);
        }}
      />
    ),
    confirm: (o: ConfirmActionOptions) => setOpts(o),
  };
}
