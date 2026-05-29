import type { ButtonHTMLAttributes } from "react";

const baseButtonClasses =
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${baseButtonClasses} focus-visible:ring-blue-500 ${className}`}
      {...props}
    />
  );
}

export function DestructiveButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${baseButtonClasses} focus-visible:ring-red-500 border border-red-500 text-red-600 hover:bg-red-50 ${className}`}
      {...props}
    />
  );
}
