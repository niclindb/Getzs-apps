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

const LOCATION_IDS = {
  warehouse: "gid://shopify/Location/74906370369",
  floor: "gid://shopify/Location/86051619137"
};

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

  console.log("queryString", queryString);

  let allVariants = [];
  let hasNextPage = true;
  let currentCursor = null;

  while (hasNextPage) {
    const graphqlQuery = await admin.graphql(
      `#graphql
      query GetProducts($query: String!, $cursor: String) {
        products(first: 100, after: $cursor, query: $query) {
          edges {
            cursor
            node {
              id
              title
              variants(first: 250) {
                edges {
                  node {
                    id
                    title
                    sku
                    selectedOptions {
                      name
                      value
                    }
                    metafield(namespace: "custom", key: "model_stock") {
                      value
                    }
                    inventoryItem {
                      inventoryLevels(first: 2) {
                        edges {
                          node {
                            location {
                              id
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
      product.node.variants.edges.map((variant) => {
        // Find floor and warehouse quantities using location IDs
        const floorLevel = variant.node.inventoryItem.inventoryLevels.edges.find(
          edge => edge.node.location.id === LOCATION_IDS.floor
        );
        const warehouseLevel = variant.node.inventoryItem.inventoryLevels.edges.find(
          edge => edge.node.location.id === LOCATION_IDS.warehouse
        );

        const floorQuantity = floorLevel ? floorLevel.node.quantities[0].quantity : 0;
        const warehouseQuantity = warehouseLevel ? warehouseLevel.node.quantities[0].quantity : 0;
        const modelStock = variant.node.metafield?.value || 100;

        // Only include variants that match our conditions
        if (floorQuantity < modelStock && warehouseQuantity > 0) {
          return {
            productTitle: product.node.title,
            selectedOptions: variant.node.selectedOptions,
            sku: variant.node.sku,
            floorQuantity,
            warehouseQuantity,
            modelStock,
            locationNames: {
              floor: floorLevel?.node.location.name || "Floor",
              warehouse: warehouseLevel?.node.location.name || "Warehouse"
            }
          };
        }
        return null;
      }).filter(Boolean) // Remove null entries
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
    cursor: null,
  });

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
            th { background-color: #f2f2f2; }
	    tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>${tableContent}</body>
      </html>
    `);
    newWindow.document.close();
    newWindow.print();
  };

  const allVariants = fetcher.data?.allVariants || [];
  
  // Get location names from the first variant, or use defaults
  const locationNames = allVariants[0]?.locationNames || {
    floor: "Floor",
    warehouse: "Warehouse"
  };

  const tableRows = allVariants.map((variantData) => {
    const option1 = variantData.selectedOptions.find(
      (option) => option.name === "Color"
    )?.value;
    const option2 = variantData.selectedOptions.find(
      (option) => option.name === "Size"
    )?.value;

    // Calculate how many items we need to restock
    const restockAmount = Math.min(
      variantData.modelStock - variantData.floorQuantity, // How many we need
      variantData.warehouseQuantity // How many we have available
    );

    return [
      variantData.productTitle,
      variantData.sku || "-",
      option1 || "-",
      option2 || "-",
      variantData.floorQuantity,
      variantData.warehouseQuantity,
      variantData.modelStock,
      restockAmount // Add this to the table
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
                      "numeric",
                      "numeric",
                      "numeric",
                      "numeric"
                    ]}
                    headings={[
                      "Product",
                      "SKU",
                      "Color",
                      "Size",
                      locationNames.floor,
                      locationNames.warehouse,
                      "Model Stock",
                      "Restock Amount"
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






