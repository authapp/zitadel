import {
  UserState,
  UserType,
  Gender,
  isUserActive,
  userExists,
  isUserLocked,
  isEmailVerified,
  isPhoneVerified,
  HumanEmail,
  HumanPhone,
} from './user';

describe('UserState enum', () => {
  it('should have correct values', () => {
    expect(UserState.UNSPECIFIED).toBe(0);
    expect(UserState.ACTIVE).toBe(1);
    expect(UserState.INACTIVE).toBe(2);
    expect(UserState.DELETED).toBe(3);
    expect(UserState.LOCKED).toBe(4);
    expect(UserState.SUSPENDED).toBe(5);
    expect(UserState.INITIAL).toBe(6);
  });
});

describe('UserType enum', () => {
  it('should have correct values', () => {
    expect(UserType.UNSPECIFIED).toBe(0);
    expect(UserType.HUMAN).toBe(1);
    expect(UserType.MACHINE).toBe(2);
  });
});

describe('Gender enum', () => {
  it('should have correct values', () => {
    expect(Gender.UNSPECIFIED).toBe(0);
    expect(Gender.FEMALE).toBe(1);
    expect(Gender.MALE).toBe(2);
    expect(Gender.DIVERSE).toBe(3);
  });
});

describe('isUserActive', () => {
  it('should return true for ACTIVE state', () => {
    expect(isUserActive(UserState.ACTIVE)).toBe(true);
  });

  it('should return true for INITIAL state', () => {
    expect(isUserActive(UserState.INITIAL)).toBe(true);
  });

  it('should return false for INACTIVE state', () => {
    expect(isUserActive(UserState.INACTIVE)).toBe(false);
  });

  it('should return false for DELETED state', () => {
    expect(isUserActive(UserState.DELETED)).toBe(false);
  });

  it('should return false for LOCKED state', () => {
    expect(isUserActive(UserState.LOCKED)).toBe(false);
  });

  it('should return false for SUSPENDED state', () => {
    expect(isUserActive(UserState.SUSPENDED)).toBe(false);
  });

  it('should return false for UNSPECIFIED state', () => {
    expect(isUserActive(UserState.UNSPECIFIED)).toBe(false);
  });
});

describe('userExists', () => {
  it('should return true for ACTIVE state', () => {
    expect(userExists(UserState.ACTIVE)).toBe(true);
  });

  it('should return true for INACTIVE state', () => {
    expect(userExists(UserState.INACTIVE)).toBe(true);
  });

  it('should return true for LOCKED state', () => {
    expect(userExists(UserState.LOCKED)).toBe(true);
  });

  it('should return true for SUSPENDED state', () => {
    expect(userExists(UserState.SUSPENDED)).toBe(true);
  });

  it('should return true for INITIAL state', () => {
    expect(userExists(UserState.INITIAL)).toBe(true);
  });

  it('should return false for UNSPECIFIED state', () => {
    expect(userExists(UserState.UNSPECIFIED)).toBe(false);
  });

  it('should return false for DELETED state', () => {
    expect(userExists(UserState.DELETED)).toBe(false);
  });
});

describe('isUserLocked', () => {
  it('should return true for LOCKED state', () => {
    expect(isUserLocked(UserState.LOCKED)).toBe(true);
  });

  it('should return true for SUSPENDED state', () => {
    expect(isUserLocked(UserState.SUSPENDED)).toBe(true);
  });

  it('should return false for ACTIVE state', () => {
    expect(isUserLocked(UserState.ACTIVE)).toBe(false);
  });

  it('should return false for INACTIVE state', () => {
    expect(isUserLocked(UserState.INACTIVE)).toBe(false);
  });

  it('should return false for DELETED state', () => {
    expect(isUserLocked(UserState.DELETED)).toBe(false);
  });
});

describe('isEmailVerified', () => {
  it('should return true when email is verified', () => {
    const email: HumanEmail = {
      email: 'test@example.com',
      isVerified: true,
      verifiedAt: new Date(),
    };

    expect(isEmailVerified(email)).toBe(true);
  });

  it('should return false when email is not verified', () => {
    const email: HumanEmail = {
      email: 'test@example.com',
      isVerified: false,
    };

    expect(isEmailVerified(email)).toBe(false);
  });
});

describe('isPhoneVerified', () => {
  it('should return true when phone is verified', () => {
    const phone: HumanPhone = {
      phone: '+1234567890',
      isVerified: true,
      verifiedAt: new Date(),
    };

    expect(isPhoneVerified(phone)).toBe(true);
  });

  it('should return false when phone is not verified', () => {
    const phone: HumanPhone = {
      phone: '+1234567890',
      isVerified: false,
    };

    expect(isPhoneVerified(phone)).toBe(false);
  });
});
