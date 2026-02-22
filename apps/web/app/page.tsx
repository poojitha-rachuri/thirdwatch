import { Hero } from "@/components/hero/hero";
import { ProblemSection } from "@/components/sections/problem";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { TDMExplorerSection } from "@/components/sections/tdm-explorer";
import { QuickInstallSection } from "@/components/sections/quick-install";
import { getGitHubStarCount } from "@/lib/github-stats";
import { INSTALL_OPTIONS } from "@/lib/constants";
import { TDM_FIXTURE } from "@/lib/tdm-fixture";

export default async function Home() {
  const starCount = await getGitHubStarCount();

  return (
    <main id="main-content">
      {/* Agent-native: expose install commands and TDM fixture in initial HTML */}
      <script
        type="application/json"
        id="install-commands"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            INSTALL_OPTIONS.map((o) => ({ id: o.id, command: o.command }))
          ).replace(/<\/script>/gi, "\\u003c/script\\u003e"),
        }}
      />
      <script
        type="application/json"
        id="tdm-fixture"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(TDM_FIXTURE).replace(/<\/script>/gi, "\\u003c/script\\u003e"),
        }}
      />
      <Hero starCount={starCount} />
      <ProblemSection />
      <HowItWorksSection />
      <TDMExplorerSection />
      <QuickInstallSection />
    </main>
  );
}
