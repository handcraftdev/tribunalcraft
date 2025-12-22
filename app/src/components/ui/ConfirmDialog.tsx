"use client";

import { memo, useCallback, useState } from "react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = memo(function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel]
  );

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "text-crimson",
      button: "bg-crimson hover:bg-crimson/80",
      border: "border-crimson/30",
    },
    warning: {
      icon: "text-gold",
      button: "bg-gold hover:bg-gold/80 text-obsidian",
      border: "border-gold/30",
    },
    info: {
      icon: "text-sky-400",
      button: "bg-sky-500 hover:bg-sky-400",
      border: "border-sky-500/30",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-obsidian border ${styles.border} rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="p-4 border-b border-slate-light/30">
          <div className="flex items-center gap-3">
            <div className={`${styles.icon}`}>
              {variant === "danger" && (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {variant === "warning" && (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {variant === "info" && (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-ivory">
              {title}
            </h2>
          </div>
        </div>

        <div className="p-4">
          <p className="text-steel text-sm">{message}</p>
        </div>

        <div className="p-4 border-t border-slate-light/30 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-steel hover:text-ivory transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded transition-colors ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

/**
 * Hook for managing confirmation dialog state
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (options: {
      title: string;
      message: string;
      confirmLabel?: string;
      variant?: "danger" | "warning" | "info";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          isOpen: true,
          ...options,
          onConfirm: () => {
            setState((s) => ({ ...s, isOpen: false }));
            resolve(true);
          },
        });
      });
    },
    []
  );

  const cancel = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
  }, []);

  return { state, confirm, cancel };
}
