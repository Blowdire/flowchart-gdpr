import vsdx
import json
from collections import deque

color_type_mapping = {
    "#fff2cc": "Question Node",
    "#9dbb61": "Yes Node",
    "#c05046": "No Node",
    "#b7dde8": "Termination Node",
    "#e5b9b5": "Conditions to respect Node",
    "#ddd6e5": "IF collector node"
}

def parse_with_library(filepath, start_id: str = None):
    nodes, edges = [], []

    with vsdx.VisioFile(filepath) as vis:
        for page in vis.pages:
            for s in page.all_shapes:
      
                is_connector = any(c.from_id == s.ID for c in s.connects)
                if is_connector:
                    begin = next((c for c in s.connects if c.from_rel == 'BeginX'), None)
                    end = next((c for c in s.connects if c.from_rel == 'EndX'), None)
                    edges.append({
                        "id": s.ID,
                        "label": s.text,
                        "from": begin.to_id if begin else None,
                        "to": end.to_id if end else None,
                    })
                else:
                    if s.text: 
                        override_type = None
                        mp_name = s.master_page.name if s.master_page else "Unknown"
                        if mp_name == "Subprocess":
                            print(f"mPName = {mp_name}  ID = {s.ID}  text = {s.text}  fill_color = {s.fill_color}")
                            if s.fill_color == None:
                                override_type = "Intermediate Conclusion"
                            elif s.fill_color == "#e5b9b5":
                                override_type = "Obligations Node"
                        elif mp_name == "Start/End":
                            if s.text.lower().replace("\n", " ").strip() == "if":
                                override_type = "IF collector node"
                   
                        nodes.append({
                            "id": s.ID,
                            "label": s.text,
                            "shape_type": s.shape_type,
                            "color": s.fill_color,
                            "mp_name": mp_name,
                            "reverse_engineering_type": override_type if override_type else color_type_mapping.get(s.fill_color, "unknown"),
                            "x": s.x,
                            "y": s.y,
                        })

    if not start_id:
        return {"nodes": nodes, "edges": edges}

    node_map = {n["id"]: n for n in nodes}

    if start_id not in node_map:
        raise ValueError(f"Node ID '{start_id}' not found. Available IDs: {list(node_map.keys())}")

    adjacency = {n["id"]: [] for n in nodes}
    for e in edges:
        if e["from"] in adjacency:
            adjacency[e["from"]].append(e)

    visited_nodes = set()
    visited_edges = set()
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
    res = parse_with_library("flowchart.vsdx")
    with open("flowchart.json", "w") as f:
        json.dump(res, f, indent=4)
    print("Flowchart JSON generated successfully!")
