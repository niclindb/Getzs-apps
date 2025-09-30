import { useState, useEffect, useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  Layout,
  Card,
  TextField,
  Text,
  Page,
  Banner } from "@shopify/polaris";
import { Form, useActionData, useSubmit } from "@remix-run/react";

// Admin auth loader
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const pricegunMap = {
  'J': '2',
  'O': 'S',
  'R': '9',
  'M': '5',
  'A': 'T',
  'K': '3',
  'U': 'B',
  'L': '4',
  'D': 'W',
  'E': 'X',
  'S': 'O'
};

function convertToPriceGun(code, map) {
  return code
    .split('')
    .map(char => map[char] || '?') // Use '?' for unmapped characters
    .join('');
}

function convertCostToCode(cost) {
  const numberMap = ['E', 'J', 'O', 'R', 'M', 'A', 'K', 'U', 'L', 'D'];
  const formattedCost = parseFloat(cost).toFixed(2);
  const costString = formattedCost.replace('.', '');
  let result = '';
  let previousLetter = 'Z';

  for (const digit of costString) {
    const currentLetter = numberMap[Number(digit)];
    result += currentLetter === previousLetter ? 'S' : currentLetter;
    previousLetter = currentLetter === previousLetter ? 'Z' : currentLetter;
  }

  return result;
}

// Barcode submission action
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const barcode = formData.get("barcode");

  if (!barcode) {
    return { error: "No barcode scanned" };
  }
 try {
    const response = await admin.graphql(
      `#graphql
      query getVariantByBarcode($query: String!) {
        productVariants(first: 1, query: $query) {
          edges {
            node {
              id
              title
              price
              inventoryItem {
                id
                unitCost {
                  amount
                }
              }
              product {
                title
              }
            }
          }
        }
      }`,
      { variables: { query: `barcode:${barcode}` } }
    );

    const result = await response.json();
    const variant = result?.data?.productVariants?.edges?.[0]?.node;
    if (!variant) {
      return { error: "Product not found with this barcode" };
    }
  const productTitle = variant.product.title
 const price = variant.price
 const cost = variant.inventoryItem.unitCost.amount
const costCode =  convertCostToCode(cost)
const priceGunCode = convertToPriceGun(costCode, pricegunMap)
 
  return {
    success: true,
    productTitle,
    costCode,
    price,
    priceGunCode,	
  };
 } catch (error) {
    console.error("Error:", error);
    return { error: error.message || "Failed to process barcode" };
  }

};

export default function PriceProductPage() {
  const [formData, setFormData] = useState("");
  const actionData = useActionData();
  const submit = useSubmit();

  const handleChange = useCallback(
    (value) => {
      if (value.includes("\n")) {
        const cleanBarcode = value.replace(/\n/g, "").trim();
        if (cleanBarcode) {
          const form = new FormData();
          form.append("barcode", cleanBarcode);
          submit(form, { method: "post" });
        }
      } else {
        setFormData(value);
      }
    },
    [submit]
  );

  useEffect(() => {
    if (actionData?.success) {
      setFormData("");
    }
  }, [actionData]);

  return (
    <Page>
      <ui-title-bar title="Price Product" />
      <Layout>

        {/* Barcode Input */}
        <Layout.Section>
          <Card>
            <div style={{ padding: "1rem" }}>
              <Form method="post">
                <TextField
                  type="text"
                  label="Scan Barcode"
                  value={formData}
                  onChange={handleChange}
                  name="barcode"
                  autoComplete="off"
                  autoFocus
                />
              </Form>

              {actionData?.error && (
                <div style={{ marginTop: "1rem" }}>
                  <Banner status="critical">
                    <Text>{actionData.error}</Text>
                  </Banner>
                </div>
              )}
            </div>
          </Card>
        </Layout.Section>

        {/* Success Response */}
        {actionData?.success && (
          <Layout.Section>
            <Card sectioned>
              <Text variant="headingMd">{actionData.productTitle}</Text>
              <Text>Cost Code: <strong>{actionData.costCode}</strong></Text>
              <Text>Price: <strong>${actionData.price}</strong></Text>
              <Text><br />Price Gun Conversion: {actionData.priceGunCode}</Text>
            </Card>
          </Layout.Section>
        )}
        
      </Layout>
    </Page>
  );
}




