import { Suspense } from "react";

import SelectionSummaryPage from "@/screens/selection-summary/SelectionSummaryPage";

// SelectionSummaryPage reads useSearchParams(), which Next requires to sit
// inside a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={<p style={{ padding: 40 }}>Loading report...</p>}>
      <SelectionSummaryPage />
    </Suspense>
  );
}
