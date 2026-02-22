import { Hero } from "@/components/hero/hero";
import { ProblemSection } from "@/components/sections/problem";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { TDMExplorerSection } from "@/components/sections/tdm-explorer";
import { QuickInstallSection } from "@/components/sections/quick-install";
import { getGitHubStarCount } from "@/lib/github-stats";

export default async function Home() {
  const starCount = await getGitHubStarCount();

  return (
    <main>
      <Hero starCount={starCount} />
      <ProblemSection />
      <HowItWorksSection />
      <TDMExplorerSection />
      <QuickInstallSection />
    </main>
  );
}
