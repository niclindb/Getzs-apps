import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
    Card,
    Page,
    Layout,
    TextField,
    Button,
    DataTable,
    Banner,
    Text,
    Pagination,
    Loading,
    Frame
} from "@shopify/polaris";
import { Form, useActionData, useSubmit, useNavigation } from "@remix-run/react";

const ITEMS_PER_PAGE = 50; // Number of variants to show per page

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const action = formData.get("action");

    if (action === "search") {
        const query = formData.get("query");
        
        if (!query) {
            return { error: "Please provide at least one search criteria" };
        }

        try {
            let allVariants = [];
            let hasNextPage = true;
            let cursor = null;

            // Keep fetching until we have all variants
            while (hasNextPage) {
                const response = await admin.graphql(
                    `#graphql
                    query getVariants($query: String!, $cursor: String) {
                        productVariants(first: 250, query: $query, after: $cursor) {
                            edges {
                                node {
                                    id
                                    sku
                                    title
                                    product {
                                        title
                                        vendor
                                    }
                                    metafield(namespace: "custom", key: "model_stock") {
                                        value
                                    }
                                }
                                cursor
                            }
                            pageInfo {
                                hasNextPage
                            }
                        }
                    }`,
                    {
                        variables: { 
                            query,
                            cursor
                        }
                    }
                );

                const responseJson = await response.json();
                const { edges, pageInfo } = responseJson.data.productVariants;
                
                // Add variants from this page
                const variants = edges.map(edge => ({
                    ...edge.node,
                    currentModelStock: edge.node.metafield?.value || 1
                }));
                
                allVariants = [...allVariants, ...variants];
                
                // Update for next iteration
                hasNextPage = pageInfo.hasNextPage;
                cursor = edges[edges.length - 1]?.cursor;

                // Add a small delay to avoid rate limits
                if (hasNextPage) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (allVariants.length === 0) {
                return { error: "No variants found matching your search criteria" };
            }

            return {
                success: true,
                variants: allVariants,
                message: `Found ${allVariants.length} variants`
            };

        } catch (error) {
            console.error('Search error:', error);
            return { error: error.message || "Failed to search variants" };
        }
    }

    if (action === "update") {
        const updatesJson = formData.get("updates");
        if (!updatesJson) {
            return { error: "No updates provided" };
        }

        try {
            const updates = JSON.parse(updatesJson);
            let successCount = 0;
            let errorCount = 0;

            // Process updates in batches of 25
            for (let i = 0; i < updates.length; i += 25) {
                const batch = updates.slice(i, i + 25);
                
                const response = await admin.graphql(
                    `#graphql
                    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                        metafieldsSet(metafields: $metafields) {
                            metafields {
                                key
                                namespace
                                value
                            }
                            userErrors {
                                field
                                message
                                code
                            }
                        }
                    }`,
                    {
                        variables: {
                            metafields: batch.map(update => ({
                                key: "model_stock",
                                namespace: "custom",
                                ownerId: update.variantId,
                                type: "number_integer",
                                value: update.modelStock.toString()
                            }))
                        }
                    }
                );

                const responseJson = await response.json();
                
                // Check for errors
                if (responseJson.data.metafieldsSet.userErrors.length > 0) {
                    errorCount += batch.length;
                    console.error('Update errors:', responseJson.data.metafieldsSet.userErrors);
                } else {
                    successCount += responseJson.data.metafieldsSet.metafields.length;
                }

                // Add a small delay between batches
                if (i + 10 < updates.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            if (errorCount > 0) {
                return {
                    success: true,
                    message: `Updated ${successCount} variants successfully. ${errorCount} variants failed to update.`
                };
            }

            return {
                success: true,
                message: `Successfully updated model stock for ${successCount} variants`
            };

        } catch (error) {
            console.error('Update error:', error);
            return { error: error.message || "Failed to update model stocks" };
        }
    }

    return { error: "Invalid action" };
};

export default function ModelStockPage() {
    const [searchParams, setSearchParams] = useState({
        brand: '',
        tags: '',
        sku: '',
        barcode: ''
    });
    const [variants, setVariants] = useState([]);
    const [modelStocks, setModelStocks] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [totalVariants, setTotalVariants] = useState(0);
    
    const actionData = useActionData();
    const submit = useSubmit();
    const navigation = useNavigation();
    const isSearching = navigation.state === "submitting" && 
                       navigation.formData?.get("action") === "search";

    // Calculate pagination
    const totalPages = Math.ceil(totalVariants / ITEMS_PER_PAGE);
    const currentPageVariants = variants.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        if (actionData?.variants) {
            setVariants(actionData.variants);
            setTotalVariants(actionData.variants.length);
            setCurrentPage(1);
            
            // Initialize model stocks with current values
            const initialModelStocks = {};
            actionData.variants.forEach(variant => {
                initialModelStocks[variant.id] = variant.currentModelStock ?? 1;
            });
            setModelStocks(initialModelStocks);
        }
    }, [actionData]);

    const handleUpdateAll = () => {
        const updates = Object.entries(modelStocks).map(([variantId, modelStock]) => ({
            variantId,
            modelStock: parseInt(modelStock) || 1
        }));

        submit(
            { 
                action: 'update',
                updates: JSON.stringify(updates)
            },
            { method: 'post' }
        );
    };

    const updateModelStock = (variantId, value) => {
        setModelStocks(prev => ({
            ...prev,
            [variantId]: value
        }));
    };

    return (
        <Frame>
            <Page title="Set Model Stock">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <Form method="post">
                                <div style={{ padding: '1rem' }}>
                                    <Layout>
                                        <Layout.Section oneQuarter>
                                            <TextField
                                                label="Brand"
                                                value={searchParams.brand}
                                                onChange={(value) => setSearchParams(prev => ({ ...prev, brand: value }))}
                                                placeholder="Search by brand..."
                                                disabled={isSearching}
                                            />
                                        </Layout.Section>
                                        <Layout.Section oneQuarter>
                                            <TextField
                                                label="Tags"
                                                value={searchParams.tags}
                                                onChange={(value) => setSearchParams(prev => ({ ...prev, tags: value }))}
                                                placeholder="Search by tags..."
                                                disabled={isSearching}
                                            />
                                        </Layout.Section>
                                        <Layout.Section oneQuarter>
                                            <TextField
                                                label="SKU"
                                                value={searchParams.sku}
                                                onChange={(value) => setSearchParams(prev => ({ ...prev, sku: value }))}
                                                placeholder="Search by SKU..."
                                                disabled={isSearching}
                                            />
                                        </Layout.Section>
                                        <Layout.Section oneQuarter>
                                            <TextField
                                                label="Barcode"
                                                value={searchParams.barcode}
                                                onChange={(value) => setSearchParams(prev => ({ ...prev, barcode: value }))}
                                                placeholder="Search by barcode..."
                                                disabled={isSearching}
                                            />
                                        </Layout.Section>
                                    </Layout>
                                    <div style={{ marginTop: '1rem' }}>
                                        <input 
                                            type="hidden" 
                                            name="action" 
                                            value="search" 
                                        />
                                        <input 
                                            type="hidden" 
                                            name="query" 
                                            value={[
                                                searchParams.brand && `vendor:${searchParams.brand}`,
                                                searchParams.tags && `tag:${searchParams.tags}`,
                                                searchParams.sku && `sku:${searchParams.sku}`,
                                                searchParams.barcode && `barcode:${searchParams.barcode}`
                                            ].filter(Boolean).join(' AND ')} 
                                        />
                                        <Button 
                                            primary 
                                            submit
                                            loading={isSearching}
                                            disabled={isSearching}
                                        >
                                            Search Variants
                                        </Button>
                                    </div>
                                </div>
                            </Form>
                        </Card>
                    </Layout.Section>

                    {isSearching && (
                        <Layout.Section>
                            <Loading />
                        </Layout.Section>
                    )}

                    {actionData?.error && (
                        <Layout.Section>
                            <Banner status="critical">
                                <Text>{actionData.error}</Text>
                            </Banner>
                        </Layout.Section>
                    )}

                    {actionData?.success && (
                        <Layout.Section>
                            <Banner status="success">
                                <Text>{actionData.message}</Text>
                            </Banner>
                        </Layout.Section>
                    )}

                    {currentPageVariants.length > 0 && (
                        <Layout.Section>
                            <Card>
                                <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text variant="headingMd">Search Results</Text>
                                    <Button 
                                        primary 
                                        onClick={handleUpdateAll}
                                        loading={navigation.state === "submitting"}
                                        disabled={navigation.state === "submitting"}
                                    >
                                        Update All Model Stocks
                                    </Button>
                                </div>
                                <DataTable
                                    columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric']}
                                    headings={[
                                        'Product',
                                        'Variant',
                                        'SKU',
                                        'Current Model Stock',
                                        'New Model Stock'
                                    ]}
                                    rows={currentPageVariants.map(variant => [
                                        variant.product.title,
                                        variant.title,
                                        variant.sku,
                                        variant.currentModelStock || 100,
                                        <TextField
                                            type="number"
                                            value={modelStocks[variant.id] ?? variant.currentModelStock ?? 1}
					    onChange={(value) => updateModelStock(variant.id, value)}
                                            min={1}
                                            disabled={navigation.state === "submitting"}
                                        />
                                    ])}
                                />
                                <div style={{ padding: '1rem' }}>
                                    <Pagination
                                        hasPrevious={currentPage > 1}
                                        onPrevious={() => setCurrentPage(prev => prev - 1)}
                                        hasNext={currentPage < totalPages}
                                        onNext={() => setCurrentPage(prev => prev + 1)}
                                    />
                                </div>
                            </Card>
                        </Layout.Section>
                    )}
                </Layout>
            </Page>
        </Frame>
    );
}
