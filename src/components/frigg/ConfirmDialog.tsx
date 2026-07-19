"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onDismiss,
}: {
  request: ConfirmRequest | null;
  onDismiss: () => void;
}) {
  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && onDismiss()}>
      <AlertDialogContent className="max-w-[min(22rem,calc(100vw-2rem))] rounded-3xl border-border/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-[22px] tracking-[-0.02em]">
            {request?.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[14px] leading-relaxed">
            {request?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="rounded-2xl">
            {request?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={
              request?.destructive
                ? "rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90"
            }
            onClick={() => {
              request?.onConfirm();
              onDismiss();
            }}
          >
            {request?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
