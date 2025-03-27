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
            quantity: item.quantity
        }))
    }

    const mutation = `mutation draftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
            draftOrder {
                id
                order {
                    id
                }
            }
            userErrors {
                field
                message
            }
        }
    }`;

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
            draftOrder: data.data.draftOrderCreate.draftOrder 
        }), 
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        }
    );
};