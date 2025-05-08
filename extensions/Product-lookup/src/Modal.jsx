import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Screen,
  Text,
  Stack,
  Banner,
  useScannerDataSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';

const SmartGridModal = () => {
  const api = useApi();
  const { currentSession, getSessionToken } = api.session;
  const [sessionToken, setSessionToken] = useState();
  const [cost, setCost] = useState(null);
  const [productTitle, setProductTitle] = useState(null);
  const [price, setPrice] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const {data} = useScannerDataSubscription();

  useEffect(() => {
    if (data) {
      fetchData(data);
    }
  }, [data]);

  const fetchData = async (barcode) => {
    setCost(null);
    setProductTitle(null);  
    setPrice(null);
    setIsLoading(true);
    setError(null); // Reset error state at start of new request
    
    try {
      const newToken = await getSessionToken();
      
      if (!newToken) {
        throw new Error('Failed to get session token');
      }
      
      setSessionToken(newToken);
      
      const url = `https://shopify-inventory.getzs.com/nicksApp/api/queryCost`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
        },
        body: JSON.stringify({ barcode })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();

      if (!responseData.data) {
        throw new Error('No data found in response');
      }

      setCost(responseData.data.costCode || '-');
      setProductTitle(responseData.data.productTitle || '-');
      setPrice(responseData.data.price || '-');
    } catch (error) {
      setError(error);
      setProductTitle("Product not found");
      setCost('-');
      setPrice('-');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen 
      name="ScreenOne" 
      title="Product Cost Lookup"
      alignment="center"
      padding="base"
      inlineAlignment="center"
    >
      <Stack spacing="loose" alignment="center" inlineAlignment="center">
        <Stack spacing="base" alignment="center" background="surface" padding="base" inlineAlignment="center" fullWidth>
          <Text alignment="center">Product Details</Text>
          <Stack border="border" spacing="tight" fullWidth>
            <Stack alignment="center" distribute="center" inlineAlignment="center" fullWidth>
              <Stack spacing="none" alignment="center" distribute="center">
                <Text>Product Title: </Text>
                <Text alignment="center">{isLoading ? 'Loading...' : (productTitle || 'Not scanned')}</Text>
              </Stack>
            </Stack>
            <Stack alignment="center" distribute="center" inlineAlignment="center" fullWidth>
              <Stack spacing="none" alignment="center" distribute="center">
                <Text alignment="center">Cost: </Text>
                <Text alignment="center" variant="display">{isLoading ? 'Loading...' : (cost || '-')}</Text>
              </Stack>
            </Stack>
            <Stack alignment="center" distribute="center" inlineAlignment="center" fullWidth>
              <Stack spacing="none" alignment="center" distribute="center">
                <Text alignment="center">Price: </Text>
                <Text alignment="center" variant="display">{isLoading ? 'Loading...' : (price || '-')}</Text>
              </Stack>
            </Stack>
          </Stack>
        </Stack>
        
        {error && (
          <Banner status="critical" fullWidth>
            <Text alignment="center">{error.message}</Text>
          </Banner>
        )}
      </Stack>
    </Screen>
  );
};

export default reactExtension('pos.home.modal.render', () => <SmartGridModal />);

