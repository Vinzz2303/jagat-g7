import PlatformFeaturePage from "@/components/site/PlatformFeaturePage";
import { PLATFORM_FEATURE_PAGES } from "@/lib/platform-features";

export default function RagPipelinePage() {
  return <PlatformFeaturePage content={PLATFORM_FEATURE_PAGES["rag-pipeline"]} />;
}
