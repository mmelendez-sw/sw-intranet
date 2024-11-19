export const msalConfig = {
  auth: {
    clientId: "543ae09d-95e7-47bb-b679-e4428c20918e",
    authority: "https://login.microsoftonline.com/63fbe43e-8963-4cb6-8f87-2ecc3cd029b4",
    // redirectUri: "http://localhost:3000",
    redirectUri: "https://fully-vertical-cards.d2ryoyr4gox6p1.amplifyapp.com",
  },
  cache: {
    cacheLocation: "localStorage", // Use localStorage for persistence
    storeAuthStateInCookie: true, // If you want cookies, set to true
  },
};

export const loginRequest = {
  scopes: ["User.Read"], // Adjust the scopes based on what you need
};