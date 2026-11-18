/// <reference types="svelte" />
/// <reference types="vite/client" />

// plotly.js-dist-min は型を持たないので、plotly.js の型を借りる
declare module "plotly.js-dist-min" {
  import Plotly from "plotly.js";
  export default Plotly;
}
