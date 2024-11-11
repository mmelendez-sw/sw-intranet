// import { Client } from "@microsoft/microsoft-graph-client";
// import { AuthCodeMSALBrowserAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/authCodeMsalBrowser";
// import { PublicClientApplication, AccountInfo, InteractionType } from "@azure/msal-browser";
// import { msalConfig } from "./authConfig";

// const msalInstance = new PublicClientApplication(msalConfig);

// const getGraphClient = (account: AccountInfo) => {
//   const authProvider = new AuthCodeMSALBrowserAuthenticationProvider(msalInstance, {
//     account,
//     scopes: ["User.Read"],
//     interactionType: InteractionType.Popup, // Use InteractionType.Popup or InteractionType.Redirect
//   });

//   return Client.initWithMiddleware({ authProvider });
// };

// export const fetchUserPhoto = async (account: AccountInfo): Promise<string | null> => {
//   try {
//     const client = getGraphClient(account);
//     const response = await client.api("/me/photo/$value").get();
//     const imageUrl = URL.createObjectURL(await response.blob());
//     return imageUrl;
//   } catch (error) {
//     console.error("Error fetching user photo:", error);
//     return null;
//   }
// };