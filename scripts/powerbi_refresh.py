"""
Power BI dataset refresh — run on a schedule (Task Scheduler / cron / Azure Automation).

No intranet API required. This script:
  1. Authenticates as the automation user (ROPC)
  2. Resolves the dataset for the Company Progress report (or uses POWERBI_DATASET_ID)
  3. POSTs a refresh to the Power BI REST API

Setup:
  pip install -r scripts/requirements-powerbi.txt
  Copy scripts/.env.example → scripts/.env and fill in values.

Run once:
  python scripts/powerbi_refresh.py

Discover where the report/dataset lives:
  python scripts/powerbi_refresh.py --discover

Windows Task Scheduler example:
  Program: python
  Arguments: C:\\path\\to\\sw-intranet\\scripts\\powerbi_refresh.py
  Start in: C:\\path\\to\\sw-intranet
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import msal
import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")

TENANT_ID = os.getenv("POWERBI_TENANT_ID", "63fbe43e-8963-4cb6-8f87-2ecc3cd029b4")
CLIENT_ID = os.getenv("POWERBI_CLIENT_ID", "")
USERNAME = os.getenv("POWERBI_USERNAME", "Salesforceautomation@symphonyinfra.com")
PASSWORD = os.getenv("POWERBI_PASSWORD", "")
# Use "me" for My Workspace, or a group GUID. Leave blank to auto-detect.
WORKSPACE_ID = (os.getenv("POWERBI_WORKSPACE_ID") or "").strip()
REPORT_ID = os.getenv("POWERBI_REPORT_ID", "e091da31-91dd-42c2-9b17-099d2e07c492")
DATASET_ID = (os.getenv("POWERBI_DATASET_ID") or "").strip()

# Refresh requires Dataset.ReadWrite.All.
# Workspace.Read.All helps locate datasets that live outside My Workspace.
# Add these as delegated permissions on the app registration and grant admin consent.
SCOPE = [
    "https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All",
    "https://analysis.windows.net/powerbi/api/Dataset.Read.All",
    "https://analysis.windows.net/powerbi/api/Report.Read.All",
    "https://analysis.windows.net/powerbi/api/Workspace.Read.All",
]
API = "https://api.powerbi.com/v1.0/myorg"


def require(value: str, name: str) -> str:
    if not value:
        raise SystemExit(f"Missing required setting: {name}")
    return value


def get_access_token() -> str:
    app = msal.PublicClientApplication(
        client_id=require(CLIENT_ID, "POWERBI_CLIENT_ID"),
        authority=f"https://login.microsoftonline.com/{TENANT_ID}",
    )

    result = app.acquire_token_by_username_password(
        username=require(USERNAME, "POWERBI_USERNAME"),
        password=require(PASSWORD, "POWERBI_PASSWORD"),
        scopes=SCOPE,
    )

    if "access_token" not in result:
        raise SystemExit(
            f"Token acquisition failed: {result.get('error')} — {result.get('error_description')}"
        )

    return result["access_token"]


def api_request(token: str, method: str, path: str) -> requests.Response:
    return requests.request(
        method,
        f"{API}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )


def api_get(token: str, path: str) -> dict:
    response = api_request(token, "GET", path)
    if not response.ok:
        raise SystemExit(f"GET {path} failed ({response.status_code}): {response.text}")
    return response.json()


def is_my_workspace(workspace_id: str) -> bool:
    return not workspace_id or workspace_id.lower() in {"me", "my", "personal"}


def report_path(workspace_id: str, report_id: str) -> str:
    if is_my_workspace(workspace_id):
        return f"/reports/{report_id}"
    return f"/groups/{workspace_id}/reports/{report_id}"


def refresh_path(workspace_id: str, dataset_id: str) -> str:
    if is_my_workspace(workspace_id):
        return f"/datasets/{dataset_id}/refreshes"
    return f"/groups/{workspace_id}/datasets/{dataset_id}/refreshes"


def find_report(token: str, report_id: str) -> tuple[str, dict]:
    """Return (workspace_id|'me', report_json). Tries My Workspace, then all groups."""
    # 1) My Workspace
    response = api_request(token, "GET", f"/reports/{report_id}")
    if response.ok:
        return "me", response.json()

    # 2) Configured workspace (if any)
    if WORKSPACE_ID and not is_my_workspace(WORKSPACE_ID):
        response = api_request(token, "GET", f"/groups/{WORKSPACE_ID}/reports/{report_id}")
        if response.ok:
            return WORKSPACE_ID, response.json()

    # 3) Search groups the user can access
    groups = api_get(token, "/groups").get("value", [])
    for group in groups:
        group_id = group["id"]
        response = api_request(token, "GET", f"/groups/{group_id}/reports/{report_id}")
        if response.ok:
            print(f"Found report in workspace: {group.get('name')} ({group_id})")
            return group_id, response.json()

    raise SystemExit(
        f"Could not find report {report_id} in My Workspace or any accessible group.\n"
        "Run with --discover, or set POWERBI_DATASET_ID and POWERBI_WORKSPACE_ID in scripts/.env."
    )


def find_dataset_workspace(token: str, dataset_id: str) -> str:
    """Find which workspace hosts the dataset. Returns 'me' or a group id."""
    # My Workspace
    response = api_request(token, "GET", f"/datasets/{dataset_id}")
    if response.ok:
        return "me"

    # Shared workspaces (needs Workspace.Read.All)
    groups_response = api_request(token, "GET", "/groups")
    if not groups_response.ok:
        raise SystemExit(
            f"Dataset {dataset_id} is not in My Workspace, and listing workspaces failed "
            f"({groups_response.status_code}).\n"
            "The report is visible, but this account does not own/manage the semantic model.\n"
            "Fix options:\n"
            "  1) In Power BI, open the dataset (not just the report) as Salesforceautomation "
            "and confirm you can click Refresh.\n"
            "  2) Move the dataset into a shared workspace and grant this account Member access.\n"
            "  3) Add delegated Workspace.Read.All on the app, grant admin consent, then re-run."
        )

    for group in groups_response.json().get("value", []):
        group_id = group["id"]
        response = api_request(token, "GET", f"/groups/{group_id}/datasets/{dataset_id}")
        if response.ok:
            print(f"Found dataset in workspace: {group.get('name')} ({group_id})")
            return group_id

    raise SystemExit(
        f"Dataset {dataset_id} was not found in My Workspace or any accessible group.\n"
        "The report can be viewed, but this identity cannot refresh its semantic model."
    )


def resolve_dataset_and_workspace(token: str) -> tuple[str, str]:
    if DATASET_ID:
        workspace = find_dataset_workspace(token, DATASET_ID)
        return workspace, DATASET_ID

    workspace_id, report = find_report(token, require(REPORT_ID, "POWERBI_REPORT_ID"))
    dataset_id = report.get("datasetId")
    if not dataset_id:
        raise SystemExit("Report response did not include datasetId; set POWERBI_DATASET_ID.")

    # Report workspace is not always the dataset workspace (shared models).
    dataset_workspace = find_dataset_workspace(token, dataset_id)
    return dataset_workspace, dataset_id


def trigger_refresh(token: str, workspace_id: str, dataset_id: str) -> None:
    path = refresh_path(workspace_id, dataset_id)
    response = api_request(token, "POST", path)

    if response.status_code == 202:
        print(f"Refresh queued for dataset {dataset_id} (workspace={workspace_id})")
        return

    if response.status_code == 409:
        print(f"Refresh already in progress for dataset {dataset_id}")
        return

    hint = ""
    if response.status_code == 401:
        hint = (
            "\nHint: 401 usually means the app token is missing Dataset.ReadWrite.All. "
            "In Azure Portal → App registration → API permissions → Power BI Service → "
            "add delegated Dataset.ReadWrite.All, then Grant admin consent. Re-run this script."
        )

    raise SystemExit(f"Refresh failed ({response.status_code}): {response.text}{hint}")


def discover(token: str) -> None:
    print("=== My Workspace reports ===")
    my_reports = api_get(token, "/reports").get("value", [])
    for report in my_reports:
        marker = " <-- target" if report.get("id") == REPORT_ID else ""
        print(f"  {report.get('name')} | report={report.get('id')} | dataset={report.get('datasetId')}{marker}")

    print("\n=== Workspaces ===")
    groups_response = api_request(token, "GET", "/groups")
    if not groups_response.ok:
        print(
            f"Skipping shared workspaces ({groups_response.status_code}). "
            "My Workspace access is enough for this report."
        )
        return

    groups = groups_response.json().get("value", [])
    for group in groups:
        print(f"\nWorkspace: {group.get('name')} ({group.get('id')})")
        reports = api_get(token, f"/groups/{group['id']}/reports").get("value", [])
        if not reports:
            print("  (no reports)")
            continue
        for report in reports:
            marker = " <-- target" if report.get("id") == REPORT_ID else ""
            print(
                f"  {report.get('name')} | report={report.get('id')} | dataset={report.get('datasetId')}{marker}"
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Trigger a Power BI dataset refresh")
    parser.add_argument(
        "--discover",
        action="store_true",
        help="List accessible workspaces/reports and exit",
    )
    args = parser.parse_args()

    token = get_access_token()

    if args.discover:
        discover(token)
        return 0

    workspace_id, dataset_id = resolve_dataset_and_workspace(token)
    print(f"Using dataset {dataset_id} in workspace {workspace_id}")
    trigger_refresh(token, workspace_id, dataset_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
