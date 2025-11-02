/**
 * Email Verification REST API Integration Tests
 * 
 * Tests the complete email verification flow:
 * REST API → Commands → Events → Projections → Email Service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabasePool } from '../../../../src/lib/database';
import { createTestDatabase, closeTestDatabase } from '../../setup';
import { DatabaseMigrator } from '../../../../src/lib/database/migrator';
import { setupCommandTest, CommandTestContext } from '../../../helpers/command-test-helpers';
import { UserProjection } from '../../../../src/lib/query/projections/user-projection';
import { UserQueries } from '../../../../src/lib/query/user/user-queries';
import { 
  MockEmailProvider, 
  setEmailService, 
  EmailService 
} from '../../../../src/lib/notification/email-service';
import express, { Application } from 'express';
import request from 'supertest';
import { createEmailVerificationRouter } from '../../../../src/api/rest/email-verification';

describe('Email Verification REST API Integration Tests', () => {
  let pool: DatabasePool;
  let ctx: CommandTestContext;
  let userProjection: UserProjection;
  let userQueries: UserQueries;
  let mockEmailProvider: MockEmailProvider;
  let app: Application;
  
  const TEST_INSTANCE_ID = 'test-instance';
  const TEST_ORG_ID = 'test-org';

  beforeAll(async () => {
    // Setup database
    pool = await createTestDatabase();
    const migrator = new DatabaseMigrator(pool);
    await migrator.migrate();
    
    // Setup command infrastructure
    ctx = await setupCommandTest(pool);
    
    // Initialize projection and queries
    userProjection = new UserProjection(ctx.eventstore, pool);
    await userProjection.init();
    await userProjection.start();
    userQueries = new UserQueries(pool);
    
    // Setup mock email provider
    mockEmailProvider = new MockEmailProvider();
    setEmailService(new EmailService(mockEmailProvider));
    
    // Create Express app with email verification routes
    app = express();
    app.use(express.json());
    
    const router = createEmailVerificationRouter(pool, ctx.eventstore);
    app.use('/api/v1/email', router);
  });

  afterAll(async () => {
    if (userProjection) {
      await userProjection.stop();
    }
    await closeTestDatabase();
  });

  beforeEach(() => {
    // Clear sent emails before each test
    mockEmailProvider.clearEmails();
  });

  /**
   * Helper: Create test user
   * Uses incrementing counter for unique emails
   */
  let userCounter = 0;
  async function createTestUser(username: string, email: string) {
    userCounter++;
    const suffix = Date.now() + userCounter; // Ensure uniqueness
    const uniqueUsername = `${username}-${suffix}`;
    const uniqueEmail = `${email.split('@')[0]}-${suffix}@${email.split('@')[1]}`;
    const context = {
      instanceID: TEST_INSTANCE_ID,
      orgID: TEST_ORG_ID,
      userID: 'admin',
    };

    const result = await ctx.commands.addHumanUser(context, {
      orgID: TEST_ORG_ID,
      username: uniqueUsername,
      email: uniqueEmail,
      firstName: 'Test',
      lastName: 'User',
      emailVerified: false,
    });

    // Process projections
    await processProjections();

    return result.userID;
  }

  /**
   * Helper: Generate unique email for test
   */
  let emailCounter = 0;
  function uniqueEmail(base: string): string {
    emailCounter++;
    const [local, domain] = base.split('@');
    return `${local}-${Date.now()}-${emailCounter}@${domain}`;
  }

  /**
   * Helper: Process projections
   * Tracks last processed position to avoid duplicate processing
   */
  let lastProcessedPosition = 0;
  async function processProjections() {
    const events = await ctx.getEvents('*', '*');
    for (const event of events) {
      // Only process events we haven't seen before
      if (event.position.position > lastProcessedPosition) {
        await userProjection.reduce(event);
        await userProjection.setCurrentPosition(
          event.position.position,
          event.position.inTxOrder ?? 0,
          event.createdAt,
          event.instanceID,
          event.aggregateType,
          event.aggregateID
        );
        lastProcessedPosition = event.position.position;
      }
    }
    // Small delay to ensure consistency
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  describe('POST /api/v1/email/change', () => {
    it('should change email and send verification code', async () => {
      // Create test user
      const userId = await createTestUser('testuser1', 'old@example.com');

      // Change email
      const response = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: uniqueEmail('new@example.com'),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verification code sent');
      expect(response.body.details).toBeDefined();

      // Verify email was sent
      expect(mockEmailProvider.sentEmails.length).toBe(1);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.to).toMatch(/^new-.*@example\.com$/); // Check pattern instead of exact match
      expect(sentEmail.subject).toContain('Verify');
      expect(sentEmail.body).toContain('verification code');
    });

    it('should return verification code when returnCode is true', async () => {
      const userId = await createTestUser('testuser2', 'test@example.com');

      const response = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: 'testing@example.com',
          returnCode: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.code).toBeDefined();
      expect(response.body.code).toMatch(/^\d{6}$/); // 6-digit code
      expect(response.body.message).toContain('code returned');

      // No email should be sent when returnCode is true
      expect(mockEmailProvider.sentEmails.length).toBe(0);
    });

    it('should support verification link template', async () => {
      const userId = await createTestUser('testuser3', 'user@example.com');

      const response = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: 'verify@example.com',
          urlTemplate: 'https://myapp.com/verify?code={{.Code}}',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify email contains link
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.html).toContain('https://myapp.com/verify?code=');
      expect(sentEmail.html).toContain('Verify Email');
    });

    it('should fail with invalid email format', async () => {
      const userId = await createTestUser('testuser4', 'valid@example.com');

      const response = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: 'not-an-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should fail without userId', async () => {
      const response = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('userId is required');
    });

    it('should fail without email', async () => {
      const response = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId: 'some-user-id',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('email is required');
    });
  });

  describe('POST /api/v1/email/resend', () => {
    it('should resend verification code', async () => {
      // Create user and change email first
      const userId = await createTestUser('resenduser1', 'initial@example.com');
      
      await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: uniqueEmail('newemail@example.com'),
        });

      // Clear sent emails
      mockEmailProvider.clearEmails();

      // Resend code
      const response = await request(app)
        .post('/api/v1/email/resend')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('code sent');

      // Verify new email was sent
      expect(mockEmailProvider.sentEmails.length).toBe(1);
      expect(mockEmailProvider.sentEmails[0].to).toMatch(/^newemail-.*@example\.com$/);
    });

    it('should return code when returnCode is true', async () => {
      const userId = await createTestUser('resenduser2', 'email@example.com');
      
      // Change email first
      const changeResponse = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: uniqueEmail('changed@example.com'),
          returnCode: true,
        });

      if (changeResponse.status !== 200) {
        console.log('Change email failed:', changeResponse.status, changeResponse.body);
      }

      // Resend with returnCode
      const response = await request(app)
        .post('/api/v1/email/resend')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          returnCode: true,
        });

      if (response.status !== 200) {
        console.log('Resend failed:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body.code).toBeDefined();
      expect(response.body.code).toMatch(/^\d{6}$/);
    });

    it('should fail without userId', async () => {
      const response = await request(app)
        .post('/api/v1/email/resend')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('userId is required');
    });
  });

  describe('POST /api/v1/email/verify', () => {
    it('should verify email with valid code', async () => {
      // Create user and get verification code
      const userId = await createTestUser('verifyuser1', 'verify@example.com');
      
      const changeResponse = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: 'verified@example.com',
          returnCode: true,
        });

      const code = changeResponse.body.code;

      // Process projections
      await processProjections();

      // Verify email
      const response = await request(app)
        .post('/api/v1/email/verify')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          code,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified successfully');

      // Process projections and verify in database
      await processProjections();
      
      const user = await userQueries.getUserByID(userId, TEST_INSTANCE_ID);
      expect(user).toBeDefined();
      expect(user!.email).toBe('verified@example.com');
      expect(user!.emailVerified).toBe(true);
    });

    it('should fail with invalid code', async () => {
      const userId = await createTestUser('verifyuser2', 'test@example.com');
      
      await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: uniqueEmail('new@example.com'),
        });

      await processProjections();

      // Try to verify with wrong code
      const response = await request(app)
        .post('/api/v1/email/verify')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          code: '999999',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should fail without userId', async () => {
      const response = await request(app)
        .post('/api/v1/email/verify')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          code: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('userId is required');
    });

    it('should fail without code', async () => {
      const response = await request(app)
        .post('/api/v1/email/verify')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId: 'some-user',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('code is required');
    });
  });

  describe('Complete Email Verification Lifecycle', () => {
    it('should handle complete flow: change → verify', async () => {
      // 1. Create user
      const userId = await createTestUser('lifecycle1', 'original@example.com');

      // 2. Change email and get code
      const changeResponse = await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: 'updated@example.com',
          returnCode: true,
        });

      expect(changeResponse.body.code).toBeDefined();
      const code = changeResponse.body.code;

      await processProjections();

      // 3. Verify email
      const verifyResponse = await request(app)
        .post('/api/v1/email/verify')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          code,
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);

      // 4. Verify in database
      await processProjections();
      const user = await userQueries.getUserByID(userId, TEST_INSTANCE_ID);
      
      expect(user).toBeDefined();
      expect(user!.email).toBe('updated@example.com');
      expect(user!.emailVerified).toBe(true);
    });

    it('should handle flow: change → resend → verify', async () => {
      // 1. Create user
      const userId = await createTestUser('lifecycle2', 'start@example.com');

      // 2. Change email
      await request(app)
        .post('/api/v1/email/change')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          email: 'middle@example.com',
        });

      await processProjections();

      // 3. Resend code
      const resendResponse = await request(app)
        .post('/api/v1/email/resend')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          returnCode: true,
        });

      expect(resendResponse.body.code).toBeDefined();
      const code = resendResponse.body.code;

      await processProjections();

      // 4. Verify with resent code
      const verifyResponse = await request(app)
        .post('/api/v1/email/verify')
        .set('X-Instance-ID', TEST_INSTANCE_ID)
        .set('X-Org-ID', TEST_ORG_ID)
        .send({
          userId,
          code,
        });

      expect(verifyResponse.status).toBe(200);

      // 5. Check final state
      await processProjections();
      const user = await userQueries.getUserByID(userId, TEST_INSTANCE_ID);
      
      expect(user!.email).toBe('middle@example.com');
      expect(user!.emailVerified).toBe(true);
    });
  });
});
