import { TFile, Vault, Notice } from 'obsidian';

class DebugLogger {
    private vault: Vault | null = null;
    private logFilePath: string | null = null;
    private enabled = true;
    private writeQueue: string[] = [];
    private isWriting = false;
    private writeCount = 0;
    private initialized = false;
    private earlyLogs: Array<{type: string, message: string, data?: any}> = [];
    private maxEarlyLogs = 100; // Prevent memory issues
    private debugMobileEnabled = false;

    async initialize(vault: Vault, debugMobileEnabled: boolean) {
        this.vault = vault;
        this.debugMobileEnabled = debugMobileEnabled;
        
        // Only actually initialize if debugging is enabled
        if (!debugMobileEnabled) {
            return;
        }
        
        // Wait a bit for vault to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
        const fileName = `notebook-navigator-debug-${timestamp}.md`;
        
        try {
            // Check if file already exists
            const existingFile = vault.getAbstractFileByPath(fileName);
            if (existingFile) {
                new Notice(`Debug log already exists: ${fileName}`);
                this.logFilePath = existingFile.path;
                this.initialized = true;
                return;
            }
            
            // Create the log file
            const initialContent = `# Notebook Navigator Debug Log\n\nStarted: ${new Date().toISOString()}\n\n`;
            const file = await vault.create(fileName, initialContent);
            if (!file) {
                // Try alternative approach
                await vault.adapter.write(fileName, initialContent);
                const createdFile = vault.getAbstractFileByPath(fileName);
                if (!createdFile) {
                    throw new Error('File creation failed - file not found after write');
                }
                this.logFilePath = fileName;
            } else {
                this.logFilePath = file.path;
            }
            
            new Notice(`Debug log: ${fileName}`);
            this.initialized = true;
            
            // Process any early logs that were queued
            if (this.earlyLogs.length > 0) {
                // Process queued logs
                const logsToProcess = [...this.earlyLogs];
                this.earlyLogs = [];
                
                // Process each log directly without recursion
                for (const log of logsToProcess) {
                    const timestamp = new Date().toISOString();
                    let entry = `### [${timestamp}] ${log.type}: ${log.message}`;
                    
                    if (log.data !== undefined) {
                        const sanitized = this.sanitizeData(log.data);
                        entry += `\n\`\`\`json\n${JSON.stringify(sanitized, null, 2)}\n\`\`\`\n`;
                    }
                    
                    this.writeQueue.push(entry);
                }
            }
            
            this.log('SYSTEM', 'Debug logger initialized', { fileName });
            
            // Force write the queue
            // Don't force write here - let it happen naturally
            // await this.processWriteQueue();
        } catch (error: any) {
            new Notice(`Debug log failed: ${error.message}`);
            console.error('Failed to create debug log file:', error);
            this.enabled = false;
        }
    }

    private async processWriteQueue() {
        if (this.isWriting || this.writeQueue.length === 0 || !this.logFilePath || !this.vault) {
            return;
        }

        this.isWriting = true;
        const entries = this.writeQueue.splice(0, this.writeQueue.length);
        const content = entries.join('\n');

        try {
            // Get the file by path
            const file = this.vault.getAbstractFileByPath(this.logFilePath);
            if (!file || !(file instanceof TFile)) {
                throw new Error('Log file not found');
            }
            
            await this.vault.append(file, content + '\n');
            // First write confirmation only
            if (this.writeCount === 0) {
                new Notice('Debug logging active');
                this.writeCount++;
            }
        } catch (error: any) {
            console.error('Failed to write to debug log:', error);
            // Re-add entries to queue if write failed
            this.writeQueue.unshift(...entries);
        } finally {
            this.isWriting = false;
            // Process any new entries that came in while writing
            if (this.writeQueue.length > 0) {
                setTimeout(() => this.processWriteQueue(), 100);
            }
        }
    }

    log(type: string, message: string, data?: any) {
        // Check if debugging is enabled
        if (!this.enabled || !this.debugMobileEnabled) {
            return;
        }
        
        // If not initialized yet, queue the log for later
        if (!this.initialized) {
            this.earlyLogs.push({ type, message, data });
            // Prevent unbounded growth
            if (this.earlyLogs.length > this.maxEarlyLogs) {
                this.earlyLogs.shift();
            }
            return;
        }
        
        const timestamp = new Date().toISOString();
        let entry = `### [${timestamp}] ${type}: ${message}`;
        
        if (data !== undefined) {
            const sanitized = this.sanitizeData(data);
            entry += `\n\`\`\`json\n${JSON.stringify(sanitized, null, 2)}\n\`\`\`\n`;
        }
        
        this.writeQueue.push(entry);
        // Process synchronously to avoid timing issues
        setTimeout(() => {
            this.processWriteQueue().catch(err => {
                console.error('Write queue error:', err);
            });
        }, 0);
    }

    info(message: string, data?: any) {
        this.log('INFO', message, data);
    }

    warn(message: string, data?: any) {
        this.log('WARN', message, data);
    }

    error(message: string, data?: any) {
        this.log('ERROR', message, data);
    }

    debug(message: string, data?: any) {
        this.log('DEBUG', message, data);
    }

    isEnabled() {
        return this.enabled && this.debugMobileEnabled;
    }

    enable() {
        this.enabled = true;
        this.log('SYSTEM', 'Debug logging enabled');
    }

    disable() {
        this.log('SYSTEM', 'Debug logging disabled');
        this.enabled = false;
    }

    isLogFile(path: string): boolean {
        return this.logFilePath !== null && path === this.logFilePath;
    }

    private sanitizeData(data: any): any {
        try {
            // Create a copy to avoid any reference issues
            const seen = new WeakSet();
            return JSON.parse(JSON.stringify(data, (key, value) => {
                // Prevent circular references
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) return '[Circular]';
                    seen.add(value);
                }
                
                if (typeof value === 'function') return '[Function]';
                if (value instanceof Set) return Array.from(value);
                if (value instanceof Map) return Object.fromEntries(value);
                if (key === 'app' || key === 'plugin' || key === 'vault' || key === 'logFile') return '[Obsidian Object]';
                if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'TFile') {
                    return { path: value.path, name: value.name };
                }
                if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'TFolder') {
                    return { path: value.path, name: value.name };
                }
                return value;
            }));
        } catch (err) {
            console.error('Sanitize error:', err);
            return String(data);
        }
    }

    async close() {
        if (this.logFilePath && this.vault) {
            // Flush any remaining entries
            await this.processWriteQueue();
            const file = this.vault.getAbstractFileByPath(this.logFilePath);
            if (file && file instanceof TFile) {
                await this.vault.append(file, `\n\nClosed: ${new Date().toISOString()}\n`);
            }
        }
    }
}

export const debugLog = new DebugLogger();