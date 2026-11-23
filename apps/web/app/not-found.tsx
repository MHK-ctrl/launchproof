import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container flex min-h-[55vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#3ddc97]">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#f0f6ff]">
        That page is not in scope.
      </h1>
      <p className="mt-3 max-w-md text-[14px] text-[#93a6bd]">
        The page may have moved, or the link was never valid. A broken link is exactly the kind of
        thing LaunchProof checks for.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn btn-primary !py-2 !text-[13px]">
          Back home
        </Link>
        <Link href="/docs" className="btn btn-secondary !py-2 !text-[13px]">
          Documentation
        </Link>
      </div>
    </div>
  );
}
