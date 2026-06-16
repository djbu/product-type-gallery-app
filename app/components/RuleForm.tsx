import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Text,
  Box,
  Divider,
  Autocomplete,
  Tag,
  Icon,
  Banner,
  InlineError,
} from "@shopify/polaris";
import {
  PlusIcon,
  DeleteIcon,
  DragHandleIcon,
} from "@shopify/polaris-icons";

/* ---- shapes the form works with ---- */

export interface MediaItem {
  key: string;
  url: string;
  shopifyFileId: string;
  mediaType: "image" | "video";
}

export interface ConditionItem {
  key: string;
  productType: string;
  titleContains: string;
  tags: string[];
}

export interface RuleFormData {
  id?: string;
  name: string;
  priority: number;
  media: { mediaType: "image" | "video"; url: string; shopifyFileId: string }[];
  conditions: { productType: string; titleContains: string; tags: string[] }[];
}

interface Props {
  mode: "new" | "edit";
  productTypes: string[];
  storeTags: string[];
  initial?: RuleFormData;
}

let uid = 0;
const newKey = () => `k${uid++}_${Math.round(performance.now())}`;

export default function RuleForm({ mode, productTypes, storeTags, initial }: Props) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";

  const [name, setName] = useState(initial?.name ?? "");
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState<MediaItem[]>(
    (initial?.media ?? [])
      .filter((m) => m.mediaType === "image")
      .map((m) => ({ key: newKey(), mediaType: "image", url: m.url, shopifyFileId: m.shopifyFileId })),
  );
  const [videos, setVideos] = useState<MediaItem[]>(
    (initial?.media ?? [])
      .filter((m) => m.mediaType === "video")
      .map((m) => ({ key: newKey(), mediaType: "video", url: m.url, shopifyFileId: m.shopifyFileId })),
  );
  const [conditions, setConditions] = useState<ConditionItem[]>(
    (initial?.conditions ?? []).map((c) => ({
      key: newKey(),
      productType: c.productType,
      titleContains: c.titleContains,
      tags: c.tags,
    })),
  );

  const productTypeOptions = useMemo(
    () => [
      { label: "Select a product type…", value: "" },
      ...productTypes.map((t) => ({ label: t, value: t })),
    ],
    [productTypes],
  );

  const addCondition = () =>
    setConditions((c) => [
      ...c,
      { key: newKey(), productType: "", titleContains: "", tags: [] },
    ]);

  const handleSave = useCallback(() => {
    if (!name.trim()) return setError("Name is required.");
    if (conditions.length === 0)
      return setError("Add at least one condition.");
    for (const c of conditions) {
      if (!c.productType) return setError("Every condition needs a Product Type.");
    }
    setError(null);

    const payload: RuleFormData = {
      name: name.trim(),
      priority: parseInt(priority, 10) || 0,
      media: [
        ...images.map((m) => ({ mediaType: "image" as const, url: m.url, shopifyFileId: m.shopifyFileId })),
        ...videos.map((m) => ({ mediaType: "video" as const, url: m.url, shopifyFileId: m.shopifyFileId })),
      ].filter((m) => m.url.trim() || m.shopifyFileId.trim()),
      conditions: conditions.map((c) => ({
        productType: c.productType,
        titleContains: c.titleContains.trim(),
        tags: c.tags,
      })),
    };

    submit(
      { payload: JSON.stringify(payload) },
      { method: "post" },
    );
  }, [name, priority, images, videos, conditions, submit]);

  return (
    <Page
      backAction={{ content: "Gallery Rules", onAction: () => navigate("/app/rules") }}
      title={mode === "new" ? "Create gallery rule" : `Edit: ${initial?.name ?? ""}`}
      primaryAction={{ content: "Save", onAction: handleSave, loading: saving }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error && (
              <Banner tone="critical" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            )}

            {/* Rule Details */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Rule details</Text>
                <TextField
                  label="Name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                  requiredIndicator
                />
                <TextField
                  label="Priority"
                  type="number"
                  value={priority}
                  onChange={setPriority}
                  autoComplete="off"
                  helpText="Higher priority rules are evaluated first. Their media appears before lower-priority media."
                />
              </BlockStack>
            </Card>

            {/* Media */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Media</Text>
                <MediaList
                  title="Images"
                  mediaType="image"
                  items={images}
                  onChange={setImages}
                />
                <Divider />
                <MediaList
                  title="Videos"
                  mediaType="video"
                  items={videos}
                  onChange={setVideos}
                />
              </BlockStack>
            </Card>

            {/* Conditions */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Conditions</Text>
                  <Button icon={PlusIcon} onClick={addCondition}>Add condition</Button>
                </InlineStack>
                <Text as="p" tone="subdued" variant="bodySm">
                  A product matches this rule if it matches ANY condition. Within a
                  condition, Product Type, Title Contains and Tags are combined with AND.
                </Text>
                {conditions.length === 0 && (
                  <Box paddingBlock="400">
                    <Text as="p" tone="subdued">No conditions yet. Add one to get started.</Text>
                  </Box>
                )}
                {conditions.map((cond, i) => (
                  <ConditionEditor
                    key={cond.key}
                    index={i}
                    condition={cond}
                    productTypeOptions={productTypeOptions}
                    storeTags={storeTags}
                    onChange={(updated) =>
                      setConditions((cs) => cs.map((c) => (c.key === cond.key ? updated : c)))
                    }
                    onRemove={() =>
                      setConditions((cs) => cs.filter((c) => c.key !== cond.key))
                    }
                  />
                ))}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

/* ------------------------------------------------------------------ *
 * Media list with drag-and-drop ordering.
 * ------------------------------------------------------------------ */

function MediaList({
  title,
  mediaType,
  items,
  onChange,
}: {
  title: string;
  mediaType: "image" | "video";
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const add = () =>
    onChange([
      ...items,
      { key: `${mediaType}-${uid++}-${Math.round(performance.now())}`, url: "", shopifyFileId: "", mediaType },
    ]);

  const update = (key: string, patch: Partial<MediaItem>) =>
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between">
        <Text as="h3" variant="headingSm">{title}</Text>
        <Button icon={PlusIcon} onClick={add} variant="tertiary">
          {mediaType === "image" ? "Add image" : "Add video"}
        </Button>
      </InlineStack>

      {items.length === 0 && (
        <Text as="p" tone="subdued" variant="bodySm">
          No {title.toLowerCase()} yet. Paste a Shopify file URL and (recommended)
          its file ID. Drag rows to set the order shown on the storefront.
        </Text>
      )}

      <BlockStack gap="200">
        {items.map((it, i) => (
          <div
            key={it.key}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
              setDragIndex(null);
            }}
            style={{
              border: "1px solid var(--p-color-border)",
              borderRadius: "8px",
              padding: "8px",
              background: dragIndex === i ? "var(--p-color-bg-surface-hover)" : undefined,
            }}
          >
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <span style={{ cursor: "grab", display: "flex" }} aria-label="Drag to reorder">
                <Icon source={DragHandleIcon} tone="subdued" />
              </span>
              <Box width="55%">
                <TextField
                  label="File URL"
                  labelHidden
                  placeholder="https://cdn.shopify.com/…"
                  value={it.url}
                  onChange={(v) => update(it.key, { url: v })}
                  autoComplete="off"
                />
              </Box>
              <Box width="30%">
                <TextField
                  label="Shopify file ID"
                  labelHidden
                  placeholder="gid://shopify/MediaImage/…"
                  value={it.shopifyFileId}
                  onChange={(v) => update(it.key, { shopifyFileId: v })}
                  autoComplete="off"
                />
              </Box>
              <InlineStack gap="100">
                <Button
                  icon={DeleteIcon}
                  tone="critical"
                  variant="tertiary"
                  accessibilityLabel="Remove"
                  onClick={() => remove(it.key)}
                />
              </InlineStack>
            </InlineStack>
          </div>
        ))}
      </BlockStack>
    </BlockStack>
  );
}

/* ------------------------------------------------------------------ *
 * Condition editor (Product Type + Title Contains + Tags).
 * ------------------------------------------------------------------ */

function ConditionEditor({
  index,
  condition,
  productTypeOptions,
  storeTags,
  onChange,
  onRemove,
}: {
  index: number;
  condition: ConditionItem;
  productTypeOptions: { label: string; value: string }[];
  storeTags: string[];
  onChange: (c: ConditionItem) => void;
  onRemove: () => void;
}) {
  return (
    <Box
      padding="400"
      borderColor="border"
      borderWidth="025"
      borderRadius="200"
    >
      <BlockStack gap="300">
        <InlineStack align="space-between">
          <Text as="h3" variant="headingSm">Condition {index + 1}</Text>
          <Button icon={DeleteIcon} tone="critical" variant="tertiary" onClick={onRemove}>
            Remove
          </Button>
        </InlineStack>

        <Select
          label="Product Type"
          options={productTypeOptions}
          value={condition.productType}
          onChange={(v) => onChange({ ...condition, productType: v })}
          requiredIndicator
        />
        {!condition.productType && (
          <InlineError message="Product Type is required" fieldID={`pt-${index}`} />
        )}

        <TextField
          label="Title contains"
          value={condition.titleContains}
          onChange={(v) => onChange({ ...condition, titleContains: v })}
          autoComplete="off"
          helpText="Optional. Case-insensitive."
        />

        <TagMultiSelect
          storeTags={storeTags}
          selected={condition.tags}
          onChange={(tags) => onChange({ ...condition, tags })}
        />
      </BlockStack>
    </Box>
  );
}

function TagMultiSelect({
  storeTags,
  selected,
  onChange,
}: {
  storeTags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const deselectedOptions = useMemo(
    () => storeTags.map((t) => ({ label: t, value: t })),
    [storeTags],
  );
  const [options, setOptions] = useState(deselectedOptions);

  const updateText = useCallback(
    (value: string) => {
      setInput(value);
      if (value === "") return setOptions(deselectedOptions);
      const filterRegex = new RegExp(value, "i");
      setOptions(deselectedOptions.filter((o) => o.label.match(filterRegex)));
    },
    [deselectedOptions],
  );

  const removeTag = (tag: string) => () =>
    onChange(selected.filter((t) => t !== tag));

  const textField = (
    <Autocomplete.TextField
      label="Product Tags"
      labelHidden={false}
      value={input}
      onChange={updateText}
      placeholder="Search tags…"
      autoComplete="off"
      helpText="Optional. Product must have ALL selected tags."
      verticalContent={
        selected.length > 0 ? (
          <InlineStack gap="100">
            {selected.map((t) => (
              <Tag key={t} onRemove={removeTag(t)}>{t}</Tag>
            ))}
          </InlineStack>
        ) : undefined
      }
    />
  );

  return (
    <Autocomplete
      allowMultiple
      options={options}
      selected={selected}
      textField={textField}
      onSelect={(sel) => {
        onChange(sel);
        setInput("");
        setOptions(deselectedOptions);
      }}
      listTitle="Store tags"
    />
  );
}
