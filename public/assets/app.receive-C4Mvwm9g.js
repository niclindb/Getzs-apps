import{r as n,u as W,a as L,j as e,F as A}from"./components-BVMpDfb3.js";import{P as T,T as E,b as l,a as m,I as Q,B as V}from"./Page-BqNS-q4K.js";import{L as d}from"./Layout-DPACq_-g.js";import{C as p}from"./Card-Byl9zdur.js";import{C as G}from"./Checkbox-BedaW2DZ.js";import{B as w}from"./Banner-CQtSwo5m.js";import{S as H}from"./PrintIcon.svg-tOeIkVBw.js";import{D as I}from"./DataTable-df3Jl6Js.js";import"./context-N4nBS5Hv.js";import"./index-CTPLptEE.js";function D(){const[S,x]=n.useState(""),[a,C]=n.useState(!1),[c,y]=n.useState("floor"),r=W(),v=L(),[g,R]=n.useState(new Map),[j,P]=n.useState(new Map),[$,k]=n.useState(0),M=n.useCallback(t=>{if(t.includes(`
`)){const s=t.replace(`
`,"").trim();if(s){const o=new FormData;o.append("barcode",s),o.append("isRemoveMode",a.toString()),a&&o.append("removeLocation",c),v(o,{method:"post"})}}else x(t)},[a,c,v]);n.useEffect(()=>{if(r!=null&&r.success){x("");const t=`${r.productTitle}|${r.variantTitle}`,s=r.isRemoveMode?-1:1;k(h=>h+s);const o=h=>{const i=new Map(h);if(i.has(t)){const f=i.get(t),b=f.quantity+s;b===0?i.delete(t):i.set(t,{...f,quantity:b})}else i.set(t,{productTitle:r.productTitle,variantTitle:r.variantTitle,quantity:s});return i};r.sentToWarehouse?P(o):R(o)}},[r]);const q=()=>{try{const t=window.open("","_blank");if(!t){alert("Please allow pop-ups to print the inventory list.");return}const s=new Date().toLocaleString();t.document.write(`
                <html>
                    <head>
                        <title>Inventory Report - ${s}</title>
                        <style>
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                                margin-bottom: 20px;
                            }
                            th, td { 
                                border: 1px solid black; 
                                padding: 8px; 
                                text-align: left; 
                            }
                            td.quantity {
                                text-align: right;
                            }
                            th { 
                                background-color: #f3f3f3; 
                            }
                            h2 { 
                                margin-top: 20px; 
                            }
                            .timestamp {
                                margin-bottom: 20px;
                                font-style: italic;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="timestamp">Inventory Received: ${s}</div>
                        <h2>Floor Items</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Variant</th>
                                    <th style="text-align: right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.from(g.values()).map(o=>`
                                    <tr>
                                        <td>${u(o.productTitle)}</td>
                                        <td>${u(o.variantTitle)}</td>
                                        <td class="quantity">${o.quantity}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>

                        <h2>Warehouse Items</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Variant</th>
                                    <th style="text-align: right">Quantity</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.from(j.values()).map(o=>`
                                    <tr>
                                        <td>${u(o.productTitle)}</td>
                                        <td>${u(o.variantTitle)}</td>
                                        <td class="quantity">${o.quantity}</td>
                                    </tr>
                                `).join("")}
                            </tbody>
                        </table>
                    </body>
                </html>
            `),t.document.close(),t.print()}catch(t){console.error("Print error:",t),alert("There was an error while trying to print. Please try again.")}},u=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"),F=()=>r!=null&&r.isRemoveMode?"critical":(r==null?void 0:r.sentToWarehouse)==!0?"warning":"success",B=()=>{try{return e.jsxs(V,{children:[e.jsx(m,{variant:c==="floor"?"primary":"secondary",onClick:()=>{y("floor")},children:"Floor"}),e.jsx(m,{variant:c==="warehouse"?"primary":"secondary",onClick:()=>{y("warehouse")},children:"Warehouse"})]})}catch(t){return console.error("Button render error:",t),console.error("Error stack:",t.stack),e.jsx("div",{children:"Error rendering location buttons"})}};return e.jsxs(T,{children:[e.jsx("ui-title-bar",{title:"Receiving Inventory"}),e.jsxs(d,{children:[e.jsx(d.Section,{children:e.jsxs(p,{children:[e.jsxs("div",{style:{padding:"1rem"},children:[e.jsxs(A,{method:"post",children:[e.jsx("input",{type:"hidden",name:"isRemoveMode",value:a.toString()}),a&&e.jsx("input",{type:"hidden",name:"removeLocation",value:c}),e.jsx(E,{type:"text",label:"Scan Barcode",value:S,onChange:M,name:"barcode",autoComplete:"off",autoFocus:!0})]}),e.jsxs("div",{style:{marginTop:"1rem",display:"flex",alignItems:"center",gap:"1rem"},children:[e.jsx(G,{label:"Remove Inventory",checked:a,onChange:t=>{C(t)}}),a&&B()]})]}),(r==null?void 0:r.error)&&e.jsx("div",{style:{padding:"0 1rem"},children:e.jsx(w,{status:"critical",tone:"critical",children:e.jsx(l,{children:r.error})})}),(r==null?void 0:r.success)&&e.jsx("div",{style:{padding:"0 1rem"},children:e.jsxs(w,{status:"success",tone:F(),children:[e.jsxs(l,{children:[r.isRemoveMode?"Removed from":"Added to"," ",r.sentToWarehouse?"Warehouse":"Floor"]}),e.jsxs(l,{children:["Product: ",r.productTitle]}),e.jsxs(l,{children:["Variant: ",r.variantTitle]})]})})]})}),e.jsx(d.Section,{children:e.jsx(T,{title:`Scanned Items (Total: ${$})`,primaryAction:e.jsx(m,{onClick:q,icon:e.jsx(Q,{source:H}),children:"Print"}),children:e.jsxs(d,{children:[e.jsx(d.Section,{children:e.jsx(p,{children:e.jsxs("div",{style:{padding:"1rem"},children:[e.jsx(l,{variant:"headingMd",as:"h2",children:"Floor Items"}),e.jsx(I,{columnContentTypes:["text","text","numeric"],headings:["Product","Variant","Quantity"],rows:Array.from(g.values()).map(t=>[t.productTitle,t.variantTitle,t.quantity])})]})})}),e.jsx(d.Section,{children:e.jsx(p,{children:e.jsxs("div",{style:{padding:"1rem"},children:[e.jsx(l,{variant:"headingMd",as:"h2",children:"Warehouse Items"}),e.jsx(I,{columnContentTypes:["text","text","numeric"],headings:["Product","Variant","Quantity"],rows:Array.from(j.values()).map(t=>[t.productTitle,t.variantTitle,t.quantity])})]})})})]})})})]})]})}export{D as default};
