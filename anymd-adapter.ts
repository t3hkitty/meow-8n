import * as fs from 'fs/promises';
import * as path from 'path';
import { WatchEventType, watch } from 'fs';
import * as yaml from 'js-yaml';

export interface WorkflowMetadata {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  [key: string]: any;
}

export interface AnymdWorkflow {
  metadata: WorkflowMetadata;
  nodes: any[];
  connections: any;
  description: string;
}

export interface ExecutionMetadata {
  id: string;
  workflowId: string;
  status: 'success' | 'failed' | 'running' | 'waiting';
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  executionTimeMs?: number;
  [key: string]: any;
}

export interface AnymdExecution {
  metadata: ExecutionMetadata;
  summary: string;
  error?: any;
  nodeData: Record<string, any>;
}

export class AnymdStorageDriver {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = path.resolve(vaultPath);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.vaultPath, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(this.vaultPath, 'executions'), { recursive: true });
    await fs.mkdir(path.join(this.vaultPath, '.credentials'), { recursive: true });
  }

  async saveWorkflow(workflow: AnymdWorkflow): Promise<string> {
    const filename = \\.md\;
    const filePath = path.join(this.vaultPath, 'workflows', filename);

    const frontmatter = yaml.dump({
      ...workflow.metadata,
      nodes: workflow.nodes,
      connections: workflow.connections,
    });

    const fileContent = \---\\n\---\\n\\n\\;
    await fs.writeFile(filePath, fileContent, 'utf-8');
    return filePath;
  }

  async getWorkflow(id: string): Promise<AnymdWorkflow> {
    const filePath = path.join(this.vaultPath, 'workflows', \\.md\);
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parseMarkdown<AnymdWorkflow>(content);
  }

  async listWorkflows(): Promise<WorkflowMetadata[]> {
    const dir = path.join(this.vaultPath, 'workflows');
    const files = await fs.readdir(dir);
    const workflows: WorkflowMetadata[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        const parsed = this.parseMarkdown<AnymdWorkflow>(content);
        workflows.push(parsed.metadata);
      }
    }
    return workflows;
  }

  async saveExecution(execution: AnymdExecution): Promise<string> {
    const filename = \\.md\;
    const filePath = path.join(this.vaultPath, 'executions', filename);

    const frontmatter = yaml.dump(execution.metadata);
    const nodeOutputStr = JSON.stringify(execution.nodeData, null, 2);

    const fileContent = \---\\n\---\\n\\n## Summary\\n\\\n\\n## Node Output Data\\n\\\\\\\\\json\\n\\\n\\\\\\\\\\\n\;
    await fs.writeFile(filePath, fileContent, 'utf-8');
    return filePath;
  }

  private parseMarkdown<T>(content: string): T {
    const match = content.match(/^---\\r?\\n([\\s\\S]+?)\\r?\\n---\\r?\\n([\\s\\S]*)$/);
    if (!match) {
      throw new Error('Invalid Anymd Markdown format: Missing Frontmatter');
    }

    const frontmatterRaw = match[1];
    const body = match[2].trim();

    const metadata = yaml.load(frontmatterRaw) as any;
    
    if (metadata.nodes) {
      const { nodes, connections, ...metaRest } = metadata;
      return {
        metadata: metaRest,
        nodes,
        connections,
        description: body,
      } as unknown as T;
    }

    return {
      metadata,
      summary: body,
    } as unknown as T;
  }
}

export class AnymdQueueWatcher {
  private queuePath: string;
  private processor: (filePath: string, data: any) => Promise<void>;

  constructor(queuePath: string, processor: (filePath: string, data: any) => Promise<void>) {
    this.queuePath = path.resolve(queuePath);
    this.processor = processor;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.queuePath, 'pending'), { recursive: true });
    await fs.mkdir(path.join(this.queuePath, 'processing'), { recursive: true });
    await fs.mkdir(path.join(this.queuePath, 'done'), { recursive: true });
    await fs.mkdir(path.join(this.queuePath, 'failed'), { recursive: true });
  }

  start(): void {
    const pendingDir = path.join(this.queuePath, 'pending');
    
    watch(pendingDir, async (eventType: WatchEventType, filename: string | null) => {
      if (eventType === 'rename' && filename && filename.endsWith('.md')) {
        const sourcePath = path.join(pendingDir, filename);
        
        try {
          await fs.access(sourcePath);
          await this.processQueueItem(filename);
        } catch (err) {
        }
      }
    });
  }

  private async processQueueItem(filename: string): Promise<void> {
    const pendingPath = path.join(this.queuePath, 'pending', filename);
    const processingPath = path.join(this.queuePath, 'processing', filename);
    const donePath = path.join(this.queuePath, 'done', filename);
    const failedPath = path.join(this.queuePath, 'failed', filename);

    try {
      await fs.rename(pendingPath, processingPath);
    } catch {
      return;
    }

    try {
      const content = await fs.readFile(processingPath, 'utf-8');
      const match = content.match(/^---\\r?\\n([\\s\\S]+?)\\r?\\n---\\r?\\n([\\s\\S]*)$/);
      const payload = match ? yaml.load(match[1]) : {};

      await this.processor(processingPath, payload);
      await fs.rename(processingPath, donePath);
    } catch (error) {
      try {
        const errorContent = \\\n\\n## Execution Error\\n\\\\\\\\\json\\n\\\n\\\\\\\\\\\n\;
        await fs.appendFile(processingPath, errorContent, 'utf-8');
        await fs.rename(processingPath, failedPath);
      } catch (writeErr) {
        await fs.rename(processingPath, failedPath).catch(() => {});
      }
    }
  }
}
