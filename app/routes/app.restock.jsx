import { useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Spinner,
  DataTable,
} from "@shopify/polaris";
import { PrintIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = Object.fromEntries(await request.formData());
  const { Brand, Gender } = formData;

  let queryString = "inventory_total:>0";

  if (Brand) queryString += ` AND vendor:${Brand}*`;
  if (Gender) queryString +=  ` AND tag:${Gender}`;

  let allVariants = [];
  let hasNextPage = true;
  let currentCursor = null;

  // Fetch all pages
  while (hasNextPage) {
    const graphqlQuery = await admin.graphql(
      `#graphql
      query GetProducts($query: String!, $cursor: String) {
        products(first: 250, after: $cursor, query: $query) {
          edges {
            cursor
            node {
              id
              title
              variants(first: 200) {
                edges {
                  node {
                    id
                    title
                    sku
                    selectedOptions {
                      name
                      value
                    }
                    inventoryItem {
                      inventoryLevels(first: 2) {
                        edges {
                          node {
                            location {
                              name
                            }
                            quantities(names: ["available"]) {
                              quantity
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      { variables: { query: queryString, cursor: currentCursor } }
    );

    const data = await graphqlQuery.json();
    const products = data?.data?.products || {};
    
    const pageVariants = products.edges.flatMap((product) =>
      product.node.variants.edges.map((variant) => ({
        productTitle: product.node.title,
        selectedOptions: variant.node.selectedOptions,
        sku: variant.node.sku,
        inventoryLevels: variant.node.inventoryItem.inventoryLevels.edges,
      }))
    );

    allVariants = [...allVariants, ...pageVariants];
    hasNextPage = products.pageInfo.hasNextPage;
    currentCursor = products.pageInfo.endCursor;
  }

  return {
    allVariants,
    hasNextPage: false,
    endCursor: null,
  };
};

export default function FormQuery() {
  const fetcher = useFetcher();
  const [formData, setFormData] = useState({
    Brand: "",
    Gender: "",
    NOP: "",
    cursor: null,
  });
  const [paginationLoading, setPaginationLoading] = useState(false);

  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const handleChange = (field) => (value) =>
    setFormData({ ...formData, [field]: value });

  const handleSubmit = () => {
    setFormData((prev) => ({ ...prev, cursor: null }));
    fetcher.submit(formData, { method: "post" });
  };

  const printTable = () => {
    const tableContent = document.querySelector("table").outerHTML;
    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
      <html>
        <head>
          <title>Print Refill</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            // th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>${tableContent}</body>
      </html>
    `);
    newWindow.document.close();
    newWindow.print();
  };

  const allVariants = fetcher.data?.allVariants || [];
  const hasNextPage = fetcher.data?.hasNextPage;

  const { NOP } = formData;
  const num = parseInt(NOP, 10);

  const locationNames =
    allVariants[0]?.inventoryLevels.slice(0, 2).map(
      (level) => level.node.location?.name || "-"
    ) || ["Floor", "Warehouse"];

  const tableRows = allVariants
    .filter((variantData) => {
      const locations = variantData.inventoryLevels.slice(0, 2);
      const quantity1 = locations[0]?.node?.quantities?.[0]?.quantity || 0;
      const quantity2 = locations[1]?.node?.quantities?.[0]?.quantity || 0;
      
      return quantity1 < num && quantity2 > 0;
    })
    .map((variantData) => {
      const locations = variantData.inventoryLevels.slice(0, 2);
      const option1 = variantData.selectedOptions.find(
        (option) => option.name === "Color"
      )?.value;
      const option2 = variantData.selectedOptions.find(
        (option) => option.name === "Size"
      )?.value;

      const quantity1 = locations[0]?.node?.quantities?.[0]?.quantity || 0;
      const quantity2 = locations[1]?.node?.quantities?.[0]?.quantity || 0;

      return [
        variantData.productTitle,
        variantData.sku || "-",
        option1 || "-",
        option2 || "-",
        quantity1,
        quantity2,
      ];
    });

  return (
    <Page title="Create Refill">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <fetcher.Form method="post">
              <TextField
                label="Enter the Brand:"
                value={formData.Brand}
                onChange={handleChange("Brand")}
                placeholder="Brand:"
                name="Brand"
                required
              />
              <TextField
                label="Gender:"
                value={formData.Gender}
                onChange={handleChange("Gender")}
                placeholder="Searches tag (combine with AND/OR)"
                name="Gender"
              />
              <TextField
                type="number"
                label="How many items do you want on the floor"
                value={formData.NOP}
                onChange={handleChange("NOP")}
                placeholder="NOP:"
                name="NOP"
              />
              <Button submit disabled={isLoading} onClick={handleSubmit}>
                {isLoading ? <Spinner size="small" /> : "Submit"}
              </Button>
            </fetcher.Form>
          </Card>
        </Layout.Section>

        {fetcher.data && (
          <Layout.Section>
            <Card title="Product Variants" sectioned>
              {allVariants.length === 0 ? (
                <p>No products match your search.</p>
              ) : (
                <>
                  <div style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginTop: "20px",
                  }}>
                    <Button
                      onClick={printTable}
                      icon={PrintIcon}
                      alignment="right"
                    >
                      Print Refill
                    </Button>
                  </div>
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                      "numeric",
                      "numeric",
                    ]}
                    headings={[
                      "Product",
                      "SKU",
                      "Color",
                      "Size",
                      locationNames[0],
                      locationNames[1],
                    ]}
                    rows={tableRows}
                  />
                  <style jsx>{`
                    .Polaris-DataTable__TableRow:nth-child(even) {
                      background-color: #e0e0e0;
                    }
                  `}</style>
                </>
              )}
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}






