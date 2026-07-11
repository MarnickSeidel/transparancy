import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const ZoneDossier = dynamic(() => import("@/app/components/ZoneDossier"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

type Props = {
  params: { citySlug: string; zoneSlug: string };
};

export default function ZoneDetailPage({ params }: Props) {
  return <ZoneDossier citySlug={params.citySlug} zoneSlug={params.zoneSlug} />;
}
