"use client";

import { useState, useRef, useCallback } from "react";
import { useScrollLock } from "@/lib/use-scroll-lock";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/**
 * Hook that prevents modal from closing when user drags text selection
 * outside the modal and releases mouse on the backdrop.
 *
 * Also provides a close-confirmation dialog when there's unsaved content,
 * with an option to save as draft.
 *
 * Usage:
 * const { backdropProps, requestClose, showConfirm, setShowConfirm } = useModalCloseGuard({
 *   onClose,
 *   hasContent: () => title !== "" || content !== "",
 *   onSaveDraft: async () => { ... POST with isPublished: false ... },
 * });
 *
 * <div {...backdropProps}>
 *   <div onClick={e => e.stopPropagation()}>
 *     ...modal content...
 *   </div>
 * </div>
 */
export function useModalCloseGuard({
  open,
  onClose,
  hasContent,
  onSaveDraft,
}: {
  open: boolean;
  onClose: () => void;
  hasContent: () => boolean;
  onSaveDraft?: () => Promise<boolean>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const mouseDownOnBackdrop = useRef(false);

  useScrollLock(open);

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only close if both mousedown AND mouseup happened on the backdrop itself.
    // This prevents closing when user drags text selection from inside the modal
    // and releases on the backdrop.
    if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
      if (hasContent()) {
        setShowConfirm(true);
      } else {
        onClose();
      }
    }
  }, [hasContent, onClose]);

  const requestClose = useCallback(() => {
    if (hasContent()) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  }, [hasContent, onClose]);

  const handleSaveDraft = useCallback(async () => {
    if (!onSaveDraft) {
      setShowConfirm(false);
      onClose();
      return;
    }
    setSavingDraft(true);
    try {
      const success = await onSaveDraft();
      if (success) {
        setShowConfirm(false);
        onClose();
      }
    } finally {
      setSavingDraft(false);
    }
  }, [onSaveDraft, onClose]);

  const backdropProps = {
    onMouseDown: handleBackdropMouseDown,
    onClick: handleBackdropClick,
  };

  const confirmDialog = (
    <AlertDialog open={showConfirm} onOpenChange={(open) => {
      if (!open) setShowConfirm(false);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved content. Would you like to save it as a draft, discard it, or keep editing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <AlertDialogCancel className="mt-2 sm:mt-0">Keep editing</AlertDialogCancel>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowConfirm(false); onClose(); }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-destructive/10 text-destructive px-4 py-2"
            >
              Discard
            </button>
            {onSaveDraft && (
              <AlertDialogAction
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {savingDraft ? "Saving..." : "Save as draft"}
              </AlertDialogAction>
            )}
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { backdropProps, requestClose, showConfirm, setShowConfirm, confirmDialog };
}
