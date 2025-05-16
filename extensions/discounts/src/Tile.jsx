import React, { useState, useEffect } from 'react'
import {
  reactExtension,
  useApi,
  Tile,
  useCartSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';

const SmartGridTile = () => {
  const api = useApi();
  const cart = useCartSubscription();
  const { getSessionToken } = api.session;

  const checkAndApplyDiscounts = async () => {
    try {
      const newToken = await getSessionToken();
      if (!newToken) {
        throw new Error('Failed to get session token');
      }

      // Check each line item for discounts
      for (const item of cart.lineItems) {
        if (item.discounts && item.discounts.length > 0) {
          continue;
        } 
        const url = `https://nick.getzs.com/api/getDiscounts?productId=${item.productId}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${newToken}`,
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to check discounts for product ${item.productId}`);
        }

        const data = await response.json();
        
        if (data.success && data.discount > 0) {
            api.cart.setLineItemDiscount(item.uuid, 'Percentage', 'Discount', data.discount.toString());
        }
      }
      
    } catch (error) {
      console.error('Error applying discounts:', error);
    }
  };

  const apply20PercentDiscount = async () => {
    try {
      for (const item of cart.lineItems) {
        if (item.discounts && item.discounts.length > 0) {
          continue;
        }else {
	        if (item.title && item.title.toLowerCase().startsWith('carhartt')) {
            api.cart.setLineItemDiscount(item.uuid, 'Percentage', 'Discount', '10');
          } else {
            api.cart.setLineItemDiscount(item.uuid, 'Percentage', 'Discount', '20');
          }
        }
      }
    } catch (error) {
      console.error('Error applying discounts:', error);
    }
  };

  // Run checkAndApplyDiscounts whenever cart changes
  useEffect(() => {
    if (cart.lineItems.length > 0) {
      checkAndApplyDiscounts();
    }
  }, [cart]);

  return (
    <Tile 
      title='Discounts' 
      subtitle='Click to apply 20% off excluding Carhartt'
      onPress={apply20PercentDiscount}
      enabled
    />  
  );
};

export default reactExtension(
  'pos.home.tile.render',
  () => <SmartGridTile />
);
