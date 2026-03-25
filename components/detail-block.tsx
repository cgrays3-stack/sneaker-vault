import { ReactNode } from "react";

export function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <h4 className="mb-3 font-semibold">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}