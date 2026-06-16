import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getProductTypes, getProductTags } from "../services/shopify-data.server";
import { createRule, type RuleInput } from "../services/gallery.server";
import RuleForm, { type RuleFormData } from "../components/RuleForm";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const [productTypes, storeTags] = await Promise.all([
    getProductTypes(session.shop, admin.graphql),
    getProductTags(session.shop, admin.graphql),
  ]);
  return json({ productTypes, storeTags });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const data = JSON.parse(String(form.get("payload"))) as RuleFormData;

  const input: RuleInput = {
    name: data.name,
    priority: data.priority,
    media: data.media.map((m, i) => ({
      mediaType: m.mediaType,
      url: m.url,
      shopifyFileId: m.shopifyFileId || null,
      sortOrder: i,
    })),
    conditions: data.conditions.map((c) => ({
      productType: c.productType,
      titleContains: c.titleContains,
      tags: c.tags,
    })),
  };

  await createRule(session.shop, input);
  return redirect("/app/rules");
};

export default function NewRule() {
  const { productTypes, storeTags } = useLoaderData<typeof loader>();
  return <RuleForm mode="new" productTypes={productTypes} storeTags={storeTags} />;
}
