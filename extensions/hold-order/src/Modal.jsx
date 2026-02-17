import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Screen,
  Text,
  Button,
  Stack,
  Banner,
  TextField,
  useCartSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';

const Modal = () => {
  const api = useApi();
  const cart = useCartSubscription();
  const { getSessionToken } = api.session;
  const [draftOrderNumber, setDraftOrderNumber] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cartFull, setCartFull] = useState(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState(null);

  useEffect(() => {
    if (cart.lineItems.length > 0 || cart.customer) {
      setCartFull(true);
    } else {
      setCartFull(false);
    }
  }, [cart.lineItems.length, cart.customer]);

  const handleFetchDraft = async () => {
    if (!draftOrderNumber) {
      api.toast.show('Please enter a draft order number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Failed to get session token');
      }

      // Fetch draft order
      const response = await fetch(`https://nick.getzs.com/api/fetchDraft?name=${draftOrderNumber}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        }
      });

      if (!response.ok) {
        throw new Error("Couldn't find hold order");
      }

      const data = await response.json();
      
      if (!data.success || !data.draftOrder) {
        throw new Error('Draft order not found');
      }

      // Clear existing cart
      await api.cart.clearCart();

      if (data.draftOrder.customerID) {
        await api.cart.setCustomer({
          id: data.draftOrder.customerID,
        });
      }
        // Add line items to cart
      for (const item of data.draftOrder.lineItems) {
         api.cart.addLineItem(
          item.variant.id,
          item.quantity
        );

        // Apply any discounts if present will add later if needed
        // if (item.discount) {
        //   const lineItem = api.cart.lineItems.find(li => li.variantId === item.variant.id);
        //   if (lineItem) {
        //     await api.cart.setLineItemDiscount(
        //       lineItem.uuid,
        //       'Fixed',
        //       'Draft Order Discount',
        //       item.discount.toString()
        //     );
        //   }
        // }
      }

      // Set tax exempt status if applicable
      if (data.draftOrder.taxExempt) {
        await api.cart.setTaxExempt(true);
      }
      api.navigation.dismiss();
    } catch (error) {
      setError(error.message);
      api.toast.show(error.message, { error: true });
    } finally {
      setIsLoading(false);
    }
  };

  const holdCart = async () => {
    try {
      
      const lineItems = cart.lineItems;
      const customer = cart.customer;

      if (!lineItems || lineItems.length === 0) {
        api.toast.show('Cart must contain at least one item', { error: true });
        return;
      }

      if (!customer) {
        api.toast.show('Please select a customer first', { error: true });
        return;
      }

      const newToken = await getSessionToken();
      if (!newToken) {
        throw new Error('Failed to get session token');
      }
      
      const response = await fetch(`https://nick.getzs.com/api/createDraft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
        },
        body: JSON.stringify({
          lineItems,
          customer
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create draft order: ${response.status}`);
      }

      const data = await response.json();
      setCreatedOrderNumber(data.orderNumber);
      api.toast.show(data.orderNumber);
      api.cart.clearCart();
      setCartFull(false);
      
    } catch (error) {
      console.error('Draft order error:', error);
      api.toast.show(`Failed to create draft order: ${error.message}`, { error: true });
    }
  };
  
  return (
    <Screen
      name="Holds"
      title="Holds"
    >
    {createdOrderNumber ? (
        <>
          <Stack>
          <Text>Hold order created successfully</Text>
          </Stack>
          <Stack>
          <Text>Order Number: {createdOrderNumber}</Text>
          </Stack>
        </>
      ) : (
        <>
          {cartFull ? (
            <>
            <Stack>
              <Text>Empty the cart to load hold order</Text>
            </Stack>
            <Stack>
              <Button 
                title="Hold Cart" 
                onPress={holdCart}
              />
            </Stack>
            </>
          ) : (
            <>
              <TextField
                label="Enter the Hold Order Number"
                value={draftOrderNumber}
                onChange={setDraftOrderNumber}
                placeholder="Just the digits"
                required={true}
              />
            <Stack>
              <Button
                title={isLoading ? "Loading..." : "Load Hold Order"}
                onPress={handleFetchDraft}
                loading={isLoading}
                disabled={!draftOrderNumber || isLoading}
              />
              {error && (
                <Banner status="critical">
                  <Text>{error}</Text>
                </Banner>
              )}
            </Stack>
            </>
          )}
        </>
      )}
    </Screen>
  );
};

export default reactExtension('pos.home.modal.render', () => <Modal />);