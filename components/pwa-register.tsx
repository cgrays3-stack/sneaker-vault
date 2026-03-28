"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .then(() => {
        console.log("All service workers unregistered.");
      })
      .catch((error) => {
        console.error("Failed to unregister service workers:", error);
      });
  }, []);

  return null;
}