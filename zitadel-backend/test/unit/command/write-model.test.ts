/**
 * Write Model Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Event } from '../../../src/lib/eventstore/types';
import {
  WriteModel,
  appendAndReduce,
  writeModelToObjectDetails,
  isAggregateExists,
  aggregateFromWriteModel,
} from '../../../src/lib/command/write-model';

// Test write model
class TestWriteModel extends WriteModel {
  value?: string;
  counter: number = 0;
  
  constructor() {
    super('test');
  }
  
  reduce(event: Event): void {
    switch (event.eventType) {
      case 'test.created':
        this.value = event.payload?.value;
        break;
      case 'test.updated':
        this.value = event.payload?.value;
        this.counter++;
        break;
    }
  }
}

describe('WriteModel', () => {
  let wm: TestWriteModel;
  
  beforeEach(() => {
    wm = new TestWriteModel();
  });
  
  describe('loadFromEvents', () => {
    it('should load state from events', () => {
      const events: Event[] = [
        {
          eventType: 'test.created',
          aggregateType: 'test',
          aggregateID: 'test-1',
          aggregateVersion: 1n,
          revision: 1,
          owner: 'org-1',
          instanceID: 'inst-1',
          creator: 'user-1',
          createdAt: new Date('2024-01-01'),
          payload: { value: 'hello' },
          position: { position: 1, inTxOrder: 0 },
        },
        {
          eventType: 'test.updated',
          aggregateType: 'test',
          aggregateID: 'test-1',
          aggregateVersion: 2n,
          revision: 1,
          owner: 'org-1',
          instanceID: 'inst-1',
          creator: 'user-1',
          createdAt: new Date('2024-01-02'),
          payload: { value: 'world' },
          position: { position: 2, inTxOrder: 0 },
        },
      ];
      
      wm.loadFromEvents(events);
      
      expect(wm.aggregateID).toBe('test-1');
      expect(wm.aggregateVersion).toBe(2n);
      expect(wm.resourceOwner).toBe('org-1');
      expect(wm.instanceID).toBe('inst-1');
      expect(wm.value).toBe('world');
      expect(wm.counter).toBe(1);
    });
    
    it('should handle empty events', () => {
      wm.loadFromEvents([]);
      
      expect(wm.aggregateID).toBe('');
      expect(wm.aggregateVersion).toBe(0n);
    });
  });
  
  describe('appendAndReduce', () => {
    it('should append and reduce new events', () => {
      wm.aggregateID = 'test-1';
      wm.aggregateVersion = 1n;
      wm.value = 'initial';
      
      const newEvents: Event[] = [
        {
          eventType: 'test.updated',
          aggregateType: 'test',
          aggregateID: 'test-1',
          aggregateVersion: 2n,
          revision: 1,
          owner: 'org-1',
          instanceID: 'inst-1',
          creator: 'user-1',
          createdAt: new Date('2024-01-02'),
          payload: { value: 'updated' },
          position: { position: 2, inTxOrder: 0 },
        },
      ];
      
      appendAndReduce(wm, ...newEvents);
      
      expect(wm.aggregateVersion).toBe(2n);
      expect(wm.value).toBe('updated');
      expect(wm.counter).toBe(1);
    });
  });
  
  describe('writeModelToObjectDetails', () => {
    it('should convert write model to object details', () => {
      wm.aggregateVersion = 5n;
      wm.changeDate = new Date('2024-01-01');
      wm.resourceOwner = 'org-1';
      
      const details = writeModelToObjectDetails(wm);
      
      expect(details.sequence).toBe(5n);
      expect(details.eventDate).toEqual(new Date('2024-01-01'));
      expect(details.resourceOwner).toBe('org-1');
    });
  });
  
  describe('isAggregateExists', () => {
    it('should return false for new aggregate', () => {
      expect(isAggregateExists(wm)).toBe(false);
    });
    
    it('should return true for existing aggregate', () => {
      wm.aggregateVersion = 1n;
      expect(isAggregateExists(wm)).toBe(true);
    });
  });
  
  describe('aggregateFromWriteModel', () => {
    it('should create aggregate from write model', () => {
      wm.aggregateID = 'test-1';
      wm.aggregateType = 'test';
      wm.resourceOwner = 'org-1';
      wm.instanceID = 'inst-1';
      wm.aggregateVersion = 3n;
      
      const agg = aggregateFromWriteModel(wm);
      
      expect(agg.id).toBe('test-1');
      expect(agg.type).toBe('test');
      expect(agg.owner).toBe('org-1');
      expect(agg.instanceID).toBe('inst-1');
      expect(agg.version).toBe(3n);
    });
  });
});
