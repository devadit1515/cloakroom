import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CloakTool } from "./components/tool/CloakTool";
import "./index.css";

const path = window.location.pathname.replace(/\/+$/, "");
const Page = path === "/tool" ? CloakTool : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
