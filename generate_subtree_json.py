import vsdx
import json
from collections import deque

# keyed by (fill_color, mp_name)
type_mapping = {
    ("#fff2cc", "Process"): "Question Node",
    ("#fff2cc", "Unknown"): "Question Node",
    ("#9dbb61", "Process"): "Yes Node",
    ("#c05046", "Process"): "No Node",
    ("#b7dde8", "Decision"): "status node",
    ("#e5b9b5", "Process"): "obligation",
    ("#e5b9b5", "Subprocess"): "Obligations Node",
    ("#ddd6e5", "Process"): "if condition",
    ("#ddd6e5", "Unknown"): "if condition",
    (None, "Subprocess"): "Intermediate Conclusion",
    (None, "Process"): "Elements of control/obligation",
    ("#f2f2f2", "Custom 4"): "Explanatory Node",
    ("#ab9ac0", "Start/End"): "IF collector node",
    ("#fcebdd", "Data"): "control",
}

ROOT_TEXT = "Does your dataset contain information that identifies directly a natural person, without the need for additional information?"


def parse_all(filepath):
    nodes, edges = [], []

    with vsdx.VisioFile(filepath) as vis:
        for page in vis.pages:
            for s in page.all_shapes:
                is_connector = any(c.from_id == s.ID for c in s.connects)
                if is_connector:
                    begin = next(
                        (c for c in s.connects if c.from_rel == "BeginX"), None
                    )
                    end = next((c for c in s.connects if c.from_rel == "EndX"), None)
                    edges.append(
                        {
                            "id": s.ID,
                            "label": s.text,
                            "from": begin.to_id if begin else None,
                            "to": end.to_id if end else None,
                        }
                    )
                else:
                    if s.text:
                        mp_name = s.master_page.name if s.master_page else "Unknown"

                        nodes.append(
                            {
                                "id": s.ID,
                                "label": s.text,
                                "shape_type": s.shape_type,
                                "color": s.fill_color,
                                "mp_name": mp_name,
                                "reverse_engineering_type": type_mapping.get(
                                    (s.fill_color, mp_name), "unknown"
                                ),
                                "x": s.x,
                                "y": s.y,
                            }
                        )

    return nodes, edges


def find_start_id(nodes, text):
    norm = text.lower().replace("\n", " ").strip()
    for n in nodes:
        if (n["label"] or "").lower().replace("\n", " ").strip() == norm:
            return n["id"]
    raise ValueError(f"Could not find a node with text: {text!r}")


def subtree(filepath, root_text=ROOT_TEXT):
    nodes, edges = parse_all(filepath)
    start_id = find_start_id(nodes, root_text)

    adjacency = {n["id"]: [] for n in nodes}
    for e in edges:
        if e["from"] in adjacency:
            adjacency[e["from"]].append(e)

    visited_nodes, visited_edges = set(), set()
    queue = deque([start_id])
    while queue:
        current_id = queue.popleft()
        if current_id in visited_nodes:
            continue
        visited_nodes.add(current_id)
        for edge in adjacency.get(current_id, []):
            visited_edges.add(edge["id"])
            if edge["to"] and edge["to"] not in visited_nodes:
                queue.append(edge["to"])

    return {
        "start": start_id,
        "nodes": [n for n in nodes if n["id"] in visited_nodes],
        "edges": [e for e in edges if e["id"] in visited_edges],
    }


if __name__ == "__main__":
    res = subtree("gdpr_demo.vsdx")
    with open("subtree.json", "w") as f:
        json.dump(res, f, indent=4)
    print(
        f"Subtree JSON generated: start={res['start']}, "
        f"{len(res['nodes'])} nodes, {len(res['edges'])} edges"
    )
