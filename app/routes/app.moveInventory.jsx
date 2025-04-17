import { useState, useEffect } from "react";
import {
    Card,
    Page,
    Layout,
    TextField,
    ButtonGroup,
    Button,
    Banner,
    Text
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { Form, useActionData, useSubmit } from "@remix-run/react";

const LOCATION_IDS = {
    warehouse: "gid://shopify/Location/76656246936",
    floor: "gid://shopify/Location/76656279704"
};

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export default function MoveInventoryPage() {
    const [selectedDirection, setSelectedDirection] = useState('floor-to-warehouse');
    const [formData, setFormData] = useState({ barcode: "" });
    const actionData = useActionData();
    const submit = useSubmit();

    const handleChange = (value) => {
        console.log('handleChange called with:', value, 'includes newline:', value.includes('\n')); // Debug raw value
        console.log('Value includes \\n:', value.includes('\n'));
        console.log('Value includes \\r:', value.includes('\r'));
        console.log('Value charCodes:', Array.from(value).map(c => c.charCodeAt(0)));
        
        if (value.includes('\n')) {
            const cleanBarcode = value.replace('\n', '').trim();
            if (cleanBarcode) {
                submit(
                    { 
                        barcode: cleanBarcode, 
                        direction: selectedDirection 
                    }, 
                    { method: "post" }
                );
            }
        } else {
            setFormData({ barcode: value });
        }
    };

    // Clear input after successful submission
    useEffect(() => {
        if (actionData?.success) {
            setFormData({ barcode: "" });
        }
    }, [actionData]);

    const getDirectionLabel = () => {
        return selectedDirection === 'floor-to-warehouse' 
            ? 'Floor → Warehouse'
            : 'Warehouse → Floor';
    };

    return (
        <Page>
            <ui-title-bar title="Move Inventory" />
            <Layout>
                <Layout.Section>
                    <Card>
                        <Form method="post">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <ButtonGroup fullWidth segmented>
                                    <Button
                                        pressed={selectedDirection === 'floor-to-warehouse'}
                                        onClick={() => setSelectedDirection('floor-to-warehouse')}
                                    >
                                        Floor → Warehouse
                                    </Button>
                                    <Button
                                        pressed={selectedDirection === 'warehouse-to-floor'}
                                        onClick={() => setSelectedDirection('warehouse-to-floor')}
                                    >
                                        Warehouse → Floor
                                    </Button>
                                </ButtonGroup>
                                
                                <TextField
                                    type="text"
                                    label="Scan Barcode"
                                    value={formData.barcode}
                                    onChange={handleChange}
                                    name="barcode"
                                    autoComplete="off"
                                    autoFocus
                                    helpText={`Moving from ${getDirectionLabel()}`}
                                />
                                <input 
                                    type="hidden" 
                                    name="direction" 
                                    value={selectedDirection} 
                                />
                            </div>
                        </Form>

                        {actionData?.error && (
                            <Banner status="critical" tone="critical">
                                <Text>{actionData.error}</Text>
                            </Banner>
                        )}

                        {actionData?.success && (
                            <Banner status="success" tone="success">
                                <Text>Product: {actionData.productTitle}</Text>
                                <Text>Variant: {actionData.variantTitle}</Text>
                                <Text>Moved: {getDirectionLabel()}</Text>
                            </Banner>
                        )}
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const barcode = formData.get("barcode");
    const direction = formData.get("direction");

    console.log('Moving inventory:', barcode, direction);

    if (!barcode) {
        return { error: "No barcode scanned" };
    }

    try {
        // First, get the variant by barcode
        const variantResponse = await admin.graphql(
            `#graphql
            query getVariantByBarcode($query: String!) {
                productVariants(first: 1, query: $query) {
                    edges {
                        node {
                            id
                            title
                            inventoryItem {
                                id
                                inventoryLevels(first: 2) {
                                    edges {
                                        node {
                                            id
                                            location {
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                            product {
                                title
                            }
                        }
                    }
                }
            }`,
            {
                variables: {
                    query: `barcode:${barcode}`
                }
            }
        );

        const variantData = await variantResponse.json();
        const variant = variantData?.data?.productVariants?.edges?.[0]?.node;

        if (!variant) {
            return { error: "Product not found with this barcode" };
        }

        // Determine source and destination locations
        const sourceLocationId = direction === 'floor-to-warehouse' ? LOCATION_IDS.floor : LOCATION_IDS.warehouse;
        const destinationLocationId = direction === 'floor-to-warehouse' ? LOCATION_IDS.warehouse : LOCATION_IDS.floor;

        // Move inventory using adjustQuantities
        const moveResponse = await admin.graphql(
            `#graphql
            mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                inventoryAdjustQuantities(input: $input) {
                    userErrors {
                        field
                        message
                    }
                    inventoryAdjustmentGroup {
                        createdAt
                        changes {
                            name
                            delta
                        }
                    }
                }
            }`,
            {
                variables: {
                    input: {
                        reason: "movement_created",
                        name: "available",
                        changes: [
                            {
                                delta: -1,
                                inventoryItemId: variant.inventoryItem.id,
                                locationId: sourceLocationId
                            },
                            {
                                delta: 1,
                                inventoryItemId: variant.inventoryItem.id,
                                locationId: destinationLocationId
                            }
                        ]
                    }
                }
            }
        );

        const result = await moveResponse.json();

        if (result.data.inventoryAdjustQuantities.userErrors.length) {
            return {
                error: result.data.inventoryAdjustQuantities.userErrors[0].message
            };
        }

        return {
            success: true,
            barcode,
            productTitle: variant.product.title,
            variantTitle: variant.title,
        };

    } catch (error) {
        console.error('Error:', error);
        return { error: error.message || "Failed to process barcode" };
    }
};
