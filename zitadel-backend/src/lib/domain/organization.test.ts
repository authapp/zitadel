import {
  OrgState,
  DomainValidationType,
  isOrgActive,
  isDomainVerified,
  OrgDomain,
} from './organization';

describe('OrgState enum', () => {
  it('should have correct values', () => {
    expect(OrgState.UNSPECIFIED).toBe(0);
    expect(OrgState.ACTIVE).toBe(1);
    expect(OrgState.INACTIVE).toBe(2);
  });
});

describe('DomainValidationType enum', () => {
  it('should have correct values', () => {
    expect(DomainValidationType.UNSPECIFIED).toBe(0);
    expect(DomainValidationType.HTTP).toBe(1);
    expect(DomainValidationType.DNS).toBe(2);
  });
});

describe('isOrgActive', () => {
  it('should return true for ACTIVE state', () => {
    expect(isOrgActive(OrgState.ACTIVE)).toBe(true);
  });

  it('should return false for INACTIVE state', () => {
    expect(isOrgActive(OrgState.INACTIVE)).toBe(false);
  });

  it('should return false for UNSPECIFIED state', () => {
    expect(isOrgActive(OrgState.UNSPECIFIED)).toBe(false);
  });
});

describe('isDomainVerified', () => {
  it('should return true when domain is verified', () => {
    const domain: OrgDomain = {
      orgId: 'org-123',
      domain: 'example.com',
      isPrimary: true,
      isVerified: true,
      validationType: DomainValidationType.DNS,
      createdAt: new Date(),
      changedAt: new Date(),
    };

    expect(isDomainVerified(domain)).toBe(true);
  });

  it('should return false when domain is not verified', () => {
    const domain: OrgDomain = {
      orgId: 'org-123',
      domain: 'example.com',
      isPrimary: false,
      isVerified: false,
      validationType: DomainValidationType.HTTP,
      validationCode: 'abc123',
      createdAt: new Date(),
      changedAt: new Date(),
    };

    expect(isDomainVerified(domain)).toBe(false);
  });
});
