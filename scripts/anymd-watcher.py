#!/usr/bin/env python3
import os
import sys
import time
import json
import yaml
import shutil
import traceback
from anymd_runner import AnymdRunner

QUEUE_DIR = os.environ.get('ANYMD_QUEUE_DIR', 'queue')
PENDING_DIR = os.path.join(QUEUE_DIR, 'pending')
PROCESSING_DIR = os.path.join(QUEUE_DIR, 'processing')
DONE_DIR = os.path.join(QUEUE_DIR, 'done')
FAILED_DIR = os.path.join(QUEUE_DIR, 'failed')

def init_dirs():
    for d in [PENDING_DIR, PROCESSING_DIR, DONE_DIR, FAILED_DIR]:
        os.makedirs(d, exist_ok=True)

def watch_queue():
    print(f"[+] Watching Anymd queue directory: {PENDING_DIR}")
    init_dirs()
    while True:
        try:
            files = [f for f in os.listdir(PENDING_DIR) if f.endswith('.md')]
            for file in files:
                process_file(file)
        except Exception as e:
            print(f"[-] Error in watch loop: {e}")
        time.sleep(2)

def process_file(filename):
    pending_path = os.path.join(PENDING_DIR, filename)
    processing_path = os.path.join(PROCESSING_DIR, filename)
    done_path = os.path.join(DONE_DIR, filename)
    failed_path = os.path.join(FAILED_DIR, filename)

    print(f"[+] Processing file from queue: {filename}")
    try:
        shutil.move(pending_path, processing_path)
    except Exception as e:
        print(f"[-] Could not move file to processing: {e}")
        return

    try:
        # Load content and metadata
        with open(processing_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        parts = content.split('---', 2)
        if len(parts) < 3:
            raise ValueError("Invalid markdown queue format")
        
        frontmatter = yaml.safe_load(parts[1])
        payload = frontmatter.get('payload', {})
        workflow_file = frontmatter.get('workflow', 'workflow.md')

        # Execute
        runner = AnymdRunner(workflow_file, payload)
        runner.load_workflow()
        result = runner.execute()

        # Update metadata and append result
        frontmatter['status'] = 'success'
        frontmatter['result'] = result
        new_content = f"---\n{yaml.dump(frontmatter)}---\n\n## Output\n\n```json\n{json.dumps(result, indent=2)}\n```\n"
        
        with open(processing_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        shutil.move(processing_path, done_path)
        print(f"[+] Successfully executed: {filename}")
    except Exception as e:
        print(f"[-] Error processing {filename}: {e}")
        try:
            # Mark failed
            with open(processing_path, 'r', encoding='utf-8') as f:
                content = f.read()
            parts = content.split('---', 2)
            frontmatter = yaml.safe_load(parts[1]) if len(parts) >= 3 else {}
            frontmatter['status'] = 'failed'
            frontmatter['error'] = str(e)
            error_trace = traceback.format_exc()
            new_content = f"---\n{yaml.dump(frontmatter)}---\n\n## Error Log\n\n```\n{error_trace}\n```\n"
            with open(processing_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            shutil.move(processing_path, failed_path)
        except Exception as write_err:
            print(f"[-] Failed to write failure logs: {write_err}")
            shutil.move(processing_path, failed_path)

if __name__ == '__main__':
    watch_queue()
