import{b as k,r as T,j as e}from"./components-BVMpDfb3.js";import{P,T as f,a as b,S as R}from"./Page-BqNS-q4K.js";import{L as i}from"./Layout-DPACq_-g.js";import{C as j}from"./Card-Byl9zdur.js";import{S as B}from"./PrintIcon.svg-tOeIkVBw.js";import{D as F}from"./DataTable-df3Jl6Js.js";import"./context-N4nBS5Hv.js";import"./index-CTPLptEE.js";function E(){var m,h;const n=k(),[r,c]=T.useState({Brand:"",Gender:"",cursor:null}),d=["loading","submitting"].includes(n.state)&&n.formMethod==="POST",a=t=>o=>c({...r,[t]:o}),g=()=>{c(t=>({...t,cursor:null})),n.submit(r,{method:"post"})},S=()=>{const t=document.querySelector("table").outerHTML,o=window.open("","_blank");o.document.write(`
      <html>
        <head>
          <title>Print Refill</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>${t}</body>
      </html>
    `),o.document.close(),o.print()},l=((m=n.data)==null?void 0:m.allVariants)||[],u=((h=l[0])==null?void 0:h.locationNames)||{floor:"Floor",warehouse:"Warehouse"},y=l.map(t=>{var p,x;const o=(p=t.selectedOptions.find(s=>s.name==="Color"))==null?void 0:p.value,w=(x=t.selectedOptions.find(s=>s.name==="Size"))==null?void 0:x.value,C=Math.min(t.modelStock-t.floorQuantity,t.warehouseQuantity);return[t.productTitle,t.sku||"-",o||"-",w||"-",t.floorQuantity,t.warehouseQuantity,t.modelStock,C]});return e.jsx(P,{title:"Create Refill",children:e.jsxs(i,{children:[e.jsx(i.Section,{children:e.jsx(j,{sectioned:!0,children:e.jsxs(n.Form,{method:"post",children:[e.jsx(f,{label:"Enter the Brand:",value:r.Brand,onChange:a("Brand"),placeholder:"Brand:",name:"Brand",required:!0}),e.jsx(f,{label:"Gender:",value:r.Gender,onChange:a("Gender"),placeholder:"Searches tag (combine with AND/OR)",name:"Gender"}),e.jsx(b,{submit:!0,disabled:d,onClick:g,children:d?e.jsx(R,{size:"small"}):"Submit"})]})})}),n.data&&e.jsx(i.Section,{children:e.jsx(j,{title:"Product Variants",sectioned:!0,children:l.length===0?e.jsx("p",{children:"No products match your search."}):e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{display:"flex",justifyContent:"flex-end",alignItems:"center",marginTop:"20px"},children:e.jsx(b,{onClick:S,icon:B,alignment:"right",children:"Print Refill"})}),e.jsx(F,{columnContentTypes:["text","text","text","text","numeric","numeric","numeric","numeric"],headings:["Product","SKU","Color","Size",u.floor,u.warehouse,"Model Stock","Restock Amount"],rows:y}),e.jsx("style",{jsx:!0,children:`
                    .Polaris-DataTable__TableRow:nth-child(even) {
                      background-color: #e0e0e0;
                    }
                  `})]})})})]})})}export{E as default};
