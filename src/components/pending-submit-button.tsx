"use client";

import { useFormStatus } from "react-dom";

import { PendingOverlay } from "@/components/pending-overlay";

export function PendingSubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <PendingOverlay visible={pending} message={`請稍等，${pendingLabel}…`} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? `${pendingLabel}…` : children}
      </button>
    </>
  );
}
