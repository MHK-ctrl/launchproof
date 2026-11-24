import Link from 'next/link';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#2c5a46] bg-[#0d2b20] font-mono text-[12px] font-bold text-[#6ef0b6]">
        LP
      </span>
      <span className="text-[16px] font-semibold tracking-tight text-[#edf5ff]">LaunchProof</span>
    </Link>
  );
}
