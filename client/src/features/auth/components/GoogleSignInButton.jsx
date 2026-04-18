import React from "react";
import { GoogleLogin } from "@react-oauth/google";

export default function GoogleSignInButton({
  onSuccess,
  onError,
  loading,
  mode,
}) {
  const text = mode === "signup" ? "signup_with" : "signin_with";

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-dark-700"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-dark-900 px-2 text-dark-400">
            Or continue with
          </span>
        </div>
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          text={text}
          theme="outline"
          size="large"
          shape="pill"
          width="320"
        />
      </div>

      {loading ? (
        <div className="flex justify-center">
          <div className="w-5 h-5 border-2 border-dark-400/40 border-t-dark-200 rounded-full animate-spin"></div>
        </div>
      ) : null}
    </div>
  );
}
