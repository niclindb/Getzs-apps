import { authenticate } from "../shopify.server";

const DISCOUNTS = {
    '70% Off': 70,
    '60% Off': 60,
    '50% Off': 50,
    '30% Off': 30,
    '25% Off': 25,
    '20% Off': 20,
    '10% Off': 10
};

export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');

    if (!productId) {
        
        return new Response(
            JSON.stringify({ 
                success: false,
                error: "Product ID is required" 
            }), 
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }

    const { admin } = await authenticate.admin(request);
    
    try {
        const graphqlProductId = String(productId).startsWith('gid://') 
            ? String(productId) 
            : `gid://shopify/Product/${productId}`;

        const response = await admin.graphql(`
            query checkProductCollections($productId: ID!) {
                product(id: $productId) {
                    id
                    collections(first: 250) {
                        edges {
                            node {
                                id
                                title
                            }
                        }
                    }
                }
            }
        `, {
            variables: {
                productId: graphqlProductId,
            }
        });

        const data = await response.json();
        const collections = data.data.product.collections.edges;
        
        // Find the highest discount in a single pass
        const highestDiscount = collections.reduce((highest, edge) => {
            const discount = DISCOUNTS[edge.node.title];
            return discount ? Math.max(highest, discount) : highest;
        }, 0);


        return new Response(
            JSON.stringify({ 
                success: true,
                discount: highestDiscount,
            }), 
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (error) {
    
        return new Response(
            JSON.stringify({ 
                success: false,
                error: error.message 
            }), 
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    }
};

// Keep the action for POST requests if needed
export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    
    return new Response(
        JSON.stringify({ 
            success: true,  
        }), 
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
};