import { redirect } from "next/navigation";

/** The timeline now lives on the case overview. */
export default async function TimelinePage({ params }: PageProps<"/app/cases/[caseId]/timeline">) {
  const { caseId } = await params;
  redirect(`/app/cases/${caseId}#timeline`);
}
