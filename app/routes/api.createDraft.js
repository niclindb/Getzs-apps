import { authenticate } from "../shopify.server";


export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    return null;
};
export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const { lineItems, customer } = await request.json();
    
    const inputData = {
        purchasingEntity: {
            customerId: `gid://shopify/Customer/${customer.id}`
        },
        reserveInventoryUntil: "3000-01-01T00:00:01Z",
        tags: "Hold",
        lineItems: lineItems.map(item => ({
            variantId: `gid://shopify/ProductVariant/${item.variantId}`,
            quantity: item.quantity,
            // Remove discounts from input as it's not supported in DraftOrderLineItemInput
            // If needed, discounts should be applied after draft order creation
        }))
    }

    const mutation = `mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
            draftOrder {
                id   
                name
            }
            userErrors {
                field
                message
            }
        }
    }`;

    try {
        const response = await admin.graphql(
            mutation,
            {
                variables: {
                    input: inputData
                }
            }
        );

        const data = await response.json();


        if (data.data.draftOrderCreate.userErrors.length > 0) {
            return new Response(
                JSON.stringify({ success: false, errors: data.data.draftOrderCreate.userErrors }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
        }
        return new Response(
            JSON.stringify({ 
                success: true, 
                orderNumber: data.data.draftOrderCreate.draftOrder.name
            }), 
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (error) {
        console.error('Draft order creation error:', error);
        return new Response(
            JSON.stringify({ 
                success: false, 
                error: error.message || 'Failed to create draft order'
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