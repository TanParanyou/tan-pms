import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommandTag } from "@/components/ui/command-tag";
import { TerminalCard } from "@/components/ui/terminal-card";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-6 sm:p-12 md:p-24 max-w-4xl mx-auto">
      {/* Top Bar with Status Tag */}
      <div className="w-full flex items-center justify-between">
        <span className="font-rounded font-semibold text-xl tracking-tight text-[#000000]">
          tan-pms
        </span>
        <div className="flex items-center gap-2">
          <CommandTag prefixCode="STATUS">ONLINE</CommandTag>
          <CommandTag prefixCode="SCOPE">DUAL-ISOLATED</CommandTag>
        </div>
      </div>

      {/* Hero Section (Ollama Minimal Design System) */}
      <div className="my-auto py-16 text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-rounded font-medium tracking-tight text-[#000000]">
            Enterprise Property Management System
          </h1>
          <p className="text-lg text-[#737373] max-w-2xl mx-auto leading-relaxed">
            Single-Organization, Multi-Property PMS supporting{" "}
            <span className="text-[#000000] font-medium">Hourly</span>,{" "}
            <span className="text-[#000000] font-medium">Daily</span>, and{" "}
            <span className="text-[#000000] font-medium">Monthly</span> StayModes in a unified
            concurrency engine.
          </p>
        </div>

        {/* Command Pill */}
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full bg-[#fafafa] border border-[#e5e5e5] px-6 py-2.5 text-sm font-mono text-[#000000]">
            <span className="text-[#737373] mr-2">$</span>
            <span>tan-pms --property BKK01 --mode unified</span>
          </div>
        </div>

        {/* Action Buttons (Pill Geometry 9999px) */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/admin">
            <Button size="lg" className="rounded-full shadow-none">
              Admin Operations (/admin) →
            </Button>
          </Link>
          <Link href="/client">
            <Button variant="outline" size="lg" className="rounded-full shadow-none">
              Client Portal (/client) →
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg" className="rounded-full shadow-none">
              Scope Switcher (/login)
            </Button>
          </Link>
        </div>
      </div>

      {/* Terminal Card Footer */}
      <div className="w-full pt-8">
        <TerminalCard
          title="tan-pms.kernel.boot"
          badge="RFC 9457 & Ollama Design System"
        >
          <div className="space-y-1 text-xs text-[#525252]">
            <p>
              [OK] PostgreSQL Exclusion Constraints (tstzrange EXCLUDE USING gist) verified
            </p>
            <p>
              [OK] Ubiquitous Language: 20 Canonical Terms & 9 Document Sequences (RES, STY,
              LSE, INV, RCT, DEP, SHF, WKO, PCL) loaded
            </p>
            <p>
              [OK] Strict Zero Foreign Key .find() frontend resolution contract enforced
            </p>
          </div>
        </TerminalCard>
      </div>
    </main>
  );
}
