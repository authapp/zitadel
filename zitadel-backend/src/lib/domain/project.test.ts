import {
  ProjectState,
  AppState,
  isProjectActive,
  isAppActive,
} from './project';

describe('ProjectState enum', () => {
  it('should have correct values', () => {
    expect(ProjectState.UNSPECIFIED).toBe(0);
    expect(ProjectState.ACTIVE).toBe(1);
    expect(ProjectState.INACTIVE).toBe(2);
  });
});

describe('AppState enum', () => {
  it('should have correct values', () => {
    expect(AppState.UNSPECIFIED).toBe(0);
    expect(AppState.ACTIVE).toBe(1);
    expect(AppState.INACTIVE).toBe(2);
  });
});

describe('isProjectActive', () => {
  it('should return true for ACTIVE state', () => {
    expect(isProjectActive(ProjectState.ACTIVE)).toBe(true);
  });

  it('should return false for INACTIVE state', () => {
    expect(isProjectActive(ProjectState.INACTIVE)).toBe(false);
  });

  it('should return false for UNSPECIFIED state', () => {
    expect(isProjectActive(ProjectState.UNSPECIFIED)).toBe(false);
  });
});

describe('isAppActive', () => {
  it('should return true for ACTIVE state', () => {
    expect(isAppActive(AppState.ACTIVE)).toBe(true);
  });

  it('should return false for INACTIVE state', () => {
    expect(isAppActive(AppState.INACTIVE)).toBe(false);
  });

  it('should return false for UNSPECIFIED state', () => {
    expect(isAppActive(AppState.UNSPECIFIED)).toBe(false);
  });
});
