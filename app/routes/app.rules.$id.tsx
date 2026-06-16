import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getProductTypes, getProductTags } from "../services/shopify-data.server";
import {
  getRule,
  updateRule,
  deleteRule,
  parseConditionTags,
  type RuleInput,
} from "../services/gallery.server";
import RuleForm, { type RuleFormData } from "../components/RuleForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const rule = await getRule(session.shop, params.id!);
  if (!rule) throw new Response("Not found", { status: 404 });

  const [productTypes, storeTags] = await Promise.all([
    getProductTypes(session.shop, admin.graphql),
    getProductTags(session.shop, admin.graphql),
  ]);

  const initial: RuleFormData = {
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
    media: rule.media
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        mediaType: m.mediaType === "video" ? "video" : "image",
        url: m.url,
        shopifyFileId: m.shopifyFileId ?? "",
      })),
    conditions: rule.conditions.map((c) => ({
      productType: c.productType,
      titleContains: c.titleContains ?? "",
      tags: parseConditionTags(c),
    })),
  };

  return json({ initial, productTypes, storeTags });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    await deleteRule(session.shop, params.id!);
    return redirect("/app/rules");
  }

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

  await updateRule(session.shop, params.id!, input);
  return redirect("/app/rules");
};

export default function EditRule() {
  const { initial, productTypes, storeTags } = useLoaderData<typeof loader>();
  return (
    <RuleForm
      mode="edit"
      productTypes={productTypes}
      storeTags={storeTags}
      initial={initial}
    />
  );
}
