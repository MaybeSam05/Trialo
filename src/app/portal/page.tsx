import { redirect } from "next/navigation";

// /portal is the address people share and Clerk redirects to; the form itself lives at /portal/sign-in.
// Sign-in and sign-up are siblings so neither Clerk component treats the other's URL as one of its own steps.
export default async function Portal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of [value].flat()) if (item !== undefined) query.append(key, item);
  redirect(`/portal/sign-in${query.size ? `?${query}` : ""}`);
}
