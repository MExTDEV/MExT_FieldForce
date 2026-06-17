import Image from "next/image";
import { branding } from "@/config/branding";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center">
        <div className="mx-auto flex w-full max-w-sm items-center justify-center rounded-3xl bg-white p-5 shadow-card">
          <Image
            src={branding.logoPath}
            alt={branding.fullAppName}
            width={1774}
            height={887}
            priority
            className="h-auto max-h-32 w-full object-contain"
          />
        </div>
        <p className="mt-5 text-sm font-semibold tracking-[0.18em] text-brand-700">
          {branding.slogan}
        </p>
        <p className="mt-2 text-sm text-slate-500">FieldForce wordt geladen...</p>
      </div>
    </div>
  );
}
