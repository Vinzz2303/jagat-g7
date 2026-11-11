import SiteSectionPage from "@/components/site/SiteSectionPage";
import { SITE_SECTION_PAGES } from "@/lib/site-sections";

export default function CyberDefensePage() {
  return <SiteSectionPage content={SITE_SECTION_PAGES["cyber-defense"]} />;
}
