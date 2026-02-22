import Link from "next/link";
import { GITHUB_REPO_URL } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-12">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-300">Thirdwatch</span>
            <span>·</span>
            <span>Know before you break.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link href="/docs" className="hover:text-zinc-300 transition-colors">
              Docs
            </Link>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <span>Apache-2.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
