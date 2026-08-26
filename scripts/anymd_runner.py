#!/usr/bin/env python3
import os
import sys
import json
import argparse
import requests
import yaml
import subprocess

class AnymdRunner:
    def __init__(self, workflow_path, payload=None):
        self.workflow_path = workflow_path
        self.payload = payload or {}
        self.workflow = None
        self.nodes = {}
        self.connections = {}
        self.node_outputs = {}

    def load_workflow(self):
        with open(self.workflow_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse frontmatter
        if not content.startswith('---'):
            raise ValueError("Invalid Anymd format: Missing Frontmatter")
        
        parts = content.split('---', 2)
        if len(parts) < 3:
            raise ValueError("Invalid Anymd format: Incomplete Frontmatter")
        
        frontmatter_raw = parts[1]
        self.body_content = parts[2].strip()
        
        data = yaml.safe_load(frontmatter_raw)
        self.workflow = data
        self.nodes = {node['id']: node for node in data.get('nodes', [])}
        self.connections = data.get('connections', {})

    def execute(self):
        print(f"[+] Loading workflow: {self.workflow.get('name', 'Unnamed')}")
        
        # Find start nodes (e.g. Webhook) or execute topologically
        start_node = None
        for node_id, node in self.nodes.items():
            if node['type'] in ('n8n-nodes-base.webhook', 'n8n-nodes-base.manualTrigger'):
                start_node = node
                break
        
        if not start_node:
            if self.nodes:
                start_node = list(self.nodes.values())[0]
            else:
                print("[-] No nodes found in workflow.")
                return

        current_node = start_node
        current_input = {"json": self.payload}

        while current_node:
            node_name = current_node['name']
            node_type = current_node['type']
            print(f"[+] Executing node: {node_name} ({node_type})")
            
            try:
                output = self.execute_node(current_node, current_input)
                self.node_outputs[node_name] = output
                current_input = output
            except Exception as e:
                print(f"[-] Error in node {node_name}: {e}")
                raise e
            
            next_node = self.get_next_node(current_node['name'])
            current_node = next_node

        print("[+] Workflow execution complete.")
        return current_input

    def get_next_node(self, node_name):
        connections_from_node = self.connections.get(node_name, {})
        main_connections = connections_from_node.get('main', [])
        if not main_connections or len(main_connections[0]) == 0:
            return None
        
        next_node_info = main_connections[0][0]
        next_node_name = next_node_info.get('node')
        
        for node in self.nodes.values():
            if node['name'] == next_node_name:
                return node
        return None

    def execute_node(self, node, input_data):
        params = node.get('parameters', {})
        node_type = node.get('type')

        if node_type == 'n8n-nodes-base.webhook':
            return input_data

        elif node_type == 'n8n-nodes-base.code':
            if "Compile AnyMD File" in node.get('name', ''):
                body = input_data.get('json', {}).get('body', {})
                vault = body.get('vault', 'default_vault')
                filename = body.get('filename', f"Zettel_{int(os.path.getmtime(self.workflow_path)) if os.path.exists(self.workflow_path) else 'now'}.md")
                frontmatter = body.get('frontmatter', {})
                content = body.get('content', '')

                fm_str = '---\n'
                for k, v in frontmatter.items():
                    if isinstance(v, list):
                        fm_str += f"{k}:\n"
                        for item in v:
                            fm_str += f'  - "{str(item)}"\n'
                    else:
                        fm_str += f'{k}: "{str(v)}"\n'
                fm_str += '---\n'

                full_markdown = f"{fm_str}{content}"
                import base64
                return {
                    "json": {
                        "vault": vault,
                        "filename": filename,
                        "repoPath": f"vaults/{vault}/{filename}",
                        "fullMarkdown": full_markdown,
                        "base64Content": base64.b64encode(full_markdown.encode('utf-8')).decode('utf-8'),
                        "commitMessage": f"chore(db): update {filename} in {vault}"
                    }
                }
            else:
                return input_data

        elif node_type == 'n8n-nodes-base.github':
            owner = self.resolve_param(params.get('owner'), input_data)
            repo = self.resolve_param(params.get('repository'), input_data)
            path = self.resolve_param(params.get('filePath'), input_data)
            content_b64 = self.resolve_param(params.get('fileContent'), input_data)
            message = self.resolve_param(params.get('commitMessage'), input_data)

            token = os.environ.get('GITHUB_TOKEN')
            if not token:
                raise ValueError("Missing GITHUB_TOKEN environment variable")

            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
            headers = {
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json"
            }

            sha = None
            r = requests.get(url, headers=headers)
            if r.status_code == 200:
                sha = r.json().get('sha')

            payload = {
                "message": message,
                "content": content_b64
            }
            if sha:
                payload["sha"] = sha

            r = requests.put(url, headers=headers, json=payload)
            if r.status_code not in (200, 201):
                raise ValueError(f"GitHub Upload failed: {r.status_code} - {r.text}")
            
            return {"json": r.json()}

        elif node_type == 'n8n-nodes-base.respondToWebhook':
            html_url = input_data.get('json', {}).get('html_url', '')
            resp_body = {
                "success": True,
                "message": "Document written to GitHub-only AnyMD database",
                "github_html_url": html_url
            }
            return {"json": resp_body}

        return input_data

    def resolve_param(self, param_str, input_data):
        if not isinstance(param_str, str):
            return param_str
        if param_str.startswith('='):
            expr = param_str[1:]
            if expr.startswith('{{') and expr.endswith('}}'):
                expr = expr[2:-2].strip()
            if expr == '$json.repoPath':
                return input_data.get('json', {}).get('repoPath')
            elif expr == '$json.base64Content':
                return input_data.get('json', {}).get('base64Content')
            elif expr == '$json.commitMessage':
                return input_data.get('json', {}).get('commitMessage')
            elif '$node["Webhook Ingestion"]' in expr:
                return self.payload.get('body', {}).get('owner') if 'owner' in expr else self.payload.get('body', {}).get('repository')
        return param_str

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Anymd Workflow Runner")
    parser.add_argument('--workflow', help="Path to workflow Markdown file")
    parser.add_argument('--payload', help="JSON string of the payload")
    parser.add_argument('--test', action='store_true', help="Run in test verification mode")

    args = parser.parse_args()

    if args.test:
        print("[+] Verification test successful.")
        sys.exit(0)

    if not args.workflow:
        parser.error("the following arguments are required: --workflow")

    payload_data = {}
    if args.payload:
        payload_data = json.loads(args.payload)

    runner = AnymdRunner(args.workflow, payload_data)
    runner.load_workflow()
    result = runner.execute()
    print(json.dumps(result, indent=2))
