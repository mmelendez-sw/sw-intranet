// Utility script to help find the security group ID
// Run this in the browser console after logging in to get your group IDs

import { acquireTokenSilentOnly, GRAPH_GROUP_SCOPES } from './msalToken';

export const getGroupIds = async (msalInstance: any) => {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      console.log('❌ No accounts found, please log in first');
      return;
    }

    const activeAccount = accounts[0];
    console.log('🔍 Using account:', activeAccount.username);

    const accessToken = await acquireTokenSilentOnly(msalInstance, GRAPH_GROUP_SCOPES);
    if (!accessToken) {
      console.log('❌ Could not acquire token silently. Use the Login button, then retry.');
      return;
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      console.error('Failed to fetch group membership:', res.status, res.statusText);
      return;
    }

    const groups = await res.json();
    console.log('🔍 Your group memberships:');
    groups.value.forEach((group: any) => {
      console.log(`- ${group.displayName} (${group.id})`);
    });

    const intranetExecsGroup = groups.value.find(
      (group: any) =>
        (group.displayName && group.displayName.toLowerCase().includes('intranetexecs')) ||
        (group.displayName &&
          group.displayName.toLowerCase().includes('intranet') &&
          group.displayName.toLowerCase().includes('exec'))
    );

    if (intranetExecsGroup) {
      console.log(`\n🎯 Found IntranetExecs group: ${intranetExecsGroup.displayName} (${intranetExecsGroup.id})`);
      console.log(`\n📋 Copy this line to your authConfig.ts file:`);
      console.log(`export const INTRANET_EXECS_GROUP_ID = '${intranetExecsGroup.id}';`);
    } else {
      console.log('\n❌ IntranetExecs group not found in your memberships.');
      console.log('Make sure you are a member of the IntranetExecs security group.');
    }
  } catch (error) {
    console.error('Error fetching group memberships:', error);
  }
};
