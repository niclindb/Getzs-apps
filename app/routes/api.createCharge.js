import { authenticate } from "../shopify.server";


export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    return null;
};
export const action = async ({ request }) => {
    try {
        const { admin } = await authenticate.admin(request);
        const { lineItems, customer, company, taxTotal } = await request.json();
        
        // Step 1: Create Draft Order with Payment Terms
        const draftOrderInput = {
            purchasingEntity: {
                customerId: `gid://shopify/Customer/${customer.id}`
            },
            lineItems: lineItems.map(item => ({
                variantId: `gid://shopify/ProductVariant/${item.variantId}`,
                quantity: item.quantity,
                requiresShipping: false,
                appliedDiscount: item.discounts?.[0]?.amount ? {
                    valueType: "PERCENTAGE",
                    value: Math.round((parseFloat(item.discounts[0].amount) / parseFloat(item.price) * 100)),
                    description: "Product offer at checkout"
                } : null
            })),
            tags: [`${company}`, "store charge"],
            taxExempt: taxTotal <= 0,
            paymentTerms: {
                paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/4",
                paymentSchedules: [{
                    issuedAt: new Date().toISOString()
                }]
            }
        };

        const createDraftMutation = `#graphql
            mutation draftOrderCreate($input: DraftOrderInput!) {
                draftOrderCreate(input: $input) {
                    draftOrder {
                        id
                        totalPrice
                        subtotalPrice
                        taxExempt
                        lineItems(first: 10) {
                            nodes {
                                id
                                quantity
                                variant {
                                    id
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const draftResponse = await admin.graphql(
            createDraftMutation,
            {
                variables: {
                    input: draftOrderInput
                }
            }
        );

        const draftData = await draftResponse.json();
        
        // Add detailed error logging
        if (draftData.data.draftOrderCreate.userErrors.length > 0) {
            console.error('Draft order creation failed:', draftData.data.draftOrderCreate.userErrors);
            return new Response(
                JSON.stringify({ success: false, errors: draftData.data.draftOrderCreate.userErrors }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Step 2: Complete Draft Order to create actual order
        const completeDraftMutation = `#graphql
            mutation draftOrderComplete($id: ID!, $sourceName: String) {
                draftOrderComplete(
                    id: $id,
                    sourceName: $sourceName,
                ) {
                    draftOrder {
                        order {
                            id     
                            totalTaxSet {
                                shopMoney {
                                    amount
                                    currencyCode
                                }
                            }
                            taxLines {
                                rate
                                title
                                priceSet {
                                    shopMoney {
                                        amount
                                        currencyCode
                                    }
                                }
                            }
                            lineItems(first: 10) {
                                nodes {
                                    id
                                    quantity
                                    variant {
                                        id
                                    }
                                }
                            }
                        }
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const completeResponse = await admin.graphql(
            completeDraftMutation,
            {
                variables: { 
                    id: draftData.data.draftOrderCreate.draftOrder.id,
                    sourceName: "POS Charge Account"
                }
            }
        );

        const completeData = await completeResponse.json();

        if (completeData.data.draftOrderComplete.userErrors?.length > 0) {
            return new Response(
                JSON.stringify({ success: false, errors: completeData.data.draftOrderComplete.userErrors }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const order = completeData.data.draftOrderComplete.draftOrder.order;

        // Step 4: Create Fulfillment
        const getFulfillmentOrderQuery = `#graphql
            query getFulfillmentOrder($orderId: ID!) {
                order(id: $orderId) {
                    fulfillmentOrders(first: 1) {
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
            }
        `;

        const fulfillmentOrderResponse = await admin.graphql(
            getFulfillmentOrderQuery,
            {
                variables: {
                    orderId: order.id
                }
            }
        );

        const fulfillmentOrderData = await fulfillmentOrderResponse.json();
        if (!fulfillmentOrderData.data.order.fulfillmentOrders.edges.length) {
            return new Response(
                JSON.stringify({ success: false, errors: [{ message: "No fulfillment orders found" }] }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }
        const fulfillmentOrderId = fulfillmentOrderData.data.order.fulfillmentOrders.edges[0].node.id;

        const fulfillmentMutation = `#graphql
            mutation FulfillmentCreate($fulfillment: FulfillmentV2Input!) {
                fulfillmentCreateV2(fulfillment: $fulfillment) {
                    fulfillment {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const fulfillResponse = await admin.graphql(
            fulfillmentMutation,
            {
                variables: {
                    fulfillment: {
                        lineItemsByFulfillmentOrder: [{
                            fulfillmentOrderId: fulfillmentOrderId
                        }],
                        notifyCustomer: false
                    }
                }
            }
        );

        const fulfillData = await fulfillResponse.json();

        if (fulfillData.data.fulfillmentCreateV2.userErrors?.length > 0) {
            return new Response(
                JSON.stringify({ success: false, errors: fulfillData.data.fulfillmentCreateV2.userErrors }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ 
                success: true, 
                order: order,
                fulfillment: fulfillData.data.fulfillmentCreateV2.fulfillment
            }), 
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error('Error in createCharge:', error);
        return new Response(
            JSON.stringify({ success: false, errors: [{ message: error.message }] }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
