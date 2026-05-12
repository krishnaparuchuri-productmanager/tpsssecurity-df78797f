import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  showCascade?: boolean;
  cascadeLabel?: string;
  onConfirm: (reason: string, cascade: boolean) => Promise<void> | void;
}

export function CancelDialog({ open, onOpenChange, title, description, showCascade, cascadeLabel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [cascade, setCascade] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= 10;

  async function handle() {
    if (!valid) return;
    setBusy(true);
    try { await onConfirm(reason.trim(), cascade); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) { setReason(""); setCascade(false); } } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason (min 10 characters) <span className="text-destructive">*</span></Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client raised dispute on overtime calculation for 3 guards" />
            <div className="text-xs text-muted-foreground mt-1">{reason.trim().length}/10</div>
          </div>
          {showCascade && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={cascade} onCheckedChange={(v) => setCascade(!!v)} />
              <span>{cascadeLabel}</span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Back</Button>
          <Button variant="destructive" onClick={handle} disabled={!valid || busy}>
            {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirm Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
