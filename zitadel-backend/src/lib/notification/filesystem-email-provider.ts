/**
 * FileSystem Email Provider (Debug/Development)
 * Writes emails to disk instead of sending them
 * Based on Zitadel Go: internal/notification/channels/fs/channel.go
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EmailProvider } from './email-service';

export interface FileSystemConfig {
  outputDir: string;              // Directory to write email files
  format?: 'json' | 'html' | 'text' | 'eml'; // Output format (default: json)
  prettyPrint?: boolean;          // Pretty print JSON (default: true)
}

/**
 * FileSystem Email Provider
 * Writes emails to disk for debugging/development
 */
export class FileSystemEmailProvider implements EmailProvider {
  name = 'filesystem';
  private config: FileSystemConfig;

  constructor(config: FileSystemConfig) {
    if (!config.outputDir) {
      throw new Error('Output directory is required');
    }
    
    this.config = {
      format: 'json',
      prettyPrint: true,
      ...config,
    };
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    html?: string,
    cc?: string[],
    bcc?: string[]
  ): Promise<{ messageId: string }> {
    const messageId = `fs_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    // Ensure output directory exists
    await this.ensureOutputDir();

    const emailData = {
      messageId,
      timestamp,
      to,
      subject,
      body,
      html,
      cc,
      bcc,
    };

    const filename = this.generateFilename(messageId, timestamp);
    const filepath = path.join(this.config.outputDir, filename);

    try {
      const content = this.formatContent(emailData);
      await fs.writeFile(filepath, content, 'utf-8');
      
      console.log(`[FileSystem Email] Written to: ${filepath}`);
      return { messageId };
    } catch (error: any) {
      console.error(`[FileSystem Email] Failed to write email:`, error.message);
      throw new Error(`Failed to write email to filesystem: ${error.message}`);
    }
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.config.outputDir, { recursive: true });
      console.log(`[FileSystem Email] Created output directory: ${this.config.outputDir}`);
    }
  }

  private generateFilename(messageId: string, timestamp: string): string {
    const date = timestamp.split('T')[0]; // YYYY-MM-DD
    const time = timestamp.split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
    
    const ext = this.getFileExtension();
    return `email_${date}_${time}_${messageId}.${ext}`;
  }

  private getFileExtension(): string {
    switch (this.config.format) {
      case 'html': return 'html';
      case 'text': return 'txt';
      case 'eml': return 'eml';
      case 'json':
      default: return 'json';
    }
  }

  private formatContent(emailData: any): string {
    switch (this.config.format) {
      case 'html':
        return this.formatAsHTML(emailData);
      case 'text':
        return this.formatAsText(emailData);
      case 'eml':
        return this.formatAsEML(emailData);
      case 'json':
      default:
        return this.formatAsJSON(emailData);
    }
  }

  private formatAsJSON(emailData: any): string {
    if (this.config.prettyPrint) {
      return JSON.stringify(emailData, null, 2);
    }
    return JSON.stringify(emailData);
  }

  private formatAsText(emailData: any): string {
    const toList = Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to;
    const ccList = emailData.cc?.length ? `\nCC: ${emailData.cc.join(', ')}` : '';
    const bccList = emailData.bcc?.length ? `\nBCC: ${emailData.bcc.join(', ')}` : '';
    
    return `Message-ID: ${emailData.messageId}
Date: ${emailData.timestamp}
To: ${toList}${ccList}${bccList}
Subject: ${emailData.subject}

${emailData.body}
`;
  }

  private formatAsHTML(emailData: any): string {
    if (emailData.html) {
      return emailData.html;
    }
    
    // Convert plain text to basic HTML
    const bodyHtml = emailData.body.replace(/\n/g, '<br>');
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${emailData.subject}</title>
</head>
<body>
  <h2>${emailData.subject}</h2>
  <p>${bodyHtml}</p>
</body>
</html>`;
  }

  private formatAsEML(emailData: any): string {
    const toList = Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to;
    const ccList = emailData.cc?.length ? `\nCC: ${emailData.cc.join(', ')}` : '';
    const bccList = emailData.bcc?.length ? `\nBCC: ${emailData.bcc.join(', ')}` : '';
    
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36)}`;
    
    let eml = `Message-ID: <${emailData.messageId}@localhost>
Date: ${emailData.timestamp}
From: noreply@zitadel.local
To: ${toList}${ccList}${bccList}
Subject: ${emailData.subject}
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="${boundary}"

--${boundary}
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: 7bit

${emailData.body}
`;

    if (emailData.html) {
      eml += `
--${boundary}
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: 7bit

${emailData.html}
`;
    }

    eml += `\n--${boundary}--\n`;
    return eml;
  }

  /**
   * Get list of email files in output directory
   */
  async listEmails(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.outputDir);
      return files.filter(f => f.startsWith('email_'));
    } catch {
      return [];
    }
  }

  /**
   * Clear all email files from output directory
   */
  async clearEmails(): Promise<void> {
    const files = await this.listEmails();
    await Promise.all(
      files.map(f => fs.unlink(path.join(this.config.outputDir, f)))
    );
    console.log(`[FileSystem Email] Cleared ${files.length} email files`);
  }
}

/**
 * Create filesystem provider from environment variables
 */
export function createFileSystemProviderFromEnv(): FileSystemEmailProvider | null {
  const outputDir = process.env.EMAIL_FS_OUTPUT_DIR;
  
  if (!outputDir) {
    return null;
  }

  const config: FileSystemConfig = {
    outputDir,
    format: (process.env.EMAIL_FS_FORMAT as any) || 'json',
    prettyPrint: process.env.EMAIL_FS_PRETTY_PRINT !== 'false',
  };

  return new FileSystemEmailProvider(config);
}
