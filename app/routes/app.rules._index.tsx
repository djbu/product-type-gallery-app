import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { listRules, deleteRule } from "../services/gallery.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await listRules(session.shop);
  return json({ rules });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "delete") {
    await deleteRule(session.shop, String(form.get("id")));
  }
  return json({ ok: true });
};

export default function RulesIndex() {
  const { rules } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const handleDelete = (id: string) => {
    submit({ intent: "delete", id }, { method: "post" });
  };

  const resourceName = { singular: "rule", plural: "rules" };

  const emptyMarkup = (
    <EmptyState
      heading="Create your first gallery rule"
      action={{ content: "Create rule", onAction: () => navigate("/app/rules/new") }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Gallery rules append extra images and videos to products that match
        your conditions (product type, title, tags).
      </p>
    </EmptyState>
  );

  const rowMarkup = rules.map((rule, index) => (
    <IndexTable.Row
      id={rule.id}
      key={rule.id}
      position={index}
      onClick={() => navigate(`/app/rules/${rule.id}`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {rule.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{rule.conditionCount}</IndexTable.Cell>
      <IndexTable.Cell>{rule.imageCount}</IndexTable.Cell>
      <IndexTable.Cell>{rule.videoCount}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge>{String(rule.priority)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            variant="plain"
            onClick={() => navigate(`/app/rules/${rule.id}`)}
          >
            Edit
          </Button>{" "}
          <Button
            variant="plain"
            tone="critical"
            onClick={() => handleDelete(rule.id)}
          >
            Delete
          </Button>
        </div>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page>
      <TitleBar title="Gallery Rules">
        <button variant="primary" onClick={() => navigate("/app/rules/new")}>
          Create rule
        </button>
      </TitleBar>
      <Card padding="0">
        {rules.length === 0 ? (
          emptyMarkup
        ) : (
          <IndexTable
            resourceName={resourceName}
            itemCount={rules.length}
            selectable={false}
            headings={[
              { title: "Name" },
              { title: "Conditions" },
              { title: "Images" },
              { title: "Videos" },
              { title: "Priority" },
              { title: "Actions" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </Card>
    </Page>
  );
}
