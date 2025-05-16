import { authenticate } from "../shopify.server";
import { Page, Card, TextField, Button } from "@shopify/polaris";
import { useState } from "react";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export default function PriceProduct() {
    const [barcode, setBarcode] = useState('');
    const [status, setStatus] = useState(null);

    const handleSubmit = async () => {
        try {
            const response = await fetch('/api/queryCost', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ barcode })
            });

            const data = await response.json();
            setStatus(data.data.costCode);

            console.log('Response:', data);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <Page title="Price Product">
            <Card>
                <TextField
                    label="Barcode"
                    value={barcode}
                    onChange={setBarcode}
                    autoComplete="off"
                />
                <Button
                    primary
                    onClick={handleSubmit}
                >
                    Submit
                </Button>
                <p>{status}</p>
            </Card>
        </Page>
    );
}