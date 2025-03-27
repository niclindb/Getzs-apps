import React from 'react'

import { Tile, reactExtension, useApi, useCartSubscription} from '@shopify/ui-extensions-react/point-of-sale'

const TileComponent = () => {
  const api = useApi();
  const { currentSession, getSessionToken } = api.session;
  const cart = useCartSubscription();
  return (
<Tile
          title="Hold Order"
          onPress={async () => {
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
              
              const url = `${process.env.APP_URL}/api/createDraft`;
              const response = await fetch(url, {
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
                throw new Error(`Failed to create draft order: ${response.statusText}`);
              }
              
              api.toast.show('Draft order created successfully');
              api.cart.clearCart();
            } catch (error) {
              console.error('Draft order error:', error);
              api.toast.show(`Failed to create draft order: ${error.message}`, { error: true });
            }
          }}
          enabled
        />
  )
}

export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})