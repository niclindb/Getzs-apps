import { useState, useEffect, useCallback } from "react";
import { authenticate } from "../shopify.server";
import {
  Layout,
  Card,
  TextField,
  Text,
  Banner,
  Page,
  DataTable,
  Button,
  Icon,
  Checkbox,
  ButtonGroup
} from "@shopify/polaris";
import { Form, useActionData, useSubmit } from "@remix-run/react";
import { PrintIcon } from "@shopify/polaris-icons";

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
    const formData = await request.formData();
    const barcode = formData.get("barcode");
    const isRemoveMode = formData.get("isRemoveMode") === "true";
    const removeLocation = formData.get("removeLocation");


    if (!barcode) {
        return { error: "No barcode scanned" };
    }

    try {
        // First, find the variant and check floor quantity
        const variantResponse = await admin.graphql(
            `#graphql
            query getVariantByBarcode($query: String!) {
                productVariants(first: 1, query: $query) {
                    edges {
                        node {
                            id
                            title
                            metafield(namespace: "custom", key: "model_stock") {
                                value
                            }
                            product {
                                title
                            }
                            inventoryItem {
                                id
                                inventoryLevels(first: 2) {
                                    edges {
                                        node {
                                            location {
                                                id
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

        // Find model stock from metafield
        const modelStock = variant.metafield?.value || 100; 

        // Find floor quantity
        const floorLevel = variant.inventoryItem.inventoryLevels.edges.find(
            edge => edge.node.location.id === LOCATION_IDS.floor
        );
        const floorQuantity = floorLevel ? floorLevel.node.quantities[0].quantity : 0;

        // Determine target location and delta
        let targetLocationId;
        let delta = 1;

        if (isRemoveMode) {
            targetLocationId = removeLocation === 'warehouse' ? LOCATION_IDS.warehouse : LOCATION_IDS.floor;
            delta = -1;
        } else {
            // Original logic for adding inventory
            const sendToWarehouse = floorQuantity >= modelStock;
            targetLocationId = sendToWarehouse ? LOCATION_IDS.warehouse : LOCATION_IDS.floor;
        }

        // Update inventory adjustment mutation
        const inventoryResponse = await admin.graphql(
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
                        reason: isRemoveMode ? "correction" : "received",
                        name: "available",
                        changes: [
                            {
                                delta: delta,
                                inventoryItemId: variant.inventoryItem.id,
                                locationId: targetLocationId
                            }
                        ]
                    }
                }
            }
        );

        const inventoryData = await inventoryResponse.json();

        if (inventoryData?.data?.inventoryAdjustQuantities?.userErrors?.length > 0) {
            return { 
                error: inventoryData.data.inventoryAdjustQuantities.userErrors[0].message 
            };
        }

        return {
            success: true,
            barcode,
            productTitle: variant.product.title,
            variantTitle: variant.title,
            sentToWarehouse: targetLocationId === LOCATION_IDS.warehouse,
            isRemoveMode,
        };

    } catch (error) {
        console.error('Error:', error);
        return { error: error.message || "Failed to process barcode" };
    }
};

export default function InventoryPage() {
    const [formData, setFormData] = useState("");
    const [isRemoveMode, setIsRemoveMode] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState('floor');
    const actionData = useActionData();
    const submit = useSubmit();
    const [floorItems, setFloorItems] = useState(new Map());
    const [warehouseItems, setWarehouseItems] = useState(new Map());
    const [totalReceived, setTotalReceived] = useState(0);

    const handleChange = useCallback((value) => {
        if (value.includes('\n')) {
            const cleanBarcode = value.replace('\n', '').trim();
            if (cleanBarcode) {
                const formData = new FormData();
                formData.append('barcode', cleanBarcode);
                formData.append('isRemoveMode', isRemoveMode.toString());
                if (isRemoveMode) {
                    formData.append('removeLocation', selectedLocation);
                }
                submit(formData, { method: "post" });
            }
        } else {
            setFormData(value);
        }
    }, [isRemoveMode, selectedLocation, submit]);

    useEffect(() => {
        if (actionData?.success) {
            setFormData("");
            
            const key = `${actionData.productTitle}|${actionData.variantTitle}`;
            const delta = actionData.isRemoveMode ? -1 : 1;
            
            setTotalReceived(prev => prev + delta);
            
            const updateItems = (prev) => {
                const next = new Map(prev);
                if (next.has(key)) {
                    const existing = next.get(key);
                    const newQuantity = existing.quantity + delta;
                    if (newQuantity === 0) {
                        next.delete(key);
                    } else {
                        next.set(key, { ...existing, quantity: newQuantity });
                    }
                } else {
                    next.set(key, {
                        productTitle: actionData.productTitle,
                        variantTitle: actionData.variantTitle,
                        quantity: delta
                    });
                }
                return next;
            };

            if (actionData.sentToWarehouse) {
                setWarehouseItems(updateItems);
            } else {
                setFloorItems(updateItems);
            }
        }
    }, [actionData]);

    const handlePrint = () => {
        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Please allow pop-ups to print the inventory list.');
                return;
            }
            
            const timestamp = new Date().toLocaleString();
            
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Inventory Report - ${timestamp}</title>
                        <style>
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                                margin-bottom: 20px;
                            }
                            th, td { 
                                border: 1px solid black; 
                                padding: 8px; 
                                text-align: left; 
                            }
                            td.quantity {
                                text-align: right;
                            }
                            th { 
                                background-color: #f3f3f3; 
                            }
                            h2 { 
                                margin-top: 20px; 
                            }
                            .timestamp {
                                margin-bottom: 20px;
                                font-style: italic;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="timestamp">Inventory Received: ${timestamp}</div>
                        <h2>Floor Items</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Variant</th>
                                    <th style="text-align: right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.from(floorItems.values()).map(item => `
                                    <tr>
                                        <td>${escapeHtml(item.productTitle)}</td>
                                        <td>${escapeHtml(item.variantTitle)}</td>
                                        <td class="quantity">${item.quantity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <h2>Warehouse Items</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Variant</th>
                                    <th style="text-align: right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.from(warehouseItems.values()).map(item => `
                                    <tr>
                                        <td>${escapeHtml(item.productTitle)}</td>
                                        <td>${escapeHtml(item.variantTitle)}</td>
                                        <td class="quantity">${item.quantity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </body>
                </html>
            `);
            
            printWindow.document.close();
            printWindow.print();
        } catch (error) {
            console.error('Print error:', error);
            alert('There was an error while trying to print. Please try again.');
        }
    };

    const escapeHtml = (unsafe) => {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    const getToneColor =() => {
        if (actionData?.isRemoveMode) {
            return 'critical';
        }
        return actionData?.sentToWarehouse == true 
            ? 'warning'
            : 'success';
    };

    const renderLocationButtons = () => {
        try {            
            return (
                <ButtonGroup>
                    <Button
                        variant={selectedLocation === 'floor' ? 'primary' : 'secondary'}
                        onClick={() => {
                
                            setSelectedLocation('floor');
                        }}
                    >
                        Floor
                    </Button>
                    <Button
                        variant={selectedLocation === 'warehouse' ? 'primary' : 'secondary'}
                        onClick={() => {
                            setSelectedLocation('warehouse');
                        }}
                    >
                        Warehouse
                    </Button>
                </ButtonGroup>
            );
        } catch (e) {
            console.error('Button render error:', e);
            console.error('Error stack:', e.stack);
            return <div>Error rendering location buttons</div>;
        }
    };

    return (
        <Page>
            <ui-title-bar title="Receiving Inventory" />
            <Layout>
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                            <Form method="post">
                                <input 
                                    type="hidden" 
                                    name="isRemoveMode" 
                                    value={isRemoveMode.toString()} 
                                />
                                {isRemoveMode && (
                                    <input 
                                        type="hidden" 
                                        name="removeLocation" 
                                        value={selectedLocation} 
                                    />
                                )}
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
                            
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Checkbox
                                    label="Remove Inventory"
                                    checked={isRemoveMode}
                                    onChange={(checked) => {
                                        setIsRemoveMode(checked);
                                    }}
                                />
                                
                                {isRemoveMode && renderLocationButtons()}
                            </div>
                        </div>

                        {actionData?.error && (
                            <div style={{ padding: '0 1rem' }}>
                                <Banner status="critical" tone="critical">
                                    <Text>{actionData.error}</Text>
                                </Banner>
                            </div>
                        )}

                        {actionData?.success && (
                            <div style={{ padding: '0 1rem' }}>
                                <Banner status="success" tone={getToneColor()}>
                                    <Text>
                                        {actionData.isRemoveMode ? 'Removed from' : 'Added to'} {actionData.sentToWarehouse ? 'Warehouse' : 'Floor'}
                                    </Text>
                                    <Text>Product: {actionData.productTitle}</Text>
                                    <Text>Variant: {actionData.variantTitle}</Text>
                                </Banner>
                            </div>
                        )}
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <Page
                        title={`Scanned Items (Total: ${totalReceived})`}
                        primaryAction={
                            <Button onClick={handlePrint} icon={<Icon source={PrintIcon} />}>
                                Print
                            </Button>
                        }
                    >
                        <Layout>
                            <Layout.Section>
                                <Card>
                                    <div style={{ padding: '1rem' }}>
                                        <Text variant="headingMd" as="h2">Floor Items</Text>
                                        <DataTable
                                            columnContentTypes={['text', 'text', 'numeric']}
                                            headings={['Product', 'Variant', 'Quantity']}
                                            rows={Array.from(floorItems.values()).map(item => [
                                                item.productTitle,
                                                item.variantTitle,
                                                item.quantity
                                            ])}
                                        />
                                    </div>
                                </Card>
                            </Layout.Section>

                            <Layout.Section>
                                <Card>
                                    <div style={{ padding: '1rem' }}>
                                        <Text variant="headingMd" as="h2">Warehouse Items</Text>
                                        <DataTable
                                            columnContentTypes={['text', 'text', 'numeric']}
                                            headings={['Product', 'Variant', 'Quantity']}
                                            rows={Array.from(warehouseItems.values()).map(item => [
                                                item.productTitle,
                                                item.variantTitle,
                                                item.quantity
                                            ])}
                                        />
                                    </div>
                                </Card>
                            </Layout.Section>
                        </Layout>
                    </Page>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
