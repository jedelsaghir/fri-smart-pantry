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
  /** Optional second primary action (e.g. Used vs Expired) */
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDestructive?: boolean;
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
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="min-h-11 rounded-2xl">
              {request?.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            {request?.secondaryLabel && request.onSecondary && (
              <AlertDialogAction
                className={
                  request.secondaryDestructive
                    ? "min-h-11 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "min-h-11 rounded-2xl bg-secondary text-foreground hover:bg-secondary/80"
                }
                onClick={() => {
                  request.onSecondary?.();
                  onDismiss();
                }}
              >
                {request.secondaryLabel}
              </AlertDialogAction>
            )}
            <AlertDialogAction
              className={
                request?.destructive
                  ? "min-h-11 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "min-h-11 rounded-2xl bg-brand text-brand-foreground hover:bg-brand/90"
              }
              onClick={() => {
                request?.onConfirm();
                onDismiss();
              }}
            >
              {request?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
