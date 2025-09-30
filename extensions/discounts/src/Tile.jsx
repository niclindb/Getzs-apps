import React, { useEffect, useRef, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  Tile,
  useCartSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';

const DISCOUNT_LABEL = 'Discount';

const SmartGridTile = () => {
  const api = useApi();
  const cart = useCartSubscription();
  const { getSessionToken } = api.session;

  const processedItemsRef = useRef(new Set());
  const debounceTimeoutRef = useRef(null);

  const checkAndApplyDiscounts = useCallback(async () => {
    try {
      const newToken = await getSessionToken();
      if (!newToken) {
        throw new Error('Failed to get session token');
      }

      const unprocessedItems = cart.lineItems.filter(
        (item) =>
          !processedItemsRef.current.has(item.uuid) &&
          !(item.discounts && item.discounts.length > 0)
      );
      if (unprocessedItems.length === 0) return;
      await Promise.all(
        unprocessedItems.map(async (item) => {
          try {
            const url = `https://nick.getzs.com/api/getDiscounts?productId=${item.productId}`;
            const response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to check discounts for product ${item.productId}`);
            }

            const data = await response.json();

            if (data.success && data.discount > 0) {
              await api.cart.setLineItemDiscount(
                item.uuid,
                'Percentage',
                DISCOUNT_LABEL,
                data.discount.toString()
              );
              processedItemsRef.current.add(item.uuid);
            }
          } catch (error) {
            console.error(`Error processing item ${item.productId}:`, error);
          }
        })
      );
    } catch (error) {
      console.error('Error applying discounts:', error);
    }
  }, [api.cart, cart.lineItems, getSessionToken]);

  const debounceCheckAndApply = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      checkAndApplyDiscounts();
    }, 1);
  }, [checkAndApplyDiscounts]);

  const apply20PercentDiscount = async () => {
    try {
      for (const item of cart.lineItems) {
        const hasDiscounts = item.discounts && item.discounts.length > 0;
        if (hasDiscounts) continue;

        const isCarhartt =
          item.title && item.title.toLowerCase().startsWith('carhartt');

        const discount = isCarhartt ? '10' : '20';

        await api.cart.setLineItemDiscount(
          item.uuid,
          'Percentage',
          'Badge Discount',
          discount
        );

      }
    } catch (error) {
      console.error('Error applying manual discount:', error);
    }
  };

  useEffect(() => {
    if (cart.lineItems.length === 0) {
      processedItemsRef.current.clear();
      return;
    }

    debounceCheckAndApply();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [cart.lineItems, debounceCheckAndApply]);

  return (
    <Tile
      title="Discounts"
      subtitle="Click to apply 20% off (10% for Carhartt)"
      onPress={apply20PercentDiscount}
      enabled
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <SmartGridTile />);
