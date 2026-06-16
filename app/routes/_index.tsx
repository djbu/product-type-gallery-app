import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // If a shop is present, kick off (or resume) auth, landing in the embedded app.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

export default function Index() {
  return (
    <main style={{ fontFamily: "Inter, sans-serif", padding: "4rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>Product Type Gallery</h1>
      <p>
        Append extra image and video galleries to products based on product
        type, title and tags — without Metaobjects.
      </p>
      <p>Install this app from your Shopify admin to get started.</p>
    </main>
  );
}
