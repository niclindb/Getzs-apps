import { useState } from "react";
import {
    Card,
    Page,
    Layout,
    TextField,
    Button,
    Banner,
    Text,
    Frame,
    Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { Form, useActionData, useSubmit, useNavigation } from "@remix-run/react";

const LOCATION_IDS = {
    warehouse: "gid://shopify/Location/74906370369",
    floor: "gid://shopify/Location/86051619137"
};

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export default function ClearBrandPage() {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [brandName, setBrandName] = useState("");
    const actionData = useActionData();
    const submit = useSubmit();
    const navigation = useNavigation();
    const isLoading = navigation.state === "submitting";

    const handleSubmit = () => {
        setShowConfirmation(true);
    };

    const handleConfirm = () => {
        setShowConfirmation(false);
        submit(
            { brand: brandName },
            { method: "post" }
        );
    };

    return (
        <Frame>
            <Page>
                <ui-title-bar title="Clear Brand Inventory" />
                <Layout>
                    <Layout.Section>
                        <Card>
                            <Form method="post" onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmit();
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                                    <TextField
                                        label="Brand Name"
                                        value={brandName}
                                        onChange={setBrandName}
                                        helpText="Enter the exact brand name to clear inventory"
                                        autoComplete="off"
                                        disabled={isLoading}
                                    />
                                    <Button 
                                        primary 
                                        submit 
                                        loading={isLoading}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Clearing Inventory..." : "Clear Inventory"}
                                    </Button>
                                </div>
                            </Form>

                            {actionData?.error && (
                                <Banner status="critical" tone="critical">
                                    <Text>{actionData.error}</Text>
                                </Banner>
                            )}

                            {actionData?.success && (
                                <Banner status="success" tone="success">
                                    <Text>Successfully cleared inventory for {actionData.brandName}</Text>
                                    <Text>Products affected: {actionData.productsAffected}</Text>
                                    <Text>Variants cleared: {actionData.variantsCleared}</Text>
                                </Banner>
                            )}
                        </Card>
                    </Layout.Section>
                </Layout>

                {showConfirmation && (
                    <Modal
                        open={showConfirmation}
                        onClose={() => setShowConfirmation(false)}
                        title="Confirm Inventory Clear"
                        primaryAction={{
                            content: 'Confirm',
                            onAction: handleConfirm,
                            destructive: true
                        }}
                        secondaryActions={[
                            {
                                content: 'Cancel',
                                onAction: () => setShowConfirmation(false)
                            }
                        ]}
                    >
                        <Modal.Section>
                            <Text>
                                Are you sure you want to clear all inventory for products with brand "{brandName}"?
                                This action cannot be undone.
                            </Text>
                        </Modal.Section>
                    </Modal>
                )}
            </Page>
        </Frame>
    );
}

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const brandName = formData.get("brand");

    if (!brandName) {
        return { error: "Brand name is required" };
    }

    try {
        // Start a bulk operation to get all variants
        const bulkOperationResponse = await admin.graphql(
            `#graphql
            mutation createBulkOperation($query: String!) {
                bulkOperationRunQuery(
                    query: $query
                ) {
                    bulkOperation {
                        id
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`,
            {
                variables: {
                    query: `
                    {
                        products(query: "vendor:${brandName}") {
                            edges {
                                node {
                                    id
                                    title
                                    variants {
                                        edges {
                                            node {
                                                id
                                                inventoryItem {
                                                    id
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    `
                }
            }
        );

        const bulkOperation = await bulkOperationResponse.json();
        
        if (bulkOperation.data.bulkOperationRunQuery.userErrors.length > 0) {
            return { 
                error: bulkOperation.data.bulkOperationRunQuery.userErrors[0].message 
            };
        }

        // Poll for bulk operation completion
        let operationComplete = false;
        let attempts = 0;
        const maxAttempts = 30; // 5 minutes maximum waiting time
        let jsonData = null;
        
        while (!operationComplete && attempts < maxAttempts) {
            const pollResponse = await admin.graphql(
                `#graphql
                query {
                    currentBulkOperation {
                        id
                        status
                        errorCode
                        createdAt
                        completedAt
                        objectCount
                        fileSize
                        url
                        partialDataUrl
                    }
                }`
            );

            const pollData = await pollResponse.json();
            const currentOperation = pollData.data.currentBulkOperation;

            if (currentOperation.status === 'COMPLETED' && currentOperation.url) {
                operationComplete = true;
                
                // Download and process the results
                const response = await fetch(currentOperation.url);
                const textData = await response.text();
                
                // Process the JSONL data
                if (textData.trim()) {
                    jsonData = textData
                        .trim()
                        .split('\n')
                        .map(line => JSON.parse(line))
                        .filter(item => item.inventoryItem);
                }
                break;
            } else if (currentOperation.status === 'FAILED') {
                return { error: `Bulk operation failed: ${currentOperation.errorCode}` };
            }

            // Wait 10 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 10000));
            attempts++;
        }

        if (!operationComplete) {
            return { error: "Operation timed out" };
        }

        if (!jsonData || jsonData.length === 0) {
            return { error: `No products found for brand "${brandName}"` };
        }

        // Update inventory for each variant
        let variantsCleared = 0;
        
        for (const item of jsonData) {
            // First, get current inventory levels
            const inventoryResponse = await admin.graphql(
                `#graphql
                query getInventoryLevels($inventoryItemId: ID!) {
                    inventoryItem(id: $inventoryItemId) {
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
                }`,
                {
                    variables: {
                        inventoryItemId: item.inventoryItem.id
                    }
                }
            );

            const inventoryData = await inventoryResponse.json();
            const inventoryLevels = inventoryData.data.inventoryItem.inventoryLevels.edges;

            // Calculate deltas for each location
            const changes = [];
            for (const level of inventoryLevels) {
                const locationId = level.node.location.id;
                const currentQuantity = level.node.quantities[0].quantity;
                
                // Only add to changes if there's inventory to remove
                if (currentQuantity != 0) {
                    changes.push({
                        delta: -currentQuantity, // Exact amount needed to reach 0
                        inventoryItemId: item.inventoryItem.id,
                        locationId: locationId
                    });
                }
            }

            // Only make the adjustment if there are changes needed
            if (changes.length > 0) {
                const clearResponse = await admin.graphql(
                    `#graphql
                    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                        inventoryAdjustQuantities(input: $input) {
                            userErrors {
                                field
                                message
                            }
                        }
                    }`,
                    {
                        variables: {
                            input: {
                                reason: "correction",
                                name: "available",
                                changes: changes
                            }
                        }
                    }
                );

                const clearResult = await clearResponse.json();
                if (!clearResult.data.inventoryAdjustQuantities.userErrors.length) {
                    variantsCleared++;
                }
            }
        }

        return {
            success: true,
            brandName,
            productsAffected: jsonData.length,
            variantsCleared,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error:', error);
        return { error: error.message || "Failed to clear inventory" };
    }
};
