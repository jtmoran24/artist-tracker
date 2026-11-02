"use client";

import { useFormStatus } from "react-dom";

// Disables itself while the parent form's server action runs.
export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
