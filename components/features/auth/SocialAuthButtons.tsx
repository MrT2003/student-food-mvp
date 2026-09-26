import { ArrowRight, LoaderCircle } from "lucide-react";
import Button from "@/components/ui/Button";

type Props = {
  pending: boolean;
  error: string | null;
  onGoogle: () => void;
};

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-8 shrink-0"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.75 3.28-7.95Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.17v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.17A10.9 10.9 0 0 0 1 12c0 1.77.42 3.44 1.17 4.93l3.67-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.83 6.07l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function SocialAuthButtons({
  pending,
  error,
  onGoogle,
}: Props) {
  return (
    <div>
      <p className="mb-4 text-center text-[#526a9e]">
        Tiếp tục nhanh với
      </p>

      <button
        type="button"
        disabled
        aria-describedby="zalo-status"
        className="flex min-h-16 w-full cursor-not-allowed items-center justify-center gap-5 rounded-2xl bg-gradient-to-r from-[#19a4ff] to-[#2478ff] px-5 py-3 text-lg font-semibold text-white"
      >
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-[#168aff]"
        >
          Zalo
        </span>
        Tiếp tục với Zalo
        <ArrowRight size={24} aria-hidden="true" />
      </button>

      <p
        id="zalo-status"
        className="mt-2 text-center text-xs text-[#526a9e]"
      >
        Đăng nhập Zalo đang được tích hợp.
      </p>

      <div className="my-5 flex items-center gap-4 text-[#526a9e]">
        <span className="h-px flex-1 bg-[#dce2ed]" />
        <span>Hoặc</span>
        <span className="h-px flex-1 bg-[#dce2ed]" />
      </div>

      <Button
        variant="outline"
        onClick={onGoogle}
        disabled={pending}
        aria-busy={pending}
        className="min-h-16 w-full gap-5 text-lg"
      >
        {pending ? (
          <LoaderCircle
            className="size-7 animate-spin"
            aria-hidden="true"
          />
        ) : (
          <GoogleIcon />
        )}

        <span>
          {pending ? "Đang chuyển hướng..." : "Tiếp tục với Google"}
        </span>

        {!pending && <ArrowRight size={24} aria-hidden="true" />}
      </Button>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}