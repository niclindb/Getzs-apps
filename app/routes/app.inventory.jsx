import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  Layout,
  Card,
  TextField,
  Text,
  Banner
} from "@shopify/polaris";
import { Form, useActionData, useSubmit } from "@remix-run/react";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    return null;
};

export const action = async ({ request }) => {
    const { admin } = await authenticate.admin(request);
    const formData = Object.fromEntries(await request.formData());
    const { barcode } = formData;
    
    console.log('Scanned barcode:', barcode);
    
    // You can add validation here
    if (!barcode) {
        return { error: "No barcode scanned" };
    }

    return {
        success: true,
        barcode,
        timestamp: new Date().toISOString()
    };
};

export default function Inventory() {
    const [formData, setFormData] = useState({ barcode: "" });
    const actionData = useActionData();
    const submit = useSubmit();

    const handleChange = (value) => {
        if (value.includes('\n')) {
            const cleanBarcode = value.replace('\n', '').trim();
            if (cleanBarcode) {
                submit({ barcode: cleanBarcode }, { method: "post" });
            }
        } else {
            setFormData({ barcode: value });
        }
    };

    // Add this effect to clear the input after successful submission
    useEffect(() => {
        if (actionData?.success) {
            setFormData({ barcode: "" });
        }
    }, [actionData]);

    return (
        <Layout>
            <Layout.Section>
                <Card sectioned>
                    <Form method="post">
                        <TextField
                            type="text"
                            label="Scan Barcode"
                            value={formData.barcode}
                            onChange={handleChange}
                            name="barcode"
                            autoComplete="off"
                            autoFocus
                        />
                    </Form>

                    {actionData?.error && (
                        <Banner status="critical">
                            <Text>{actionData.error}</Text>
                        </Banner>
                    )}

                    {actionData?.success && (
                        <Banner status="success">
                            <Text>Scanned barcode: {actionData.barcode}</Text>
                            <Text>Time: {actionData.timestamp}</Text>
                        </Banner>
                    )}
                </Card>
            </Layout.Section>
        </Layout>
    );
}
