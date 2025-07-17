// Utility script to help find the security group ID
// Run this in the browser console after logging in to get your group IDs

export const getGroupIds = async (msalInstance: any) => {
  try {
    const graphScopes = ["User.Read", "GroupMember.Read.All"];
    const accessToken = await msalInstance.acquireTokenSilent({ scopes: graphScopes });
    
    const res = await fetch("https://graph.microsoft.com/v1.0/me/memberOf", {
      headers: {
        Authorization: `Bearer ${accessToken.accessToken}`,
      },
    });
    
    if (!res.ok) {
      console.error('Failed to fetch group membership:', res.status, res.statusText);
      return;
    }
    
    const groups = await res.json();
    console.log('Your group memberships:');
    groups.value.forEach((group: any) => {
      console.log(`Group: ${group.displayName} (${group.id})`);
    });
    
    // Find the IntranetExecs group
    const intranetExecsGroup = groups.value.find((group: any) => 
      group.displayName.toLowerCase().includes('intranetexecs') ||
      group.displayName.toLowerCase().includes('intranet') && group.displayName.toLowerCase().includes('exec')
    );
    
    if (intranetExecsGroup) {
      console.log(`\n🎯 Found IntranetExecs group: ${intranetExecsGroup.displayName} (${intranetExecsGroup.id})`);
      console.log(`\nCopy this ID to your authConfig.ts file:`);
      console.log(`export const INTRANET_EXECS_GROUP_ID = '${intranetExecsGroup.id}';`);
    } else {
      console.log('\n❌ IntranetExecs group not found. Available groups:');
      groups.value.forEach((group: any) => {
        console.log(`- ${group.displayName} (${group.id})`);
      });
    }
  } catch (error) {
    console.error('Error fetching group memberships:', error);
  }
}; 