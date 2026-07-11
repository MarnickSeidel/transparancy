import dynamic from "next/dynamic";

import AppShellLoading from "@/app/components/AppShellLoading";

const ListingExplorer = dynamic(() => import("@/app/components/ListingExplorer"), {
  ssr: false,
  loading: () => <AppShellLoading />,
});

export default function ExplorePage() {
  return <ListingExplorer />;
}
