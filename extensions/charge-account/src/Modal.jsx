import React, { useState } from 'react';
import {
  reactExtension,
  useApi,
  useCartSubscription,
  Screen,
  ScrollView,
  Text,
  Button,
  Stack,
  Banner,
  RadioButtonList,
} from '@shopify/ui-extensions-react/point-of-sale';

const SmartGridTile = () => {
  const api = useApi();
  const { currentSession, getSessionToken } = api.session;
  const cart = useCartSubscription();
  const [company, setCompany] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);


  const handleSubmit = async () => {

    if(!cart.customer) {
      api.toast.show('Please select a customer');
      return;
    }

    if(cart.lineItems.length === 0) {
      api.toast.show('Please add items to the cart');
      return;
    }

    if(!company) {
      api.toast.show('Please select a company');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const sessionToken = await getSessionToken();
      
      if (!sessionToken) {
        throw new Error('Failed to get session token');
      }

      const response = await fetch(`https://nick.getzs.com/api/createCharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          lineItems: cart.lineItems.map(item => ({
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            discounts: item.discounts || [],
            variantId: item.variantId
          })),
          taxTotal: cart.taxTotal,
          customer: cart.customer,
          company: company,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create charge');
      }

      const data = await response.json();
      api.cart.clearCart();
      if (data.success) {
        api.toast.show('Charge created successfully!');
        setSuccess(true);
      } else {
        api.toast.show('Failed to create charge');
        throw new Error('Failed to create charge');
      }
      api.modal.close();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen 
      name="ChargeAccount" 
      title="Charge Account"
      padding="base"
    >
      <ScrollView>
        <Stack align="center">
          <Text>Charge Account</Text>
        </Stack>
        <Stack align="center">
          <Button
            onPress={handleSubmit}
            title={isLoading ? "Creating Charge..." : "Create Charge"}
            loading={isLoading}
            disabled={!company || isLoading}
          >
          </Button>
        </Stack>
        <Stack>
          <RadioButtonList 
          label="Company"
          items={[
            'Eagle Mine', 
            'City of Marquette Public Works',
            'City of Marquette Waste Water', 
            'Marquette County Solid Waste',
            'Resolve Surgical', 
            'Potlatch Deltic', 
            'Dyno Nobel',
            'Superior Extrusion Inc.',
            'Michigan Rehab Services',
            'Maps',
            'City of Negaunee',
            'City of Ishpeming',
            'Ishpeming Area Waste Water',
            'Marquette Sawyer Regional Airport',
            'Marquette Charter Township',
            'Marquette DDA',
            'Marquette Board of Light & Power',
            'Marquette County Courthouse',
            "Wendrick's",
            "Abelman's Clothing",
            'Charter Township of Chocolay',
            'All About Services',
            ]}
          onItemSelected={setCompany}
          initialSelectedItem={company}
          />
        </Stack>
        <Stack>
          {!cart.customer && (
            <Banner status="info">
              <Text>Please select a customer to continue</Text>
            </Banner>
          )}

          {cart.lineItems.length === 0 && (
            <Banner status="info">
              <Text>Please add items to the cart</Text>
            </Banner>
          )}

          {error && (
            <Banner status="critical">
              <Text>{error}</Text>
            </Banner>
          )}

          {success && (
            <Banner status="success">
              <Text>Order created successfully!</Text>
            </Banner>
          )}
        </Stack>
      </ScrollView>
    </Screen>
  );
};

export default reactExtension(
  'pos.home.modal.render',
  () => <SmartGridTile />
);