import { authenticate } from "../shopify.server";

const VARIANT_QUERY = `#graphql
  query GetVariant($query: String!) {
    productVariants(first: 1, query: $query) {
      edges {
        node {
          id
          title
          barcode
          price
          product {
            title
          }
          inventoryItem {
            unitCost {
              amount
            }
          }
        }
      }
    }
  }
`;

function convertCostToCode(cost) {
  const numberMap = ['E', 'J', 'O', 'R', 'M', 'A', 'K', 'U', 'L', 'D'];

  // Ensure cost is a number and has exactly two decimal places
  const formattedCost = parseFloat(cost).toFixed(2);
  
  // Convert cost to string and remove decimal point
  const costString = formattedCost.replace('.', '');
  var previousLetter = 'Z';
  var currentLetter = 'Z';
  var result = '';

  for(var i = 0; i < costString.length; i++){
    currentLetter = numberMap[costString[i]];
    if(currentLetter === previousLetter){
      result += 'S';
      previousLetter = 'Z';
    }else{
      result += currentLetter;
      previousLetter = currentLetter;
    }
  }
  return result;
}

export const loader = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    return null;
};

export const action = async ({ request }) => {
    try {
        const { admin } = await authenticate.admin(request);
        const { barcode } = await request.json(); // Changed to get barcode from request body

        if (!barcode) {
            return new Response(
                JSON.stringify({
                    status: "error",
                    message: "Missing barcode parameter",
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        const queryString = `barcode:${barcode}`;

        const graphqlQuery = await admin.graphql(VARIANT_QUERY, {
            variables: { query: queryString },
        });

        const data = await graphqlQuery.json();
        const variant = data?.data?.productVariants?.edges?.[0]?.node;

        if (!variant) {
            return new Response(
                JSON.stringify({
                    status: "error",
                    message: "No variant found with this barcode",
                }),
                {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        const cost = variant.inventoryItem?.unitCost?.amount;
        const costCode = convertCostToCode(cost);

        return new Response(
            JSON.stringify({
                status: "success",
                message: "Variant found",
                data: {
                    productTitle: variant.product.title,
                    barcode: variant.barcode,
                    price: variant.price,
                    costCode: costCode,
                },
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (error) {
        console.error('Error in queryCost:', error);
        return new Response(
            JSON.stringify({
                status: "error",
                message: error.message || "An error occurred while querying the cost",
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
