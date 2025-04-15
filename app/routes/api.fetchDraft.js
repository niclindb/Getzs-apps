import { authenticate } from "../shopify.server";

const DRAFT_ORDER_QUERY = `#graphql
  query getDraftOrder($query: String!) {
    draftOrders(first: 1, query: $query) {
      edges {
        node {
          name
          id
          customer {
            id
          }
          lineItems(first: 250) {
            edges {
              node {
                quantity
                appliedDiscount{
                  value
                }
                variant {
                  id
                  price
                }
              }
            }
          }
          taxExempt
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const draftOrderName = url.searchParams.get("name");
    if (!draftOrderName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Draft order name is required"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const queryString = `#D${draftOrderName}`;
    
    const response = await admin.graphql(
      DRAFT_ORDER_QUERY,
      {
        variables: { query: queryString }
      }
    );

    const data = await response.json();
    const draftOrder = data?.data?.draftOrders?.edges?.[0]?.node;

    if (!draftOrder) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Draft order not found"
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Format the response data
    const formattedResponse = {
      success: true,
      draftOrder: {
        customerID: parseInt(draftOrder.customer.id.replace('gid://shopify/Customer/', '')),
        lineItems: draftOrder.lineItems.edges.map(edge => ({
          quantity: edge.node.quantity,
          variant: {
            id: parseInt(edge.node.variant.id.replace('gid://shopify/ProductVariant/', '')),
            price: edge.node.variant.price
          },
          discount: edge.node.appliedDiscount?.value ?? null
        })),
        taxExempt: draftOrder.taxExempt
      }
    };

    // Delete the draft order
    try {
      const deleteResponse = await admin.graphql(
        `#graphql
        mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
          draftOrderDelete(input: $input) {
            deletedId
          }
        }`,
        {
          variables: {
            input: {
              id: draftOrder.id
            }
          },
        }
      );

      const deleteData = await deleteResponse.json();
      if (deleteData.errors) {
        console.error('Failed to delete draft order:', deleteData.errors);
      }
    } catch (deleteError) {
      console.error('Error deleting draft order:', deleteError);
    }

    return new Response(
      JSON.stringify(formattedResponse),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error('Error fetching draft order:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}; 