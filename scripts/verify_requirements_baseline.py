"""Check P07 requirement documents and relationships, without running the product.

No browser, network, platform SDK, container, WSL or VM is invoked.
--report saves a static document report in this project only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/requirements"
checks: list[dict] = []


def read(path):
    return json.loads(Path(path).read_text("utf-8"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def check(name, passed, detail=""):
    checks.append({"check": name, "result": "PASS" if passed else "FAIL", "detail": detail})


def resolve_in_project(path):
    path = path.resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError(f"Inventory leaves project: {path}")
    return path


def verify():
    pointer = read(ASSETS / "active.json")
    check("current_baseline", pointer["business_baseline"] == "v3.1")
    manifest_path = resolve_in_project(ASSETS / pointer["manifest"])
    check("manifest_hash", digest(manifest_path) == pointer["manifest_sha256"])
    manifest = read(manifest_path)
    check("status_is_requirements_only", manifest["implementation_status"] == "NOT_IMPLEMENTED" and manifest["product_test_status"] == "NOT_RUN")
    paths = [x["project_path"] for x in manifest["files"]]
    check("unique_inventory", len(set(paths)) == len(paths))
    for item in manifest["files"]:
        f = resolve_in_project(ROOT / item["project_path"])
        check("exists:" + item["project_path"], f.is_file())
        if f.is_file():
            check("hash:" + item["project_path"], digest(f) == item["sha256"] and f.stat().st_size == item["bytes"])
            if f.suffix == ".json":
                read(f)

    reqs = read(ASSETS / "requirements.v3.1.json")["requirements"]
    ids = {x["id"] for x in reqs}
    expected_ids = {f"P07-F{i:02}" for i in range(1, 43)}
    p1 = {"P07-F21", "P07-F22", "P07-F28", "P07-F42"}
    check("42_stable_requirements", len(reqs) == 42 and ids == expected_ids)
    check("38_P0_4_P1", {x["id"] for x in reqs if x["priority"] == "P1"} == p1 and sum(x["priority"] == "P0" for x in reqs) == 38)
    acs = [a for x in reqs for a in x["acceptance_criteria"]]
    check("126_unique_acceptance_criteria", len(acs) == 126 and len({x["id"] for x in acs}) == 126)
    check("AC_not_executed", all(x["execution_status"] == "NOT_RUN" for x in acs))
    check("requirements_not_implemented", all(x["status"] == "SPECIFIED_NOT_IMPLEMENTED" for x in reqs))

    pages = read(ASSETS / "pages.v3.1.json")["pages"]
    page_ids = {x["page_id"] for x in pages}
    check("18_page_contracts", len(pages) == 18 and page_ids == {f"MP{i:02}" for i in range(1, 19)})
    check("four_root_tabs", {x["page_id"] for x in pages if x["navigation_type"] == "root"} == {"MP01", "MP13", "MP14", "MP15"})
    design_pointer = read(ROOT / "assets/design/active.json")
    design_base = (ROOT / "assets/design" / design_pointer["manifest"]).parent
    components = read(design_base / "specs/components.json")["components"]
    component_ids = {x["id"] for x in components}
    check("B32_components_retained", len(component_ids) == 32 and design_pointer["selected_style"] == "B")
    check("three_visual_references", {x["page_id"] for x in pages if x["rendered_reference"]} == {"MP01", "MP06", "MP10"})
    check("P0_page_coverage", {r for x in pages for r in x["requirement_ids"]} == ids - p1)
    for x in pages:
        check("page:" + x["page_id"], set(x["requirement_ids"]) <= ids and set(x["component_ids"]) <= component_ids and all(x[k] for k in ("entry_precondition", "visible_content", "submit_guard", "exception_behavior", "recovery")) and x["status"] == "SPECIFIED_NOT_IMPLEMENTED")

    apis = read(ROOT / "assets/contracts/api-catalog.v3.1.json")["operations"]
    api_ids = {x["id"] for x in apis}
    check("53_API_contracts", len(apis) == 53 and api_ids == {f"P07-API{i:02}" for i in range(1, 54)})
    check("unique_method_route", len({(x["method"], x["path"]) for x in apis}) == 53)
    for op in apis:
        check("api:" + op["id"], bool(op["requirement_ids"]) and set(op["requirement_ids"]) <= ids and op["status"] == "DESIGNED_NOT_IMPLEMENTED" and op["path"].startswith("/v1/p07/"))

    trace = read(ASSETS / "traceability.v3.1.json")["rows"]
    by_id = {x["requirement_id"]: x for x in trace}
    check("42_trace_rows", len(trace) == 42 and set(by_id) == ids)
    for r in reqs:
        rid = r["id"]
        t = by_id[rid]
        check("trace:" + rid, all(t[k] == r[k] for k in ("priority", "page_ids", "component_ids", "api_ids", "primary_test_id")) and t["acceptance_ids"] == [a["id"] for a in r["acceptance_criteria"]])
        check("inverse_API:" + rid, set(r["api_ids"]) == {x["id"] for x in apis if rid in x["requirement_ids"]})
        check("inverse_page:" + rid, set(r["page_ids"]) == {x["page_id"] for x in pages if rid in x["requirement_ids"]})
        check("trace_status:" + rid, t["implementation_status"] == "NOT_IMPLEMENTED" and t["test_status"] == "NOT_RUN")
        check("release_mapping:" + rid, bool(t["release_gate_ids"]) if r["priority"] == "P0" else not t["release_gate_ids"])

    rules = read(ASSETS / "business-rules.v3.1.json")["rules"]
    cases = read(ASSETS / "exception-cases.v3.1.json")["cases"]
    nfrs = read(ASSETS / "nonfunctional.v3.1.json")["requirements"]
    metrics = read(ASSETS / "quality-metrics.v3.1.json")["metrics"]
    check("24_business_rules", len(rules) == 24 and {x["id"] for x in rules} == {f"BR{i:02}" for i in range(1, 25)})
    check("24_exception_scenarios", len(cases) == 24 and {x["id"] for x in cases} == {f"P07-E{i:02}" for i in range(1, 25)})
    check("18_NFRs", len(nfrs) == 18 and {x["id"] for x in nfrs} == {f"P07-NFR{i:02}" for i in range(1, 19)})
    check("8_metrics", len(metrics) == 8 and {x["id"] for x in metrics} == {f"Q{i:02}" for i in range(1, 9)})
    check("additional_scenarios_not_run", all(x["execution_status"] == "NOT_RUN" for x in cases + nfrs) and all(x["measurement_status"] == "NOT_RUN" for x in metrics))
    for x in rules + cases:
        check("references:" + x["id"], set(x["requirement_ids"]) <= ids)
    for x in cases:
        check("scenario_pages:" + x["id"], set(x["page_ids"]) <= page_ids and bool(x["expected"]))

    domain = read(ROOT / "assets/contracts/domain-contract.v3.1.json")
    check("independent_status_axes", {"execution", "schema", "quality", "artifact", "payment", "refund", "fulfillment", "operation", "export_observation"} <= set(domain["axes"]))
    check("not_evaluated_not_passed", "NOT_EVALUATED" in domain["axes"]["quality"])
    terminal = set(domain["execution_terminal_states"])
    check("no_terminal_run_restart", all(x["from"] not in terminal for x in domain["execution_transitions"]))
    check("transition_states_known", all(x["from"] in domain["axes"]["execution"] and x["to"] in domain["axes"]["execution"] and x["guard"] for x in domain["execution_transitions"]))
    check("seven_other_axis_policies", set(domain["other_axis_transitions"]) == {"schema", "quality", "artifact", "payment", "refund", "fulfillment", "operation"})
    for axis, transitions in domain["other_axis_transitions"].items():
        for transition in transitions:
            check("transition:" + axis + ":" + transition["from"] + ":" + transition["to"], transition["from"] in domain["axes"][axis] and transition["to"] in domain["axes"][axis] and bool(transition["guard"]))
    check("operation_terminal_immutable", all(x["from"] == "PENDING" for x in domain["other_axis_transitions"]["operation"]))
    check("free_not_fabricated_payment", all(x["from"] != "NOT_REQUIRED" for x in domain["other_axis_transitions"]["payment"]))
    check("budget_exact_bytes", domain["budget"]["source_single_bytes"] == 20_000_000 and domain["budget"]["source_total_bytes"] == 50_000_000 and domain["budget"]["template_bytes"] == 5_000_000)
    payload = read(ROOT / "assets/contracts/payload-examples.v3.1.json")
    sample = payload["workspace_response"]
    for axis, key in (("execution", "execution_status"), ("schema", "schema_status"), ("quality", "quality_status"), ("artifact", "artifact_status"), ("payment", "payment_status"), ("refund", "refund_status"), ("fulfillment", "fulfillment_status")):
        check("example_state:" + axis, sample[key] in domain["axes"][axis])
    missing = payload["missing_field_value"]
    check("missing_price_stays_null", missing["value"] is None and missing["status"] == "MISSING")
    fixture = read(ROOT / "assets/examples/v3.1/报价资料成表-合成验收规格.json")
    check("synthetic_not_execution", fixture["synthetic"] and fixture["status"] == "DESIGN_EXPECTATION_NOT_ENGINE_OUTPUT")
    check("warranty_not_copied", fixture["expected_records"][0]["warranty_months"] is None and fixture["expected_records"][2]["warranty_months"] == 12)
    check("candidate_counts", fixture["expected_counts"]["total"] == sum(fixture["expected_counts"][k] for k in ("accepted", "needs_review", "excluded")))

    cap = read(ROOT / "assets/platform/capabilities.v3.1.json")
    check("four_unreleased_environments", len(cap["release_units"]) == 4 and all(x["test_execution_status"] == "NOT_RUN" and not x["commercial_release_ready"] for x in cap["release_units"]))
    check("no_untested_capabilities_enabled", all(not y["enabled"] for x in cap["release_units"] for y in x["capabilities"].values()))
    check("iOS_old_conflict_resolved_in_documentation", all(x["documentation_status"] == "DOCUMENTED" for x in cap["sources"] if x["id"] in {"S11", "S12"}))
    flows = read(ROOT / "assets/flows/mini-program-flows.v3.1.json")
    check("flow_current_baseline", flows["baseline"] == "v3.1" and flows["state_axes"] == domain["axes"] and {x["page_id"] for x in flows["pages"]} == page_ids)

    functional = (ROOT / "docs/02-功能需求与用户流程.md").read_text("utf-8")
    main_tests = (ROOT / "docs/05-验收测试与实施计划.md").read_text("utf-8")
    check("functional_headings_42", set(re.findall(r"^### (P07-F\d{2}) ", functional, re.M)) == ids)
    check("main_tests_42", set(re.findall(r"\| (P07-T\d{2}) \|", main_tests)) == {f"P07-T{i:02}" for i in range(1, 43)})
    for r in reqs:
        check("AC_document:" + r["id"], all(a["id"] in functional and a["criterion"] in functional for a in r["acceptance_criteria"]))

    links = 0
    for item in manifest["files"]:
        f = ROOT / item["project_path"]
        if f.suffix != ".md":
            continue
        content = f.read_text("utf-8")
        check("active_document_baseline:" + f.name, "v3.1" in content)
        for link in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", content):
            link = link.strip().strip("<>")
            if re.match(r"[a-zA-Z][\w+.-]*:", link) or link.startswith("#"):
                continue
            target = (f.parent / unquote(link.split("#", 1)[0])).resolve()
            links += 1
            check("local_link:" + f.name + ":" + link, target.exists())

    design = subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "scripts/verify_design_baseline.py")], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=30)
    check("B_frozen_baseline_unchanged", design.returncode == 0, design.stderr[-500:] if design.returncode else "Selected B archive verified by its own integrity checker")

    archive = ROOT / "docs/背景/v3.0-小程序需求基线"
    snapshot = read(archive / "snapshot-manifest.json")
    check("18_original_v3_0_files", len(snapshot["files"]) == 18)
    for item in snapshot["files"]:
        retained = resolve_in_project(archive / item["archive_path"])
        check("v3_0_snapshot:" + item["project_path"], retained.is_file() and digest(retained) == item["sha256"])

    failures = [x for x in checks if x["result"] == "FAIL"]
    return {"product_id": "P07", "business_baseline": "v3.1", "checked_at": datetime.now(timezone.utc).isoformat(), "result": "PASS" if not failures else "FAIL", "scope": "Static documents, hashes and relationships only", "requirements": len(reqs), "P0": 38, "P1": 4, "acceptance_criteria": len(acs), "pages": len(pages), "components": len(components), "api_contracts": len(apis), "business_rules": len(rules), "NFRs": len(nfrs), "metrics": len(metrics), "exception_scenarios": len(cases), "inventory_files": len(paths), "local_links_checked": links, "checks_passed": len(checks) - len(failures), "checks_failed": len(failures), "implementation_status": "NOT_IMPLEMENTED", "product_tests": "NOT_RUN", "errors": failures, "checks": checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    try:
        report = verify()
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as exc:
        print(json.dumps({"result": "FAIL", "error": str(exc)}, ensure_ascii=True))
        return 1
    if args.report:
        path = ROOT / "docs/评审/v3.1-完整需求文档核验-2026-10-27.json"
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "checks"}, ensure_ascii=True, indent=2))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    if read(ASSETS / 'active.json').get('business_baseline') == 'v3.2':
        from verify_session_first_baseline import main as _current_main
        raise SystemExit(_current_main())
    raise SystemExit(main())
