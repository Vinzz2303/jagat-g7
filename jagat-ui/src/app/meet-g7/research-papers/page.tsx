import SiteSectionPage from "@/components/site/SiteSectionPage";
import { SITE_SECTION_PAGES } from "@/lib/site-sections";

export default function ResearchPapersPage() {
  return <SiteSectionPage content={SITE_SECTION_PAGES["research-papers"]} />;
}
