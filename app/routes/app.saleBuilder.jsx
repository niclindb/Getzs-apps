import { useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import {
    Page,
    Layout,
    Card,
    TextField,
    Button,
    Spinner,
    DataTable,
    Checkbox,
    Banner,
    Select,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "apply") {
        const selectedProducts = JSON.parse(formData.get("selectedProducts"));
        const saleTag = formData.get("saleTag");
        let successCount = 0;
        let failedProducts = [];

        // Apply tags to each selected product
        for (const productId of selectedProducts) {
            try {
                // First, get the current tags
                const getProductResponse = await admin.graphql(`
                    query getProduct($id: ID!) {
                        product(id: $id) {
                            id
                            title
                            tags
                        }
                    }
                `, {
                    variables: {
                        id: productId
                    }
                });

                const productData = await getProductResponse.json();
                const currentTags = productData.data.product.tags;
                const productTitle = productData.data.product.title;

                // Then update with both current tags and new sale tag
                const updateResponse = await admin.graphql(`
                    mutation productUpdate($input: ProductInput!) {
                        productUpdate(input: $input) {
                            product {
                                id
                                tags
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }
                `, {
                    variables: {
                        input: {
                            id: productId,
                            tags: [...currentTags, saleTag]
                        }
                    }
                });

                const updateData = await updateResponse.json();
                
                if (updateData.data.productUpdate.userErrors.length > 0) {
                    failedProducts.push({
                        title: productTitle,
                        errors: updateData.data.productUpdate.userErrors
                    });
                } else {
                    successCount++;
                }
            } catch (error) {
                failedProducts.push({
                    title: "Unknown Product",
                    errors: [{ message: error.message }]
                });
            }
        }

        return new Response(
            JSON.stringify({ 
                success: true,
                message: `Successfully applied sale tag to ${successCount} products${failedProducts.length > 0 ? `, ${failedProducts.length} failed` : ''}`,
                failedProducts: failedProducts.length > 0 ? failedProducts : undefined
            }), 
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }

    // Original search logic
    const vendor = formData.get("vendor");
    const searchTags = formData.get("searchTags")?.split(",").filter(Boolean);
    const excludeTags = formData.get("excludeTags")?.split(",").filter(Boolean);
    const saleTag = formData.get("saleTag");
    const productType = formData.get("productType");

    console.log("productType", productType);
        let queryConditions = [];
        if (vendor) {
            queryConditions.push(`vendor:'${vendor}'`);
        }
    if (productType) {
        queryConditions.push(`product_type:'${productType}'`);
    }
        if (searchTags && searchTags.length > 0) {
            queryConditions.push(`(${searchTags.map(tag => `tag:'${tag}'`).join(' AND ')})`);
        }
        if (excludeTags && excludeTags.length > 0) {
            queryConditions.push(`(${excludeTags.map(tag => `-tag:'${tag}'`).join(' AND ')})`);
        }

    const queryString = queryConditions.join(' AND ');
    console.log("queryString", queryString);
    let hasNextPage = true;
    let currentCursor = null;
    let allProducts = [];

    while (hasNextPage) {
        const response = await admin.graphql(`
        query searchProducts($query: String!, $cursor: String) {
            products(first: 250, after: $cursor, query: $query) {
                    edges {
                        node {
                            id
                            title
                            tags
                        variants(first: 1) {
                            edges {
                                node {
                                    sku
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
            }
        `, {
            variables: { 
                query: queryString,
                cursor: currentCursor 
            }
        });

        const responseJson = await response.json();
        const products = responseJson.data.products.edges.map(edge => ({
            ...edge.node,
            sku: edge.node.variants.edges[0]?.node.sku || ''
        }));
        allProducts = [...allProducts, ...products];
        
        hasNextPage = responseJson.data.products.pageInfo.hasNextPage;
        currentCursor = responseJson.data.products.pageInfo.endCursor;
    }

    return new Response(
        JSON.stringify({ 
            products: allProducts,
            stage: "select",
            saleTag
        }), 
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
};

export default function SaleBuilder() {
    const fetcher = useFetcher();
    const [formData, setFormData] = useState({
        vendor: "",
        productType: "",
        searchTags: "",
        excludeTags: "",
        saleTag: "",
    });
    const [selectedProducts, setSelectedProducts] = useState(new Set());
    const [applyStatus, setApplyStatus] = useState(null);
    
    // Add effect to select all products by default when they are loaded
    useEffect(() => {
        if (fetcher.data?.products) {
            const allProductIds = new Set(fetcher.data.products.map(product => product.id));
            setSelectedProducts(allProductIds);
        }
    }, [fetcher.data?.products]);

    // Add effect to handle apply response
    useEffect(() => {
        if (fetcher.data?.success) {
            setApplyStatus({
                type: fetcher.data.failedProducts ? "warning" : "success",
                message: fetcher.data.message,
                failedProducts: fetcher.data.failedProducts
            });
            // Clear selection after successful apply
            setSelectedProducts(new Set());
        }
    }, [fetcher.data?.success]);

    const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
    const handleChange = (field) => (value) =>
    setFormData({ ...formData, [field]: value });
    const handleSubmit = (event) => {
        if (!formData.saleTag) {
            event.preventDefault(); // Prevent form submission
            setApplyStatus({
                type: "critical",
                message: "Please select a sale percentage before searching"
            });
            return;
        }
        
        setFormData((prev) => ({ ...prev, cursor: null }));
        setApplyStatus(null);
        fetcher.submit(formData, { method: "post" });
    };

    const handleApplyTags = () => {
        if (selectedProducts.size === 0) {
            return;
        }
        setApplyStatus(null);
        fetcher.submit(
            {
                intent: "apply",
                selectedProducts: JSON.stringify(Array.from(selectedProducts)),
                saleTag: formData.saleTag,
            },
            { method: "post" }
        );
    };

    const products = fetcher.data?.products || [];
    const tableRows = products.map(product => [
        <Checkbox
            label=""
            checked={selectedProducts.has(product.id)}
            onChange={(checked) => {
                const newSelected = new Set(selectedProducts);
                if (checked) {
                    newSelected.add(product.id);
                } else {
                    newSelected.delete(product.id);
                }
                setSelectedProducts(newSelected);
            }}
        />,
        product.title,
        product.sku
    ]);

    const saleOptions = [
        {label: 'Select a percentage', value: ''},
        {label: '10% off', value: 'JE'},
        {label: '20% off', value: 'OE'},
        {label: '25% off', value: 'OA'},
        {label: '30% off', value: 'RE'},
        {label: '40% off', value: 'ME'},
        {label: '50% off', value: 'AE'},
        {label: '60% off', value: 'KE'},
        {label: '70% off', value: 'UE'},
    ];

    return (
        <Page title="Sale Builder">
            <Layout>
                <Layout.Section>
                    <Card sectioned>
                        <fetcher.Form method="post" onSubmit={handleSubmit}>
                            <TextField
                                label="Enter the Brand:"
                                value={formData.vendor}
                                onChange={handleChange("vendor")}
                                name="vendor"
                            />
                            <TextField
                                label="Enter the Type:"
                                value={formData.productType}
                                onChange={handleChange("productType")}
                                name="productType"  
                            />
                            <TextField
                                label="Search Tags:"
                                value={formData.searchTags}
                                onChange={handleChange("searchTags")}
                                placeholder="seperated by commas"
                                name="searchTags"
                            />
                            <TextField
                                label="Exclude Tags:"
                                value={formData.excludeTags}
                                onChange={handleChange("excludeTags")}
                                placeholder="seperated by commas"
                                name="excludeTags"
                            />
                            <Select
                                label="Sale Percentage:"
                                options={saleOptions}
                                value={formData.saleTag}
                                onChange={handleChange("saleTag")}
                                name="saleTag"
                                required
                            />
                            <Button submit disabled={isLoading}>
                                {isLoading ? <Spinner size="small" /> : "Submit"}
                            </Button>
                        </fetcher.Form>
                    </Card>
                </Layout.Section>

                {fetcher.data && (
                    <Layout.Section>
                        <Card title="Found Products" sectioned>
                            {products.length === 0 && !fetcher.data.success ? (
                                <p>No products match your search.</p>
                            ) : fetcher.data.success ? (
                                <Banner status="success">
                                    {fetcher.data.message}
                                </Banner>
                            ) : (
                                <>
                                    {applyStatus && (
                                        <div style={{ marginBottom: "1rem" }}>
                                            <Banner status={applyStatus.type}>
                                                {applyStatus.message}
                                            </Banner>
                                            {applyStatus.failedProducts && (
                                                <div style={{ marginTop: "1rem" }}>
                                                    <p><strong>Failed Products:</strong></p>
                                                    <ul>
                                                        {applyStatus.failedProducts.map((product, index) => (
                                                            <li key={index}>
                                                                {product.title}: {product.errors.map(error => error.message).join(", ")}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <Banner status="info">
                                            {selectedProducts.size} products selected
                                        </Banner>
                                        <Button
                                            primary
                                            disabled={selectedProducts.size === 0}
                                            onClick={handleApplyTags}
                                        >
                                            Apply Sale Tag
                                        </Button>
                                    </div>
                                    <DataTable
                                        columnContentTypes={[
                                            "text",
                                            "text",
                                            "text",
                                        ]}
                                        headings={[
                                            "Select",
                                            "Title",
                                            "SKU",
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
