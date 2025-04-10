import React, { useState, useEffect } from "react";
import { Page, TextField } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useFetcher } from "@remix-run/react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const variantIds = JSON.parse(formData.get("variantIds"));

  const response = await admin.graphql(
    `#graphql
    query getVariantCosts($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          inventoryItem {
            unitCost {
              amount
            }
          }
        }
      }
    }`,
    {
      variables: {
        ids: variantIds,
      },
    }
  );

  const { data } = await response.json();
  return { variantCosts: data.nodes };
};

// Add this function before the main component
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

// Add this function before the Index component
function trimTitle(title, maxLength = 25) {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

// Add this function before the Index component
function extractProductInfo(fullTitle, vendor) {
  // If no vendor or title doesn't start with vendor, return original title
  if (!vendor || !fullTitle.toLowerCase().startsWith(vendor.toLowerCase())) {
    return { description: fullTitle };
  }

  // Remove vendor from the start of the title and trim whitespace
  const titleWithoutBrand = fullTitle.slice(vendor.length).trim();
  
  // Split remaining text into parts
  const parts = titleWithoutBrand.split(' ');
  if (parts.length < 2) return { description: fullTitle }; // Return full title if not enough parts

  const sku = parts[0];
  const description = parts.slice(1).join(' ');

  return {
    brand: vendor,
    sku,
    description
  };
}

// Add this function before the Index component
function cleanSku(sku) {
  if (!sku) return '';
  return sku.split(' ')[0]; // Return only the first part before any space
}

export default function Index() {
  const [selectedResources, setSelectedResources] = useState([]);
  const [yearLetter, setYearLetter] = useState('');
  const [quantities, setQuantities] = useState({});
  const fetcher = useFetcher();

  async function pickResources() {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      options: {
        variants: true,
      }
    });
    
    // Collect all variants from selected products
    const allVariants = selected.flatMap(product => {
      console.log('Product:', product.title, 'Vendor:', product.vendor);
      const { brand, sku, description } = extractProductInfo(product.title, product.vendor);
      console.log('Extracted:', { brand, sku, description });
      return product.variants.map(variant => ({
        ...variant,
        productTitle: description,
        productBrand: brand || product.vendor || '',
        productSku: cleanSku(sku) || cleanSku(variant.sku),
        productColor: variant.title.split(' / ')[0] || '',
        productSize: variant.title.split(' / ')[1] || '',
      }));
    });

    // Fetch costs using the authenticated action
    fetcher.submit(
      { variantIds: JSON.stringify(allVariants.map(v => v.id)) },
      { method: "post" }
    );

    // Store the initial selection with the complete variant information
    const productsWithVariants = selected.map(product => {
      const { brand, sku, description } = extractProductInfo(product.title, product.vendor);
      return {
        ...product,
        variants: product.variants.map(variant => ({
          ...variant,
          productTitle: description,
          productBrand: brand || product.vendor || '',
          productSku: cleanSku(sku) || cleanSku(variant.sku),
          productColor: variant.title.split(' / ')[0] || '',
          productSize: variant.title.split(' / ')[1] || '',
        }))
      };
    });

    setSelectedResources(productsWithVariants);
  }

  // Update resources with costs when fetcher data arrives
  useEffect(() => {
    if (fetcher.data?.variantCosts && selectedResources.length > 0) {
      const costMap = new Map(
        fetcher.data.variantCosts.map(node => [
          node.id,
          node.inventoryItem?.unitCost?.amount || '0.00'
        ])
      );

      const resourcesWithCost = selectedResources.map(product => ({
        ...product,
        variants: product.variants.map(variant => ({
          ...variant,
          cost: costMap.get(variant.id) || '0.00'
        }))
      }));

      setSelectedResources(resourcesWithCost);
    }
  }, [fetcher.data, selectedResources]);

  useEffect(() => {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') return;

    // Import JsBarcode dynamically
    import('jsbarcode').then((JsBarcode) => {
      // Generate barcodes for all variants, including duplicates
      selectedResources.forEach((product) => {
        product.variants.forEach((variant) => {
          const quantity = quantities[variant.id] === undefined ? 1 : quantities[variant.id];
          // Loop through all instances of this variant's barcode
          for (let i = 0; i < quantity; i++) {
            const barcodeElement = document.getElementById(`barcode-${variant.id}-${i}`);
            if (barcodeElement && variant.barcode) {
              JsBarcode.default(barcodeElement, String(variant.barcode), {
                format: "CODE128",
                displayValue: false,
                height: 100,       // Adjust height if needed
                width: 3.8,       // Adjust width if barcodes are too thick/thin
                margin: 5,
                lineColor: "#000000",
                background: "transparent"
              });
            }
          }
        });
      });
    });
  }, [selectedResources, quantities]);

  function printLabels() {
    window.print();
  }

  // Add this new function to handle quantity changes
  const handleQuantityChange = (variantId, value) => {
    setQuantities(prev => ({
      ...prev,
      [variantId]: parseInt(value) || 0
    }));
  };

  return (
    <div>
      <div className="no-print">
        <Page title="Label Printer">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <TextField
              label="Year Letter"
              value={yearLetter}
              onChange={setYearLetter}
              maxLength={1}
              autoComplete="off"
              placeholder="Enter single letter"
              style={{ width: '100px' }}
            />
            <button onClick={pickResources}>Pick Products</button>
            <button onClick={printLabels}>Print Labels</button>
          </div>

          {/* Add quantity controls for selected products */}
          {selectedResources.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h3>Set Quantities:</h3>
              {selectedResources.map((product) =>
                product.variants.map((variant) => (
                  <div key={variant.id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{product.title} - {variant.title !== "Default Title" ? variant.title : ''}</span>
                    <TextField
                      type="number"
                      value={quantities[variant.id] === undefined ? "1" : quantities[variant.id]}
                      onChange={(value) => handleQuantityChange(variant.id, value)}
                      autoComplete="off"
                      min="0"
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </Page>
      </div>

      {/* Update the barcode container to handle multiple copies */}
      <div id="labels-container">
        {selectedResources.map((product, productIndex) =>
          product.variants.map((variant, variantIndex) => {
            const quantity = quantities[variant.id] === undefined ? 1 : quantities[variant.id];
            // Skip rendering if quantity is less than or equal to 0
            if (quantity <= 0) return null;
            return Array.from({ length: quantity }).map((_, index) => {
              const isLastLabel = 
                productIndex === selectedResources.length - 1 &&
                variantIndex === product.variants.length - 1 &&
                index === quantity - 1;

              return (
                <div key={`${variant.id}-${index}`} id="barcode-container" style={{
                  width: "3in",
                  height: "6in",
                  margin: "0 auto",
                  position: "relative",
                  pageBreakInside: "avoid",
                  pageBreakAfter: isLastLabel ? "auto" : "always"
                }}>
                  {/* Existing barcode content structure */}
                  <div style={{
                    transform: "rotate(-90deg)",
                    transformOrigin: "center center",
                    position: "absolute",
                    width: "6in",
                    height: "3in",
                    top: "50%",
                    left: "60%",
                    marginTop: "-1.5in",
                    marginLeft: "-3.4in",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "0px"
                  }}>
                    {/* Single barcode content */}
                    <div>
                      <strong style={{
                        display: "block",
                        fontSize: "36px",
                        lineHeight: "2",
                        maxWidth: "95%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginBottom: "-30px",
                        textAlign: "left",
                      }}>
                        {variant.productBrand}
                      </strong>
                      
                      <p style={{
                        margin: 0,
                        fontSize: "32px",
                        lineHeight: "1.8",
                        maxWidth: "100%",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        marginBottom: "-35px",
                      }}>
                        {trimTitle(variant.productTitle, 35)}
                        
                      </p>

                      <p style={{
                        margin: 0,
                        fontSize: "32px",
                        lineHeight: "1.8",
                        maxWidth: "100%",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        marginBottom: "-28px",
                      }}>
                        <span style={{ display: "inline-block", width: "45%" }}>{trimTitle(variant.productSku, 25)}</span>
                        <span style={{ 
                            display: "inline-block",
                            textAlign: "right",
                            fontSize: "25px", 
                            width: "20%",
                            marginBottom: "-10px"
                        }}>
                          {convertCostToCode(variant.cost)}
                          -{yearLetter}
                        </span>
                        <span style={{  
                            fontSize: "50px", 
                            display: "inline-block", 
                            width: "35%", 
                            textAlign: "right",
                            marginBottom: "-50px"
                        }}>${parseFloat(variant.price).toFixed(2)}</span>
                      </p>

                      <p style={{
                        margin: 0,
                        fontSize: "32px",
                        lineHeight: "1.8",
                        maxWidth: "95%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        marginBottom: "-60px",
                      }}>
                        {trimTitle(variant.productColor, 25)}
                      </p>

                                                              
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "45px" }}>
                        <span style={{ 
                            marginRight: `${variant.productSize.length >= 6 ? 10 : (8-variant.productSize.length)*10}px`, 
                            textAlign: "left", 
                            fontSize: "32px",
                            marginTop: "30px",
                            display: "inline-block",
                            lineHeight: "1.4"
                        }}>
                            {variant.productSize.split(' ').map((word, index) => (
                                <React.Fragment key={index}>
                                    {word}
                                    {index < variant.productSize.split(' ').length - 1 && <br/>}
                                </React.Fragment>
                            ))}
                        </span>
                        <svg
                          id={`barcode-${variant.id}-${index}`}
                          style={{
                            width: "95%",
                            height: "120px",
                            marginBottom: "8px"
                          }}
                        ></svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          }).flat()
        ).flat()}
      </div>

      <style>
        {`
          @media print {
            @page {
              margin: 0;
              size: 3in 6in;
            }
            
            body {
              margin: 0;
              padding: 0;
            }
            
            #barcode-container {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .no-print {
              display: none !important;
            }
          }
          
          @media screen {
            #barcode-container {
              border: 1px solid #ccc;
              margin: 20px auto;
            }
          }
        `}
      </style>
    </div>
  );
}
