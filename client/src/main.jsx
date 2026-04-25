import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./app/App";
import "./index.css";
import "@livekit/components-styles";
import * as serviceWorker from "./registerSW";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  ),
);

// Register service worker for PWA
serviceWorker.register();
